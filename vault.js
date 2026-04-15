// ============================================================
//  vault.js — Collector's Market Est.
//  My Collection App
//  Version 1.0
//
//  This file handles all Collector's Market functionality:
//    - Anonymous token management
//    - Opt-in / opt-out UI
//    - Background data submission to central sheet
//    - Contributor count + progress bar
//    - Market value + rarity display on item detail pages
//
//  Load order: after app.js, wizard.js, tutorial.js
//  Add to index.html: <script src="vault.js"></script>
// ============================================================


// ============================================================
//  CONFIG — change numbers here, nowhere else
// ============================================================

const VAULT = {

  // The secure Apps Script endpoint (your central sheet)
  ENDPOINT: 'https://script.google.com/macros/s/AKfycbx6gRS2tpwPFaqyT2Zk_uAUTVH-URWMlVg1msTHyeOxDS3HOMytRk9lXeU_AvbwQwIRwA/exec',

  // How many contributor collections needed before market data is revealed
  REVEAL_THRESHOLD: 300,

  // Minimum data points required before showing a market value for any item
  MIN_DATAPOINTS: 10,

  // Percentage trimmed from top and bottom to remove outlier prices (0–50)
  TRIM_PERCENT: 10,

  // Rarity band cutoffs — percentage of collections an item appears in
  // Example: if 2.5% of collections have item X → "Rare"
  RARITY_BANDS: [0.5, 3, 10, 30, 60],
  RARITY_LABELS: ['Highly Rare', 'Rare', 'Hard to Find', 'Scarce', 'Plentiful', 'Common'],

  // Rarity label colors (matches app palette)
  RARITY_COLORS: {
    'Highly Rare':  '#f05008',   // accent orange
    'Rare':         '#e67e22',   // warm orange
    'Hard to Find': '#d4a843',   // gold
    'Scarce':       '#8b5cf6',   // purple
    'Plentiful':    '#3a9e68',   // green
    'Common':       '#5a6280',   // dim
  },

  // localStorage keys
  KEY_TOKEN:    'lv_vault_token',
  KEY_OPTIN:    'lv_vault_optin',
  KEY_LAST_SUB: 'lv_vault_last_sub',

  // How often to re-submit data (milliseconds) — default 7 days
  SUBMIT_INTERVAL_MS: 7 * 24 * 60 * 60 * 1000,

};


// ============================================================
//  TOKEN MANAGEMENT
//  The token is a random 12-char alphanumeric string.
//  It never changes, is never shown to the user, and is
//  never linked to their name, email, or Google account.
// ============================================================

function vaultGetToken() {
  let token = localStorage.getItem(VAULT.KEY_TOKEN);
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map(b => b.toString(36).padStart(2,'0'))
      .join('')
      .substring(0, 12);
    localStorage.setItem(VAULT.KEY_TOKEN, token);
  }
  return token;
}

function vaultIsOptedIn() {
  return localStorage.getItem(VAULT.KEY_OPTIN) === 'true';
}

function vaultSetOptIn(value) {
  localStorage.setItem(VAULT.KEY_OPTIN, value ? 'true' : 'false');
}


// ============================================================
//  API CALLS
// ============================================================

async function vaultPost(payload) {
  try {
    const res = await fetch(VAULT.ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' },  // text/plain avoids CORS preflight
    });
    return await res.json();
  } catch(err) {
    console.warn('[Vault] API call failed:', err.message);
    return null;
  }
}

async function vaultGet(params) {
  try {
    const url = VAULT.ENDPOINT + '?' + new URLSearchParams(params);
    const res = await fetch(url);
    return await res.json();
  } catch(err) {
    console.warn('[Vault] API get failed:', err.message);
    return null;
  }
}


// ============================================================
//  CONTRIBUTOR COUNT + PROGRESS BAR
//  Called on dashboard load. Fetches the live count from
//  the central sheet and renders the progress bar.
// ============================================================

async function vaultLoadContributorCount() {
  const el = document.getElementById('vault-progress-wrap');
  if (!el) return;

  const data = await vaultGet({ action: 'get_counts' });
  if (!data || data.status !== 200) return;

  const count     = data.contributor_count || 0;
  const threshold = data.reveal_threshold  || VAULT.REVEAL_THRESHOLD;
  const pct       = Math.min(100, Math.round((count / threshold) * 100));
  const revealed  = data.revealed || false;

  if (revealed) {
    el.innerHTML = `
      <div class="vault-progress-box vault-revealed">
        <div class="vault-progress-title">🏆 Collector's Market Est. is Live!</div>
        <div class="vault-progress-sub">Market values and rarity scores are now available on every item detail page.</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="vault-progress-box">
      <div class="vault-progress-title">
        🔒 Collector's Market Est.
        <span class="vault-progress-count">${count} / ${threshold} collectors</span>
      </div>
      <div class="vault-progress-bar-wrap">
        <div class="vault-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="vault-progress-sub">
        Crowd-sourced market values and rarity scores unlock at ${threshold} contributing collectors.
        <strong>Tell a fellow collector to join!</strong>
      </div>
    </div>`;
}


// ============================================================
//  OPT-IN MODAL
//  Shows once after login if user hasn't decided yet.
//  Also accessible from Preferences page.
// ============================================================

function vaultShowOptInModal(fromPrefs) {
  const existing = document.getElementById('vault-optin-modal');
  if (existing) existing.remove();

  const isOptedIn = vaultIsOptedIn();

  const modal = document.createElement('div');
  modal.id = 'vault-optin-modal';
  // Bugfix 2026-04-14: modal was taller than phone viewport; "Yes, I'll Contribute"
  // button was off-screen and the outer flex container didn't scroll. Added
  // max-height + scroll on the inner panel, aligned top on mobile, and reduced
  // padding so buttons stay visible.
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.72);
    display:flex;align-items:flex-start;justify-content:center;
    z-index:9999;padding:20px;overflow-y:auto;
  `;

  modal.innerHTML = `
    <div style="
      background:var(--surface);border:1px solid var(--border);
      border-radius:14px;max-width:500px;width:100%;padding:22px 22px 20px;
      font-family:var(--font-body);position:relative;
      max-height:calc(100vh - 40px);overflow-y:auto;
      -webkit-overflow-scrolling:touch;margin:auto 0;
    ">
      <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text);margin-bottom:6px;letter-spacing:0.04em">
        Collector's Market Est.
      </div>
      <div style="font-size:0.78rem;color:var(--accent);font-family:var(--font-head);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:20px">
        Crowd-Sourced Market Values &amp; Rarity Scores
      </div>

      <p style="color:var(--text-mid);font-size:0.88rem;line-height:1.7;margin-bottom:16px">
        We're building something that doesn't exist anywhere else — real market values and rarity scores based on actual collector data, not guesswork.
      </p>
      <p style="color:var(--text-mid);font-size:0.88rem;line-height:1.7;margin-bottom:16px">
        If you choose to contribute, your collection's condition and estimated worth data is submitted anonymously in the background. <strong style="color:var(--text)">Your name, email, and identity are never attached to this data — ever.</strong> Only a random anonymous code ties your submissions together, and even we cannot trace it back to you.
      </p>
      <p style="color:var(--text-mid);font-size:0.88rem;line-height:1.7;margin-bottom:24px">
        Contributors who help build the database unlock market values and rarity scores once we reach 300 collections. You can opt out and have your data permanently deleted at any time.
      </p>

      <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:14px 16px;margin-bottom:24px;border:1px solid var(--border)">
        <div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-head)">What gets submitted</div>
        <div style="font-size:0.84rem;color:var(--text-mid);line-height:1.8">
          ✓ &nbsp;Item number and variation<br>
          ✓ &nbsp;Condition grade<br>
          ✓ &nbsp;Your estimated worth<br>
          ✓ &nbsp;Sold price (if recorded)<br>
          ✗ &nbsp;<span style="color:var(--text)">Your name, email, or any identifying information — never</span>
        </div>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;position:sticky;bottom:0;background:var(--surface);padding-top:8px">
        ${!isOptedIn ? `
          <button onclick="vaultConfirmOptIn()" style="
            flex:1;padding:11px 20px;border-radius:8px;border:none;
            background:var(--accent);color:#fff;font-family:var(--font-body);
            font-size:0.9rem;font-weight:600;cursor:pointer;min-width:140px
          ">Yes, I'll Contribute</button>
          <button onclick="vaultDismissOptIn()" style="
            flex:1;padding:11px 20px;border-radius:8px;
            border:1px solid var(--border);background:none;
            color:var(--text-mid);font-family:var(--font-body);
            font-size:0.9rem;cursor:pointer;min-width:140px
          ">Not Right Now</button>
        ` : `
          <button onclick="vaultConfirmOptOut()" style="
            flex:1;padding:11px 20px;border-radius:8px;
            border:1px solid var(--border);background:none;
            color:var(--text-mid);font-family:var(--font-body);
            font-size:0.9rem;cursor:pointer;min-width:140px
          ">Opt Out &amp; Delete My Data</button>
          <button onclick="document.getElementById('vault-optin-modal').remove()" style="
            flex:1;padding:11px 20px;border-radius:8px;border:none;
            background:var(--surface2);color:var(--text);font-family:var(--font-body);
            font-size:0.9rem;cursor:pointer;min-width:140px
          ">Close</button>
        `}
      </div>

      ${!fromPrefs ? `
        <div style="margin-top:16px;text-align:center">
          <button onclick="vaultDismissOptIn()" style="
            background:none;border:none;color:var(--text-dim);
            font-size:0.78rem;cursor:pointer;font-family:var(--font-body)
          ">Ask me later</button>
        </div>
      ` : ''}
    </div>`;

  document.body.appendChild(modal);
}

function vaultConfirmOptIn() {
  vaultSetOptIn(true);
  document.getElementById('vault-optin-modal').remove();
  vaultSubmitData();   // submit right away
  vaultShowToast('You\'re contributing to Collector\'s Market Est. Thank you!');
}

function vaultDismissOptIn() {
  // Don't set a value — ask again next session
  const modal = document.getElementById('vault-optin-modal');
  if (modal) modal.remove();
}

async function vaultConfirmOptOut() {
  vaultSetOptIn(false);
  localStorage.removeItem(VAULT.KEY_LAST_SUB);

  // Delete data from central sheet
  const token = vaultGetToken();
  await vaultPost({ action: 'delete_token', token });

  // Generate a new token so old data can't be re-linked
  localStorage.removeItem(VAULT.KEY_TOKEN);
  vaultGetToken();  // generates fresh token

  document.getElementById('vault-optin-modal').remove();
  vaultShowToast('Your data has been removed. You can opt back in any time from Preferences.');
}


// ============================================================
//  DATA SUBMISSION
//  Runs in the background after login if opted in.
//  Only re-submits if SUBMIT_INTERVAL_MS has passed.
//  Pulls from the app's existing personalData.
// ============================================================

async function vaultSubmitData() {
  if (!vaultIsOptedIn()) return;

  // Throttle — don't submit more than once per interval
  const lastSub = parseInt(localStorage.getItem(VAULT.KEY_LAST_SUB) || '0');
  if (Date.now() - lastSub < VAULT.SUBMIT_INTERVAL_MS) return;

  // Pull collection data from the app's state object
  // personalData is the map of itemNum|variation → collection row
  const items = [];
  if (typeof state !== 'undefined' && state.personalData) {
    for (const [key, pd] of Object.entries(state.personalData)) {
      if (!pd.condition) continue;  // skip items with no condition set
      const parts = key.split('|');
      items.push({
        item_num:   parts[0] || '',
        variation:  parts[1] || '',
        condition:  pd.condition    || '',
        est_worth:  parseFloat(pd.userEstWorth || pd.estWorth || pd.est_worth || 0),
        sold_price: parseFloat(pd.soldPrice || pd.sold_price || 0),
      });
    }
  }

  if (!items.length) return;

  const token = vaultGetToken();
  const result = await vaultPost({ action: 'submit', token, items });

  if (result && result.status === 200) {
    localStorage.setItem(VAULT.KEY_LAST_SUB, Date.now().toString());
    console.log('[Vault] Submitted', result.rows_written, 'items');
  }
}


// ============================================================
//  RARITY CALCULATOR (client-side, mirrors the sheet formula)
// ============================================================

function vaultGetRarityLabel(itemCount, totalContributors) {
  if (!totalContributors || totalContributors < 1) return null;
  const pct = (itemCount / totalContributors) * 100;
  for (let i = 0; i < VAULT.RARITY_BANDS.length; i++) {
    if (pct < VAULT.RARITY_BANDS[i]) return VAULT.RARITY_LABELS[i];
  }
  return VAULT.RARITY_LABELS[VAULT.RARITY_LABELS.length - 1];
}


// ============================================================
//  ITEM DETAIL PAGE — MARKET CARD
//  Call vaultRenderMarketCard(itemNum, variation, containerEl)
//  from app.js when building the item detail page.
// ============================================================

async function vaultRenderMarketCard(itemNum, variation, containerEl) {
  if (!containerEl) return;

  // Always show the card shell — content fills in based on state
  containerEl.innerHTML = `
    <div class="vault-market-card" id="vault-market-card">
      <div class="vault-market-header">
        <span class="vault-market-title">Collector's Market Est.</span>
        <span class="vault-market-badge">BETA</span>
      </div>
      <div id="vault-market-body">
        <div style="color:var(--text-dim);font-size:0.84rem;padding:8px 0">Loading…</div>
      </div>
    </div>`;

  const body = document.getElementById('vault-market-body');

  // Check if feature is revealed yet
  const counts = await vaultGet({ action: 'get_counts' });
  if (!counts) {
    body.innerHTML = _vaultCardOffline();
    return;
  }

  const contributorCount = counts.contributor_count || 0;
  const revealed         = counts.revealed || false;

  // Not enough contributors yet — show progress
  if (!revealed) {
    body.innerHTML = _vaultCardLocked(contributorCount, counts.reveal_threshold || VAULT.REVEAL_THRESHOLD);
    return;
  }

  // Revealed but user hasn't opted in — show teaser
  if (!vaultIsOptedIn()) {
    body.innerHTML = _vaultCardTeaser();
    return;
  }

  // Opted in — fetch the real data
  const data = await vaultPost({ action: 'get_market', item_num: itemNum, variation: variation || '' });

  if (!data || data.status !== 200 || data.message === 'no_data') {
    body.innerHTML = _vaultCardNoData(data);
    return;
  }

  // Render market values by condition
  body.innerHTML = _vaultCardData(data.market, contributorCount);
}


// ── Card state renderers ──

function _vaultCardLocked(count, threshold) {
  const pct = Math.min(100, Math.round((count / threshold) * 100));
  return `
    <div style="font-size:0.84rem;color:var(--text-mid);line-height:1.6;margin-bottom:12px">
      Crowd-sourced market values unlock at <strong style="color:var(--text)">${threshold} contributing collectors</strong>.
      Currently at <strong style="color:var(--accent)">${count}</strong>.
    </div>
    <div class="vault-progress-bar-wrap" style="margin-bottom:8px">
      <div class="vault-progress-bar" style="width:${pct}%"></div>
    </div>
    <div style="font-size:0.78rem;color:var(--text-dim)">Tell a fellow collector to help unlock this feature.</div>`;
}

function _vaultCardTeaser() {
  return `
    <div style="font-size:0.84rem;color:var(--text-mid);line-height:1.6;margin-bottom:14px">
      Market values and rarity scores are available — but only to collectors who contribute their data.
    </div>
    <button onclick="vaultShowOptInModal(false)" style="
      padding:9px 18px;border-radius:7px;border:none;
      background:var(--accent);color:#fff;
      font-family:var(--font-body);font-size:0.85rem;
      font-weight:600;cursor:pointer
    ">Contribute &amp; Unlock</button>`;
}

function _vaultCardNoData(data) {
  const reason = data && data.reason === 'below_threshold'
    ? `Not enough data yet — need at least ${VAULT.MIN_DATAPOINTS} reports on this item.`
    : 'No market data yet for this item.';
  return `<div style="font-size:0.84rem;color:var(--text-dim);padding:4px 0">${reason}</div>`;
}

function _vaultCardOffline() {
  return `<div style="font-size:0.84rem;color:var(--text-dim);padding:4px 0">Market data unavailable — check your connection.</div>`;
}

function _vaultCardData(market, totalContributors) {
  const conditions = Object.keys(market).sort();
  if (!conditions.length) return _vaultCardNoData(null);

  let rows = '';
  for (const cond of conditions) {
    const d = market[cond];
    rows += `
      <div class="vault-market-row">
        <span class="vault-market-cond">${cond}</span>
        <span class="vault-market-range">$${d.low.toLocaleString()} – $${d.high.toLocaleString()}</span>
        <span class="vault-market-avg">avg $${d.avg.toLocaleString()}</span>
        <span class="vault-market-pts">${d.count} reports</span>
      </div>`;
  }

  // Rarity — use total data points across all conditions as proxy
  const totalReports = conditions.reduce((sum, c) => sum + market[c].count, 0);
  const rarityLabel  = vaultGetRarityLabel(totalReports, totalContributors);
  const rarityColor  = rarityLabel ? (VAULT.RARITY_COLORS[rarityLabel] || 'var(--text-mid)') : null;

  const rarityHtml = rarityLabel ? `
    <div class="vault-market-rarity">
      Rarity: <span style="color:${rarityColor};font-weight:600">${rarityLabel}</span>
      <span style="color:var(--text-dim);font-size:0.76rem;margin-left:6px">
        (found in ${Math.round((totalReports/totalContributors)*100)}% of collections)
      </span>
    </div>` : '';

  return `
    <div class="vault-market-rows">${rows}</div>
    ${rarityHtml}
    <div style="font-size:0.74rem;color:var(--text-dim);margin-top:10px">
      Based on ${totalReports} contributor reports. Outliers removed.
    </div>`;
}


// ============================================================
//  PREFERENCES PAGE — OPT-IN TOGGLE ROW
//  Call vaultRenderPrefsRow(containerEl) from buildPrefsPage()
// ============================================================

function vaultRenderPrefsRow(containerEl) {
  if (!containerEl) return;
  const isIn = vaultIsOptedIn();
  containerEl.innerHTML = `
    <div class="vault-prefs-row">
      <div>
        <div style="color:var(--text);font-size:0.9rem;font-weight:600;margin-bottom:3px">
          Collector's Market Est.
        </div>
        <div style="color:var(--text-mid);font-size:0.82rem;line-height:1.5">
          ${isIn
            ? 'You are contributing anonymously. Thank you — your data helps the whole community.'
            : 'Contribute your collection data anonymously to unlock crowd-sourced market values and rarity scores.'}
        </div>
      </div>
      <button onclick="vaultShowOptInModal(true)" style="
        padding:8px 16px;border-radius:7px;white-space:nowrap;flex-shrink:0;
        border:1px solid var(--border);
        background:${isIn ? 'none' : 'var(--accent)'};
        color:${isIn ? 'var(--text-mid)' : '#fff'};
        font-family:var(--font-body);font-size:0.83rem;cursor:pointer
      ">${isIn ? 'Manage / Opt Out' : 'Learn More &amp; Opt In'}</button>
    </div>`;
}


// ============================================================
//  TOAST NOTIFICATION
// ============================================================

function vaultShowToast(message) {
  const existing = document.getElementById('vault-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'vault-toast';
  toast.style.cssText = `
    position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
    background:var(--surface);border:1px solid var(--border);
    color:var(--text);font-family:var(--font-body);font-size:0.86rem;
    padding:12px 22px;border-radius:10px;z-index:99999;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
    animation:vaultToastIn 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}


// ============================================================
//  COLLECTOR'S MARKET PAGE
//  Renders the full feature page into #page-vault
// ============================================================

function vaultRenderPage() {
  const el = document.getElementById('page-vault');
  if (!el) return;

  const isIn = vaultIsOptedIn();

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:var(--font-body)">

      <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--text);letter-spacing:0.04em;margin-bottom:4px">
        Collector's Market
      </div>
      <div style="font-size:0.78rem;color:var(--accent);font-family:var(--font-head);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px">
        Community Intelligence for Collectors
      </div>

      <p style="color:var(--text-mid);font-size:0.88rem;line-height:1.75;margin-bottom:24px">
        The Collector's Market is built entirely from data contributed by collectors like you.
        The more collectors who participate, the more accurate and valuable it becomes for everyone.
        All data is submitted anonymously — your name, email, and identity are never attached.
      </p>

      <!-- Feature cards -->
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px">

        <div class="vault-feature-card">
          <div class="vault-feature-icon">💰</div>
          <div>
            <div class="vault-feature-title">User Market Value</div>
            <div class="vault-feature-desc">
              The average estimated worth and actual sale prices submitted by collectors across the community.
              The more contributors, the more accurate the number — real data, not guesswork.
            </div>
          </div>
        </div>

        <div class="vault-feature-card">
          <div class="vault-feature-icon">📈</div>
          <div>
            <div class="vault-feature-title">Buy / Sale Trends</div>
            <div class="vault-feature-desc">
              See what's actively being bought and sold across all user collections.
              Know which items are hot right now and which ones are sitting — useful intel when you're buying or timing a sale.
            </div>
          </div>
        </div>

        <div class="vault-feature-card">
          <div class="vault-feature-icon">🔍</div>
          <div>
            <div class="vault-feature-title">User Rarity</div>
            <div class="vault-feature-desc">
              Rarity is calculated from real collection data — how many of an item appear across all collections
              divided by the number of collectors in the app. As more collectors join, rarity scores become
              more meaningful.
            </div>
          </div>
        </div>

      </div>

      <!-- Progress bar -->
      <div id="vault-progress-wrap" style="margin-bottom:28px"></div>

      <!-- What gets submitted -->
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 18px;margin-bottom:28px;border:1px solid var(--border)">
        <div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-head)">What gets submitted</div>
        <div style="font-size:0.84rem;color:var(--text-mid);line-height:2">
          ✓ &nbsp;Item number and variation<br>
          ✓ &nbsp;Condition grade<br>
          ✓ &nbsp;Your estimated worth<br>
          ✓ &nbsp;Sold price (if recorded)<br>
          ✗ &nbsp;<span style="color:var(--text)">Your name, email, or any identifying information — never</span>
        </div>
      </div>

      <!-- Opt-in / opt-out -->
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${!isIn ? `
          <button onclick="vaultConfirmOptIn();vaultRenderPage();vaultRenderFloatingBadge()" style="
            flex:1;padding:12px 20px;border-radius:8px;border:none;
            background:var(--accent);color:#fff;font-family:var(--font-body);
            font-size:0.9rem;font-weight:600;cursor:pointer;min-width:160px
          ">Yes, I'll Contribute</button>
        ` : `
          <div style="flex:1;padding:12px 16px;border-radius:8px;background:rgba(58,158,104,0.12);border:1px solid rgba(58,158,104,0.3);color:#3a9e68;font-size:0.88rem;line-height:1.5">
            ✓ You are contributing anonymously. Thank you — your data helps the whole community.
          </div>
          <button onclick="vaultConfirmOptOut()" style="
            padding:12px 18px;border-radius:8px;
            border:1px solid var(--border);background:none;
            color:var(--text-mid);font-family:var(--font-body);
            font-size:0.85rem;cursor:pointer;white-space:nowrap
          ">Opt Out &amp; Delete My Data</button>
        `}
      </div>

    </div>`;

  // Load contributor count into progress bar
  vaultLoadContributorCount();
}


// ============================================================
//  FLOATING BADGE
//  Small bottom-right pill for users not yet opted in.
//  Disappears once opted in.
// ============================================================

function vaultRenderFloatingBadge() {
  const existing = document.getElementById('vault-float-badge');
  if (existing) existing.remove();

  // Don't show badge if already opted in
  if (vaultIsOptedIn()) return;

  const badge = document.createElement('div');
  badge.id = 'vault-float-badge';
  badge.className = 'vault-float-badge';
  badge.innerHTML = `<span style="opacity:0.7">🏪</span> Collector's Market`;
  badge.onclick = () => {
    // Navigate to the vault page
    const btn = document.querySelector('[data-page="vault"]');
    if (btn) btn.click();
    badge.remove();
  };
  document.body.appendChild(badge);
}


// ============================================================
//  INIT — called after user logs in successfully
//  Add this call to the end of your login success handler
//  in app.js:  vaultInit();
// ============================================================

async function vaultInit() {
  // Generate token if not exists (harmless for non-opted-in users)
  vaultGetToken();

  // Load contributor count for progress bar (always — no opt-in needed)
  vaultLoadContributorCount();

  // If opted in, submit data in background
  if (vaultIsOptedIn()) {
    // Small delay so app data is fully loaded first
    setTimeout(() => vaultSubmitData(), 3000);
  }
}
