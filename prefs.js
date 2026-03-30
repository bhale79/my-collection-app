// ═══════════════════════════════════════════════════════════════
// PREFERENCES — buildPrefsPage, health check, admin tools
// Loaded after app.js. Reads from state, _prefGet, _prefSet.
// ═══════════════════════════════════════════════════════════════

function buildPrefsPage() {
  const el = document.getElementById('prefs-content');
  if (!el) return;

  const u = state.user || {};
  const sheetId = state.personalSheetId || '';
  const cacheTs = parseInt(localStorage.getItem('lv_personal_cache_ts') || '0');
  const cacheDateStr = cacheTs ? new Date(cacheTs).toLocaleString() : 'Not cached';
  const cacheSize = (() => { try { return (JSON.stringify(JSON.parse(localStorage.getItem('lv_personal_cache')||'{}')).length / 1024).toFixed(1) + ' KB'; } catch(e) { return '—'; } })();

  const toggle = (id, key, def='false') => `
    <label class="pref-toggle" title="${id}">
      <input type="checkbox" id="ptog-${id}" ${_prefGet(key, def) === 'true' ? 'checked' : ''}
        onchange="_prefSet('${key}', this.checked?'true':'false'); _onPrefChange('${id}', this.checked)">
      <div class="pref-toggle-track"></div>
    </label>`;

  const avatarHtml = u.picture
    ? `<div class="pref-avatar"><img src="${u.picture}" alt="${u.name||''}"></div>`
    : `<div class="pref-avatar">${(u.name||'?')[0].toUpperCase()}</div>`;

  el.innerHTML = `

    <!-- ── 1. Account ─────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Account</div>
      <div class="pref-account-card">
        ${avatarHtml}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.95rem;color:var(--text)">${u.name || 'Not signed in'}</div>
          <div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">${u.email || ''}</div>
        </div>
        <button class="pref-btn danger" onclick="handleSignOut()">Sign Out</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>My Collection Sheet</strong>
          <span>Open your Google Sheet — read-only recommended</span>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-shrink:0">
          <a id="nav-sheet-link-p" href="${sheetId ? 'https://docs.google.com/spreadsheets/d/'+sheetId : '#'}" target="_blank"
            class="pref-btn" onclick="return _sheetLinkClick(event)" style="text-decoration:none">Open ↗</a>
        </div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Sheet ID</strong>
          <span id="pref-sheet-id" style="font-family:var(--font-mono);font-size:0.72rem;word-break:break-all">${sheetId || 'Not connected'}</span>
        </div>
        <button class="pref-btn" onclick="navigator.clipboard?.writeText('${sheetId}').then(()=>showToast('Copied'))">Copy</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Rebuild Dashboard Tab</strong>
          <span>Updates branding and mascot image on your Google Sheet's Dashboard tab</span>
        </div>
        <button class="pref-btn" onclick="_rebuildDashboardTab()">Rebuild</button>
      </div>
    </div>

    <!-- ── 2. Collection Settings ─────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Collection Settings</div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Track Storage Location</strong>
          <span>Adds a location step in the entry wizard</span>
        </div>
        ${toggle('location', 'lv_location_enabled', 'false')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Track Year Made</strong>
          <span>Adds a "Year Made" step when adding items</span>
        </div>
        ${toggle('yearMade', 'lv_year_made_enabled', 'true')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Show Quick Entry badge ⚡</strong>
          <span>Highlights items with incomplete details</span>
        </div>
        ${toggle('qeBadge', 'lv_qe_badge_enabled', 'true')}
      </div>

      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default: All Original</strong>
          <span>Pre-selected answer when adding an item</span>
        </div>
        <select class="pref-select" onchange="_prefSet('lv_def_allOriginal', this.value)">
          <option value="Yes" ${_prefGet('lv_def_allOriginal','Yes')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_allOriginal','Yes')==='No'?'selected':''}>No</option><option value="Unknown" ${_prefGet('lv_def_allOriginal','Yes')==='Unknown'?'selected':''}>Unknown</option>
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default: Has Box</strong>
          <span>Pre-selected answer when adding an item</span>
        </div>
        <select class="pref-select" onchange="_prefSet('lv_def_hasBox', this.value)">
          <option value="Yes" ${_prefGet('lv_def_hasBox','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_hasBox','No')==='No'?'selected':''}>No</option>
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default: Instruction Sheet</strong>
          <span>Pre-selected answer when adding an item</span>
        </div>
        <select class="pref-select" onchange="_prefSet('lv_def_hasIS', this.value)">
          <option value="Yes" ${_prefGet('lv_def_hasIS','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_hasIS','No')==='No'?'selected':''}>No</option>
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default: Error Item</strong>
          <span>Pre-selected answer when adding an item</span>
        </div>
        <select class="pref-select" onchange="_prefSet('lv_def_isError', this.value)">
          <option value="Yes" ${_prefGet('lv_def_isError','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_isError','No')==='No'?'selected':''}>No</option>
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default: Master (Outer) Box</strong>
          <span>Pre-selected answer when adding an item</span>
        </div>
        <select class="pref-select" onchange="_prefSet('lv_def_masterBox', this.value)">
          <option value="Yes" ${_prefGet('lv_def_masterBox','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_masterBox','No')==='No'?'selected':''}>No</option>
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default Condition</strong>
          <span>Starting value for the condition slider in the wizard</span>
        </div>
        <select class="pref-select" id="pref-def-cond" onchange="_prefSet('lv_default_cond', this.value)">
          ${[...Array(10)].map((_,i)=>{const v=i+1; return `<option value="${v}" ${_prefGet('lv_default_cond','7')===String(v)?'selected':''}>${v} — ${['','Heavily worn','Very rough','Worn','Good','Good Plus','Very Good','VG+','Excellent','Exc+','Mint'][v]}</option>`;}).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Items Per Page</strong>
          <span>How many items show in the browse list at once</span>
        </div>
        <select class="pref-select" id="pref-page-size" onchange="_prefSet('lv_page_size', this.value); state.pageSize=parseInt(this.value); state.currentPage=1; if(document.getElementById('page-browse').classList.contains('active')) renderBrowse()">
          ${[25,50,100,200].map(n=>`<option value="${n}" ${_prefGet('lv_page_size','50')===String(n)?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- ── 2b. Add-Item Categories ────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Add-Item Categories</div>
      <div style="font-size:0.78rem;color:var(--text-dim);padding:0 0.2rem 0.5rem;line-height:1.4">Choose which buttons appear on the "What would you like to add?" screen.</div>
      ${_buildWizCatToggles()}
    </div>

    <!-- ── 3. Display ─────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Display</div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Theme</strong>
          <span>App color scheme</span>
        </div>
        <select class="pref-select" id="pref-theme" onchange="_prefSet('lv_theme', this.value); applyTheme(); buildPrefsPage()">
          ${['dark','light','system'].map(t=>`<option value="${t}" ${_prefGet('lv_theme','dark')===t?'selected':''}>${{dark:'🌙 Dark',light:'☀️ Light',system:'💻 System'}[t]}</option>`).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Currency Symbol</strong>
          <span>Shown next to prices throughout the app</span>
        </div>
        <select class="pref-select" id="pref-currency" onchange="_prefSet('lv_currency', this.value)">
          ${['$','€','£','¥','CA$','AU$'].map(c=>`<option value="${c}" ${_prefGet('lv_currency','$')===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Date Format</strong>
          <span>How dates appear in reports and detail views</span>
        </div>
        <select class="pref-select" id="pref-datefmt" onchange="_prefSet('lv_date_fmt', this.value)">
          ${[['MM/DD/YYYY','MM/DD/YYYY'],['DD/MM/YYYY','DD/MM/YYYY'],['YYYY-MM-DD','YYYY-MM-DD']].map(([v,l])=>`<option value="${v}" ${_prefGet('lv_date_fmt','MM/DD/YYYY')===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Upgrade Condition Threshold</strong>
          <span>Flag owned items below this condition as upgrade candidates</span>
        </div>
        <select class="pref-select" id="pref-upgrade-thresh" onchange="_prefSet('lv_upgrade_thresh', this.value)">
          <option value="1" id="ut-1">1 or below</option>
          <option value="2" id="ut-2">2 or below</option>
          <option value="3" id="ut-3">3 or below</option>
          <option value="4" id="ut-4">4 or below</option>
          <option value="5" id="ut-5">5 or below</option>
          <option value="6" id="ut-6">6 or below</option>
          <option value="7" id="ut-7" selected>7 or below</option>
          <option value="8" id="ut-8">8 or below</option>
          <option value="9" id="ut-9">9 or below</option>
        </select>
        <script>
          (function(){ var s=document.getElementById('pref-upgrade-thresh'); if(s){ var v=localStorage.getItem('lv_upgrade_thresh')||'7'; s.value=v; } })();
        </script>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Show Accuracy Disclaimer</strong>
          <span>Warning banner on Master Catalog and Complete Sets pages</span>
        </div>
        ${toggle('disclaimer', 'lv_show_disclaimer', 'true')}
      </div>
    </div>

    <!-- ── 4. Data & Backup ───────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Data &amp; Backup</div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Export Full Collection</strong>
          <span>Download everything as a CSV spreadsheet</span>
        </div>
        <button class="pref-btn" onclick="exportFullCollection()">Download CSV</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Last Synced</strong>
          <span id="pref-cache-ts">${cacheDateStr} · ${cacheSize}</span>
        </div>
        <button class="pref-btn" onclick="forceRefreshData().then(()=>buildPrefsPage())">Sync Now</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Clear Local Cache</strong>
          <span>Forces a full reload from Google Sheets on next launch</span>
        </div>
        <button class="pref-btn danger" onclick="_clearCacheOnly()">Clear Cache</button>
      </div>
    </div>

    <!-- ── 5. About ───────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Dashboard Cards</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6">
          You can have up to <strong style="color:var(--text)">5 stat cards</strong> on your dashboard. Click any card on the dashboard to change what it shows, or click the <strong style="color:var(--text)">+ Add card</strong> button to add a new one.
        </div>
        <button onclick="showPage('dashboard', document.querySelector('.nav-item[onclick*=dashboard]')); setTimeout(function(){ _openCardPopup(${_getSlots().indexOf(null) >= 0 ? _getSlots().indexOf(null) : 0}); }, 150);" style="padding:0.35rem 0.8rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.8rem;cursor:pointer;margin-top:0.2rem">
          Go to Dashboard →
        </button>
      </div>
    </div>

    <!-- ── Collector's Market Est. ───────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Collector's Market Est.</div>
      <div id="vault-prefs-row"></div>
    </div>

    <div class="pref-section" id="admin-health-section" style="display:none">
      <div class="pref-section-title">App Health Check</div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Run Health Check</strong><span>Verify all app functions and data are wired up correctly</span></div>
        <button class="pref-btn" id="health-check-btn" onclick="_runHealthCheck()">Run Check</button>
      </div>
      <div class="pref-row" style="margin-top:0.25rem">
        <div class="pref-row-label"><strong>Copy to Console</strong><span>Copy the script &mdash; paste into browser console (F12) for detailed output</span></div>
        <button class="pref-btn" id="hc-copy-btn" onclick="_copyHealthCheckScript()">Copy Script</button>
      </div>
      <div id="health-check-output" style="display:none;margin-top:0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:0.85rem 1rem;font-size:0.75rem;font-family:var(--font-mono);line-height:1.8;max-height:320px;overflow-y:auto"></div>
      <div class="pref-row" style="margin-top:0.25rem">
        <div class="pref-row-label"><strong>Backfill Inventory IDs</strong><span>Fix legacy For Sale / Sold / Upgrade entries missing per-copy Inventory IDs</span></div>
        <button class="pref-btn" id="backfill-invid-btn" onclick="_runBackfillInventoryIds()">Run Backfill</button>
      </div>
      <div id="backfill-invid-output" style="display:none;margin-top:0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:0.85rem 1rem;font-size:0.75rem;font-family:var(--font-mono);line-height:1.8;max-height:320px;overflow-y:auto"></div>
      <div class="pref-row" style="margin-top:0.25rem">
        <div class="pref-row-label"><strong>Backfill All Collection IDs</strong><span>Assign Inventory IDs to any My Collection, IS, Science, Construction, or My Sets rows missing them</span></div>
        <button class="pref-btn" id="backfill-all-btn" onclick="_runBackfillAllIds()">Run Backfill</button>
      </div>
      <div id="backfill-all-output" style="display:none;margin-top:0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:0.85rem 1rem;font-size:0.75rem;font-family:var(--font-mono);line-height:1.8;max-height:320px;overflow-y:auto"></div>
    </div>

        <div class="pref-section">
      <div class="pref-section-title">About</div>
        <div class="pref-row">
        <div class="pref-row-label"><strong>The Rail Roster</strong><span>${APP_VERSION} · ${APP_DATE}</span></div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Master Catalog</strong>
          <span id="pref-catalog-count">${state.masterData?.length?.toLocaleString() || '—'} items loaded</span>
        </div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Send Feedback</strong>
          <span>Report a bug or suggest a feature</span>
        </div>
        <a href="mailto:bhale@ipd-llc.com?subject=The Rail Roster Feedback" class="pref-btn" style="text-decoration:none">Email ↗</a>
      </div>
    </div>`;

  // Keep hidden pref-location-toggle in sync (used by wizard)
  const locTog = document.getElementById('ptog-location');
  const oldTog = document.getElementById('pref-location-toggle');
  if (oldTog && locTog) oldTog.checked = locTog.checked;

  // Render Collector's Market opt-in row
  if (typeof vaultRenderPrefsRow === 'function') {
    vaultRenderPrefsRow(document.getElementById('vault-prefs-row'));
  }
  _maybeShowAdminPrefs();
}


function _runHealthCheck() {
  var out = document.getElementById("health-check-output");
  var btn = document.getElementById("health-check-btn");
  if (!out) return;
  out.style.display = "block";
  out.innerHTML = "<span style='color:var(--text-dim)'>Running checks...</span>";
  if (btn) { btn.disabled = true; btn.textContent = "Running..."; }
  setTimeout(function() {
    var results = [];
    function pass(l,d){results.push({s:"pass",l:l,d:d});}
    function fail(l,d){results.push({s:"fail",l:l,d:d});}
    function warn(l,d){results.push({s:"warn",l:l,d:d});}
    ["showPage","renderBrowse","buildDashboard","buildWantPage","buildForSalePage","buildSoldPage",
     "buildQuickEntryList","showItemDetailPage","updateCollectionItem","removeCollectionItem",
     "loadPersonalData","sheetsAppend","sheetsDeleteRow","driveUploadItemPhoto","driveEnsureSetup",
     "collectionActionForSale","collectionActionSold","showAddToUpgradeModal"
    ].forEach(function(fn){typeof window[fn]==="function"?pass(fn+"()"):fail(fn+"()","Not found");});
    ["openWizard","quickEntryAdd","closeWizard","saveItem","launchSetItemWizard","_showQuickEntryMultiUI"
    ].forEach(function(fn){typeof window[fn]==="function"?pass(fn+"()"):fail(fn+"()","wizard.js may not have loaded");});
    ["vaultInit","vaultSubmitData","vaultIsOptedIn","vaultRenderMarketCard","vaultRenderPrefsRow"
    ].forEach(function(fn){typeof window[fn]==="function"?pass(fn+"()"):warn(fn+"()","vault.js non-critical");});
    if (typeof state === "undefined") {
      fail("state object","Not defined");
    } else {
      pass("state object");
      if (state.personalSheetId) pass("personalSheetId", state.personalSheetId.substring(0,16)+"..."); else fail("personalSheetId","null - not signed in?");
      if (state.masterData && state.masterData.length) pass("masterData", state.masterData.length.toLocaleString()+" items"); else fail("masterData","Empty");
      if (state.personalData && Object.keys(state.personalData).length) pass("personalData", Object.keys(state.personalData).length+" items"); else warn("personalData","Empty");
    }
    var tok = localStorage.getItem("lv_token"), exp = parseInt(localStorage.getItem("lv_token_expiry")||"0");
    if (!tok) warn("accessToken","No token - sign in again");
    else if (exp < Date.now()) warn("accessToken","Expired - will refresh on next action");
    else pass("accessToken","Valid ~"+Math.round((exp-Date.now())/60000)+" min");
    if (typeof driveCache !== "undefined") {
      if (driveCache.photosId) pass("driveCache.photosId"); else warn("driveCache.photosId","Not set");
      if (driveCache.vaultId) pass("driveCache.vaultId"); else warn("driveCache.vaultId","Not set");
    } else { fail("driveCache","Not defined"); }
    ["page-browse","page-dashboard","page-quickentry","browse-tbody","result-count","page-info","wizard-modal"
    ].forEach(function(id){document.getElementById(id)?pass("#"+id):fail("#"+id,"Missing from DOM");});
    if (typeof state !== "undefined" && state.personalData) {
      var samp = Object.values(state.personalData).filter(function(p){return p.owned;}).slice(0,3);
      if (samp.length) {
        if (samp.some(function(p){return "userEstWorth" in p;})) pass("col N: userEstWorth"); else warn("col N: userEstWorth","Not found");
        if (samp.some(function(p){return "photoItem" in p;})) pass("col J: photoItem"); else warn("col J: photoItem","Not found");
      }
    }
    var passes=results.filter(function(r){return r.s==="pass";}).length;
    var fails=results.filter(function(r){return r.s==="fail";}).length;
    var warns=results.filter(function(r){return r.s==="warn";}).length;
    var sc=fails>0?"#e74c3c":warns>0?"#d4a843":"#3a9e68";
    var st=fails>0?fails+" issue(s) found":warns>0?"Minor warnings only":"All systems go!";
    var html="<div style='font-weight:700;color:"+sc+";margin-bottom:0.6rem;font-size:0.82rem'>"+passes+" passed &middot; "+fails+" failed &middot; "+warns+" warnings &mdash; "+st+"</div>";
    results.forEach(function(r) {
      var icon = r.s==="pass" ? "&#9989;" : r.s==="fail" ? "&#10060;" : "&#9888;";
      var c = r.s==="pass"?"#3a9e68":r.s==="fail"?"#e74c3c":"#d4a843";
      html += "<div style='color:"+c+"'>"+icon+" "+r.l+(r.d?" <span style='color:var(--text-dim);font-size:0.7rem'>&rarr; "+r.d+"</span>":"")+"</div>";
    });
    out.innerHTML = html;
    if (btn) { btn.disabled = false; btn.textContent = "Run Again"; }
  }, 50);
}

var _HEALTH_CHECK_SCRIPT = "// ============================================================\n//  The Rail Roster \u2014 Health Check\n//  Paste this entire block into your browser console while\n//  the app is open. It will print a wiring report in ~2 seconds.\n//  Last updated: Session 51\n// ============================================================\n\n(function() {\n  const OK  = '\u2705';\n  const ERR = '\u274c';\n  const WARN = '\u26a0\ufe0f';\n  const results = [];\n\n  function pass(label, detail) { results.push({ s: OK,   l: label, d: detail }); }\n  function fail(label, detail) { results.push({ s: ERR,  l: label, d: detail }); }\n  function warn(label, detail) { results.push({ s: WARN, l: label, d: detail }); }\n\n  // \u2500\u2500 1. Core functions exist \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const coreFns = [\n    'showPage', 'renderBrowse', 'buildDashboard', 'buildWantPage',\n    'buildForSalePage', 'buildSoldPage', 'buildQuickEntryList',\n    'showItemDetailPage', 'updateCollectionItem', 'removeCollectionItem',\n    'loadPersonalData', 'sheetsAppend', 'sheetsDeleteRow',\n    'driveUploadItemPhoto', 'driveEnsureSetup',\n    'collectionActionForSale', 'collectionActionSold',\n    'showAddToUpgradeModal',\n  ];\n  coreFns.forEach(fn => {\n    if (typeof window[fn] === 'function') pass(fn + '()');\n    else fail(fn + '()', 'NOT FOUND \u2014 may be broken or renamed');\n  });\n\n  // \u2500\u2500 2. Wizard functions exist \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const wizardFns = [\n    'quickEntryAdd', 'closeWizard', 'saveItem', 'openWizard',\n    'launchSetItemWizard', '_showQuickEntryMultiUI',\n  ];\n  wizardFns.forEach(fn => {\n    if (typeof window[fn] === 'function') pass(fn + '()');\n    else fail(fn + '()', 'NOT FOUND \u2014 wizard.js may not have loaded or function renamed');\n  });\n\n  // \u2500\u2500 3. Vault functions exist \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const vaultFns = [\n    'vaultInit', 'vaultSubmitData', 'vaultIsOptedIn',\n    'vaultRenderMarketCard', 'vaultRenderPrefsRow', 'vaultShowOptInModal',\n  ];\n  vaultFns.forEach(fn => {\n    if (typeof window[fn] === 'function') pass(fn + '()');\n    else warn(fn + '()', 'Not found \u2014 vault.js may not have loaded (non-critical)');\n  });\n\n  // \u2500\u2500 4. Tutorial functions exist \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const tutFns = ['tutNext'];\n  tutFns.forEach(fn => {\n    if (typeof window[fn] === 'function') pass(fn + '()');\n    else warn(fn + '()', 'Not found \u2014 tutorial.js may not have loaded (non-critical)');\n  });\n\n  // \u2500\u2500 5. State object is populated \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  if (typeof state === 'undefined') {\n    fail('state object', 'state is not defined \u2014 app.js likely failed to load');\n  } else {\n    pass('state object exists');\n\n    if (state.personalSheetId)\n      pass('state.personalSheetId', state.personalSheetId.substring(0,20) + '\u2026');\n    else\n      fail('state.personalSheetId', 'null \u2014 user may not be signed in or config not found');\n\n    if (state.masterData && state.masterData.length > 0)\n      pass('state.masterData', state.masterData.length.toLocaleString() + ' items loaded');\n    else\n      fail('state.masterData', 'Empty or not loaded');\n\n    if (state.personalData && Object.keys(state.personalData).length > 0)\n      pass('state.personalData', Object.keys(state.personalData).length + ' personal items loaded');\n    else\n      warn('state.personalData', 'Empty \u2014 expected if collection is empty or not yet loaded');\n\n    const filters = ['type','road','owned','search','quickEntry'];\n    const missingFilters = filters.filter(f => !(f in (state.filters || {})));\n    if (missingFilters.length === 0) pass('state.filters');\n    else warn('state.filters', 'Missing keys: ' + missingFilters.join(', '));\n  }\n\n  // \u2500\u2500 6. Auth / token \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const token = localStorage.getItem('lv_token');\n  const expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');\n  if (!token) {\n    warn('accessToken', 'No token in localStorage \u2014 user may need to sign in');\n  } else if (expiry < Date.now()) {\n    warn('accessToken', 'Token is expired \u2014 will refresh on next action');\n  } else {\n    const mins = Math.round((expiry - Date.now()) / 60000);\n    pass('accessToken', 'Valid for ~' + mins + ' more minutes');\n  }\n\n  // \u2500\u2500 7. Drive cache \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  if (typeof driveCache !== 'undefined') {\n    if (driveCache.photosId) pass('driveCache.photosId', driveCache.photosId);\n    else warn('driveCache.photosId', 'Not set \u2014 Drive setup may not have run yet');\n    if (driveCache.vaultId) pass('driveCache.vaultId', driveCache.vaultId);\n    else warn('driveCache.vaultId', 'Not set');\n  } else {\n    fail('driveCache', 'Not defined \u2014 app.js may not have loaded');\n  }\n\n  // \u2500\u2500 8. localStorage keys \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const lsKeys = [\n    'lv_token', 'lv_personal_id', 'lv_vault_id',\n    'lv_photos_id', 'lv_personal_cache_ts'\n  ];\n  const presentKeys = lsKeys.filter(k => !!localStorage.getItem(k));\n  const missingKeys = lsKeys.filter(k => !localStorage.getItem(k));\n  if (missingKeys.length === 0)\n    pass('localStorage keys', 'All ' + lsKeys.length + ' expected keys present');\n  else if (missingKeys.length <= 2)\n    warn('localStorage keys', 'Missing: ' + missingKeys.join(', '));\n  else\n    fail('localStorage keys', 'Many missing: ' + missingKeys.join(', ') + ' \u2014 may need to sign in');\n\n  // \u2500\u2500 9. Critical DOM elements \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const domIds = [\n    'page-browse', 'page-dashboard', 'page-quickentry',\n    'browse-tbody', 'result-count', 'page-info',\n    'wizard-modal',\n  ];\n  domIds.forEach(id => {\n    if (document.getElementById(id)) pass('#' + id + ' DOM element');\n    else fail('#' + id + ' DOM element', 'Not found in DOM \u2014 index.html may be out of sync');\n  });\n\n  // \u2500\u2500 10. Column mapping sanity check \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  if (typeof state !== 'undefined' && state.personalData) {\n    const samples = Object.values(state.personalData).filter(pd => pd.owned).slice(0, 3);\n    if (samples.length) {\n      const hasEstWorth = samples.some(pd => 'userEstWorth' in pd);\n      const hasPhotoItem = samples.some(pd => 'photoItem' in pd);\n      const hasCondition = samples.some(pd => 'condition' in pd);\n      if (hasEstWorth) pass('personalData.userEstWorth field present');\n      else warn('personalData.userEstWorth', 'Not found on any owned items \u2014 column mapping may be off');\n      if (hasPhotoItem) pass('personalData.photoItem field present');\n      else warn('personalData.photoItem', 'Not found \u2014 photo column may be wrong');\n      if (hasCondition) pass('personalData.condition field present');\n      else warn('personalData.condition', 'Not found');\n    }\n  }\n\n  // \u2500\u2500 Print report \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const passes = results.filter(r => r.s === OK).length;\n  const fails  = results.filter(r => r.s === ERR).length;\n  const warns  = results.filter(r => r.s === WARN).length;\n\n  console.group('%c The Rail Roster \u2014 Health Check Report', 'font-size:14px;font-weight:bold;color:#f05008');\n  console.log('%c ' + passes + ' passed  |  ' + fails + ' failed  |  ' + warns + ' warnings',\n    'font-size:12px;color:' + (fails > 0 ? '#e74c3c' : warns > 0 ? '#d4a843' : '#3a9e68'));\n  console.log('\u2500'.repeat(60));\n\n  results.forEach(r => {\n    const style = r.s === OK ? 'color:#3a9e68' : r.s === ERR ? 'color:#e74c3c;font-weight:bold' : 'color:#d4a843';\n    if (r.d)\n      console.log('%c' + r.s + ' ' + r.l, style, '\\n    \u2192 ' + r.d);\n    else\n      console.log('%c' + r.s + ' ' + r.l, style);\n  });\n\n  console.log('\u2500'.repeat(60));\n  if (fails === 0 && warns === 0)\n    console.log('%c All systems go! \ud83d\ude82', 'color:#3a9e68;font-size:13px;font-weight:bold');\n  else if (fails === 0)\n    console.log('%c Minor warnings only \u2014 app should work normally', 'color:#d4a843');\n  else\n    console.log('%c ' + fails + ' critical issue(s) found \u2014 check \u274c items above', 'color:#e74c3c;font-weight:bold');\n\n  console.groupEnd();\n})();\n";

function _copyHealthCheckScript() {
  var btn = document.getElementById("hc-copy-btn");
  function _flash() {
    if (btn) { btn.textContent = "Copied! ✓"; btn.style.background = "#27ae60"; btn.style.color = "#fff"; }
    setTimeout(function() { if (btn) { btn.textContent = "Copy Script"; btn.style.background = ""; btn.style.color = ""; } }, 2500);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(_HEALTH_CHECK_SCRIPT).then(_flash).catch(function() {
      var ta = document.createElement("textarea");
      ta.value = _HEALTH_CHECK_SCRIPT;
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      _flash();
    });
  } else {
    var ta = document.createElement("textarea");
    ta.value = _HEALTH_CHECK_SCRIPT;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    _flash();
  }
}

var _QA_ITEMS = [
  { section: '🔐 Auth & Login', items: [
    { id: 'auth-load',   label: 'App loads without errors', hint: 'Open the app. No red error banners, no blank screen.' },
    { id: 'auth-login',  label: 'Google sign-in works', hint: 'Tap Sign in with Google. You are taken to your dashboard.' },
    { id: 'auth-dash',   label: 'Dashboard shows correct counts', hint: 'Collection count, want list count, and quick entry count all show.' },
  ]},
  { section: '📋 My Collection List', items: [
    { id: 'coll-load',   label: 'My Collection list loads', hint: 'Tap My Collection from sidebar. Items appear.' },
    { id: 'coll-cols',   label: 'All 6 columns visible: Item # | Var. | Type | Description | Est. Worth | Actions', hint: 'Type and Est. Worth columns should be present.' },
    { id: 'coll-filter', label: 'Type and Road filters work', hint: 'Select a type (e.g. Steam). List narrows correctly.' },
    { id: 'coll-search', label: 'Search box filters results', hint: 'Type a partial item number. Matching rows appear.' },
    { id: 'coll-detail', label: 'Tapping a row opens item detail page', hint: 'Tap any row. Item detail page opens with full info.' },
  ]},
  { section: '⚡ Quick Entry', items: [
    { id: 'qe-open',       label: 'Quick Entry list loads', hint: 'Tap Quick Entry List in sidebar. Shows any pending items.' },
    { id: 'qe-save-basic', label: 'Quick Entry saves (fast save)', hint: 'Tap card with no boxes checked. Toast confirms save. Item appears in collection.' },
    { id: 'qe-worth-save', label: 'Est. Worth saves to sheet column N', hint: 'Enter a value, tap Confirm & Save. Column N in Google Sheets should show the value.' },
    { id: 'qe-photo-save', label: 'Photo saves to Drive (column J)', hint: 'Take a photo, save. Column J should have a Drive folder link.' },
    { id: 'qe-addinfo',    label: 'Add Info opens wizard pre-filled', hint: 'Tap Add Info on any quick entry item. Wizard opens with data already filled in.' },
  ]},
  { section: '➕ Full Add Item Wizard', items: [
    { id: 'wiz-open',   label: 'Wizard opens from + Add button', hint: 'Tap the + Add button. Wizard opens on Step 1.' },
    { id: 'wiz-search', label: 'Item number search finds items', hint: 'Type an item number. Matching results appear.' },
    { id: 'wiz-save',   label: 'Full entry saves to My Collection', hint: 'Complete wizard. Toast confirms. Item appears in list.' },
    { id: 'wiz-photo',  label: 'Photo upload in full wizard works', hint: 'Upload a photo. Drive folder link appears in sheet column J.' },
  ]},
  { section: '⭐ Want List', items: [
    { id: 'want-load',   label: 'Want List page loads', hint: 'Tap Want List. Items appear if any are on the list.' },
    { id: 'want-add',    label: 'Adding to Want List works', hint: 'Browse an item, tap Want. Item appears on Want List.' },
    { id: 'want-remove', label: 'Removing from Want List works', hint: 'Tap Remove on a want item. It disappears from list.' },
  ]},
  { section: '🏷️ For Sale & Sold', items: [
    { id: 'fs-action', label: 'For Sale button on collection row works', hint: 'Tap For Sale on any collection item. Form appears.' },
    { id: 'fs-list',   label: 'For Sale list shows the item', hint: 'After marking for sale, go to For Sale list. Item appears.' },
    { id: 'sold-list', label: 'Sold Items list shows the item', hint: 'After marking sold, go to Sold Items list. Item appears.' },
  ]},
  { section: '↑ Upgrade List', items: [
    { id: 'upg-add',  label: 'Add to Upgrade List works', hint: 'Tap Upgrade on a collection item. Confirmation appears.' },
    { id: 'upg-list', label: 'Upgrade List shows the item', hint: 'Go to Upgrade List. Item appears.' },
  ]},
  { section: '🗑️ Remove Item', items: [
    { id: 'rem-confirm', label: 'Remove shows confirmation dialog', hint: 'Tap Remove on a collection item. Confirm dialog appears before anything is deleted.' },
    { id: 'rem-gone',    label: 'Removed item disappears from collection', hint: 'Confirm remove. Item is no longer in My Collection.' },
  ]},
  { section: '🔄 Navigation & General', items: [
    { id: 'nav-sidebar', label: 'All sidebar nav items open correct pages', hint: 'Click each sidebar link. Correct page appears each time.' },
    { id: 'nav-back',    label: 'Browser back button works throughout the app', hint: 'Navigate a few pages deep, hit back. Goes to previous page.' },
    { id: 'nav-prefs',   label: 'Preferences page loads and saves', hint: 'Go to Preferences. Make a change, reload. Change persisted.' },
    { id: 'nav-sync',    label: 'Sync from Sheet refreshes data', hint: 'Tap Sync from Sheet. Data reloads. Dashboard counts update.' },
  ]},
  { section: '📊 Collector\'s Market', items: [
    { id: 'vault-prefs', label: "Collector's Market row appears in Preferences", hint: 'Go to Preferences. Collector\'s Market section with opt-in toggle appears.' },
    { id: 'vault-card',  label: 'Market card appears on item detail (if opted in)', hint: 'If opted in: open an item detail page. Market Est. card appears at bottom.' },
  ]},
];

var _QA_STATE_KEY = 'lv_qa_checklist';

function _isAdmin() {
  return !!(state.user && state.user.email === 'bhale@ipd-llc.com');
}

function _maybeShowAdminPrefs() {
  var sec = document.getElementById('admin-health-section');
  if (sec) sec.style.display = _isAdmin() ? '' : 'none';
}

function _onDashCardToggle(id, checked) {
  let selected = _getDashCards();
  if (checked) {
    if (selected.length >= MAX_CARDS) {
      // Revert checkbox — already at max
      const cb = document.querySelector('#pref-card-label-' + id + ' input');
      if (cb) cb.checked = false;
      return;
    }
    if (!selected.includes(id)) selected.push(id);
  } else {
    selected = selected.filter(function(s) { return s !== id; });
  }
  _setDashCards(selected);
  buildDashboard();

  // Refresh the prefs UI to update disabled states + count msg
  const countMsg = document.getElementById('pref-card-count-msg');
  if (countMsg) {
    const n = selected.filter(function(s){ return s !== 'custom'; }).length;
    countMsg.textContent = n + ' of ' + MAX_CARDS + ' standard cards selected';
  }
  // Update all checkbox disabled states
  CARD_CATALOG.forEach(function(card) {
    const lbl = document.getElementById('pref-card-label-' + card.id);
    if (!lbl) return;
    const cb = lbl.querySelector('input');
    if (!cb) return;
    const isSelected = selected.includes(card.id);
    const isDisabled = !isSelected && selected.length >= MAX_CARDS;
    cb.disabled = isDisabled;
    lbl.style.background = isSelected ? 'rgba(255,255,255,0.05)' : 'transparent';
    lbl.style.borderColor = isSelected ? 'var(--border-light,#3a4870)' : 'transparent';
  });
}

function _onPrefChange(id, val) {
  if (id === 'location') {
    // Keep hidden toggle in sync
    const old = document.getElementById('pref-location-toggle');
    if (old) old.checked = val;
  }
  if (id === 'qeBadge') {
    // Show/hide QE badge in nav
    const b1 = document.getElementById('nav-qe-count');
    const b2 = document.getElementById('mnav-qe-badge');
    const hide = !val;
    if (b1) b1.style.display = hide ? 'none' : '';
    if (b2) b2.style.display = hide ? 'none' : '';
  }
  if (id === 'yearMade') {
    // Stored — wizard reads lv_year_made_enabled at step render time (hooked below)
  }
  if (id === 'disclaimer') {
    _applyDisclaimerPref();
  }
}

function _clearCacheOnly() {
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  showToast('Cache cleared — will reload from sheet on next launch');
  buildPrefsPage();
}

function exportFullCollection() {
  const headers = ['Item #','Variation','Condition','All Original','Price Paid','Box Price','Complete Price','Has Box','Box Condition','Item Photo','Box Photo','Notes','Date Purchased','Est. Worth','Matched To','Set ID','Year Made','Is Error','Error Desc','Inventory ID','Group ID','Location'];
  const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
  const rows = Object.values(state.personalData)
    .filter(pd => pd.owned)
    .sort((a,b) => (a.itemNum||'').localeCompare(b.itemNum||'', undefined, {numeric:true}))
    .map(pd => [
      esc(pd.itemNum), esc(pd.variation||''), esc(pd.condition||''), esc(pd.allOriginal||''),
      esc(pd.priceItem||''), esc(pd.priceBox||''), esc(pd.priceComplete||''),
      esc(pd.hasBox||''), esc(pd.boxCond||''), esc(pd.photoItem||''), esc(pd.photoBox||''),
      esc(pd.notes||''), esc(pd.datePurchased||''), esc(pd.userEstWorth||''),
      esc(pd.matchedTo||''), esc(pd.setId||''), esc(pd.yearMade||''),
      esc(pd.isError||''), esc(pd.errorDesc||''), esc(pd.inventoryId||''),
      esc(pd.groupId||''), esc(pd.location||''),
    ].join(','));
  const dateTag = new Date().toISOString().slice(0,10);
  const csv = headers.map(h=>`"${h}"`).join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`my-collection-${dateTag}.csv`; a.click();
  showToast('✓ Collection exported');
}

// Apply theme on load
applyTheme();
// Watch system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (_prefGet('lv_theme','dark') === 'system') applyTheme();
});

// Apply stored page size on load
(function() {
  const stored = localStorage.getItem('lv_page_size');
  if (stored) state.pageSize = parseInt(stored);
})();

// ── NAVIGATION ─────────────────────────────────────────────────────
// ── EPHEMERA ─────────────────────────────────────────────────────
let _ephCurrentTab = 'catalogs';


// ── Rebuild Dashboard Tab ──────────────────────────────────────
async function _rebuildDashboardTab() {
  if (!state.personalSheetId) {
    showToast('No personal sheet connected', 3000, true);
    return;
  }
  if (typeof _writeDashboardContent !== 'function') {
    showToast('Sheet builder not loaded — refresh and try again', 3000, true);
    return;
  }
  try {
    showToast('Rebuilding Dashboard tab...', 2000);
    await _writeDashboardContent(state.personalSheetId);
    showToast('Dashboard tab updated!');
  } catch(e) {
    console.error('Rebuild dashboard failed:', e);
    showToast('Failed to rebuild: ' + e.message, 4000, true);
  }
}

// ── Backfill Inventory IDs ──────────────────────────────────────
// Finds For Sale / Sold / Upgrade entries with no Inventory ID,
// matches them to the correct My Collection copy, and writes
// the ID back to the sheet.
async function _runBackfillInventoryIds() {
  var btn = document.getElementById('backfill-invid-btn');
  var out = document.getElementById('backfill-invid-output');
  if (!out) return;
  out.style.display = 'block';
  out.innerHTML = '<span style="color:var(--text-dim)">Scanning…</span>';
  if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }

  var lines = [];
  var fixed = 0;
  var skipped = 0;

  try {
    var sheetId = state.personalSheetId;
    if (!sheetId) throw new Error('No personal sheet ID');

    // Build set of inventoryIds already claimed by existing list entries
    var claimed = {};
    Object.values(state.forSaleData || {}).forEach(function(e) { if (e.inventoryId) claimed[e.inventoryId] = 'ForSale'; });
    Object.values(state.soldData || {}).forEach(function(e) { if (e.inventoryId) claimed[e.inventoryId] = 'Sold'; });
    Object.values(state.upgradeData || {}).forEach(function(e) { if (e.inventoryId) claimed[e.inventoryId] = 'Upgrade'; });

    // Helper: find best matching personalData copy
    function findBestMatch(itemNum, variation, claimedSet) {
      var candidates = Object.values(state.personalData).filter(function(pd) {
        return pd.itemNum === itemNum && (pd.variation || '') === (variation || '') && pd.owned;
      });
      if (candidates.length === 0) return null;
      // Prefer a copy whose inventoryId is NOT already claimed
      var unclaimed = candidates.filter(function(c) { return c.inventoryId && !claimedSet[c.inventoryId]; });
      if (unclaimed.length > 0) return unclaimed[0];
      // Fall back to first copy that has an inventoryId at all
      var withId = candidates.filter(function(c) { return !!c.inventoryId; });
      if (withId.length > 0) return withId[0];
      return null;
    }

    // ── For Sale ──
    var fsEntries = Object.keys(state.forSaleData || {});
    for (var i = 0; i < fsEntries.length; i++) {
      var fsKey = fsEntries[i];
      var fs = state.forSaleData[fsKey];
      if (fs.inventoryId) continue; // already has one
      var match = findBestMatch(fs.itemNum, fs.variation, claimed);
      if (match && match.inventoryId) {
        await sheetsUpdate(sheetId, 'For Sale!I' + fs.row, [[match.inventoryId]]);
        fs.inventoryId = match.inventoryId;
        claimed[match.inventoryId] = 'ForSale';
        lines.push('✅ For Sale: ' + fs.itemNum + ' → ' + match.inventoryId);
        fixed++;
      } else {
        lines.push('⚠️ For Sale: ' + fs.itemNum + ' — no matching collection copy found');
        skipped++;
      }
    }

    // ── Sold ──
    var soldEntries = Object.keys(state.soldData || {});
    for (var j = 0; j < soldEntries.length; j++) {
      var soldKey = soldEntries[j];
      var sold = state.soldData[soldKey];
      if (sold.inventoryId) continue;
      var soldMatch = findBestMatch(sold.itemNum, sold.variation, claimed);
      if (soldMatch && soldMatch.inventoryId) {
        await sheetsUpdate(sheetId, 'Sold!I' + sold.row, [[soldMatch.inventoryId]]);
        sold.inventoryId = soldMatch.inventoryId;
        claimed[soldMatch.inventoryId] = 'Sold';
        lines.push('✅ Sold: ' + sold.itemNum + ' → ' + soldMatch.inventoryId);
        fixed++;
      } else {
        lines.push('⚠️ Sold: ' + sold.itemNum + ' — no matching collection copy found');
        skipped++;
      }
    }

    // ── Upgrade ──
    var ugEntries = Object.keys(state.upgradeData || {});
    for (var k = 0; k < ugEntries.length; k++) {
      var ugKey = ugEntries[k];
      var ug = state.upgradeData[ugKey];
      if (ug.inventoryId) continue;
      var ugMatch = findBestMatch(ug.itemNum, ug.variation, claimed);
      if (ugMatch && ugMatch.inventoryId) {
        await sheetsUpdate(sheetId, 'Upgrade List!G' + ug.row, [[ugMatch.inventoryId]]);
        ug.inventoryId = ugMatch.inventoryId;
        claimed[ugMatch.inventoryId] = 'Upgrade';
        lines.push('✅ Upgrade: ' + ug.itemNum + ' → ' + ugMatch.inventoryId);
        fixed++;
      } else {
        lines.push('⚠️ Upgrade: ' + ug.itemNum + ' — no matching collection copy found');
        skipped++;
      }
    }

    if (fixed === 0 && skipped === 0) {
      lines.push('✅ All entries already have Inventory IDs — nothing to fix!');
    } else {
      lines.push('');
      lines.push('Done: ' + fixed + ' fixed, ' + skipped + ' skipped');
    }

    // Refresh browse to update button states
    if (fixed > 0) renderBrowse();

  } catch(e) {
    lines.push('❌ Error: ' + e.message);
    console.error('Backfill error:', e);
  }

  out.innerHTML = lines.join('<br>');
  if (btn) { btn.disabled = false; btn.textContent = 'Run Backfill'; }
}

// ── Backfill All Collection Inventory IDs ──────────────────────
// Assigns inventoryIds to any rows in My Collection, IS, Science,
// Construction, or My Sets that are missing them. This eliminates
// the fallback key paths in the parsers.
async function _runBackfillAllIds() {
  var btn = document.getElementById('backfill-all-btn');
  var out = document.getElementById('backfill-all-output');
  if (!out) return;
  out.style.display = 'block';
  out.innerHTML = '<span style="color:var(--text-dim)">Scanning all tabs…</span>';
  if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }

  var lines = [];
  var fixed = 0;

  try {
    var sheetId = state.personalSheetId;
    if (!sheetId) throw new Error('No personal sheet ID');

    // Tab configs: { dataObj, tabName, idCol }
    var tabs = [
      { data: state.personalData,      tab: 'My Collection',     col: 'U' },
      { data: state.isData,            tab: 'Instruction Sheets', col: 'G' },
      { data: state.scienceData,       tab: 'Science Sets',       col: 'N' },
      { data: state.constructionData,  tab: 'Construction Sets',  col: 'N' },
      { data: state.mySetsData,        tab: 'My Sets',            col: 'N' },
    ];

    for (var t = 0; t < tabs.length; t++) {
      var cfg = tabs[t];
      var dataObj = cfg.data || {};
      var entries = Object.entries(dataObj);
      var tabFixed = 0;

      for (var i = 0; i < entries.length; i++) {
        var key = entries[i][0];
        var rec = entries[i][1];
        if (rec.inventoryId) continue; // already has one
        if (!rec.row || rec.row === 99999) continue; // temp row, skip

        var newId = nextInventoryId();
        try {
          await sheetsUpdate(sheetId, cfg.tab + '!' + cfg.col + rec.row, [[newId]]);
          rec.inventoryId = newId;
          // Re-key the entry: remove old key, insert under inventoryId
          delete dataObj[key];
          dataObj[newId] = rec;
          tabFixed++;
          fixed++;
        } catch(e) {
          lines.push('⚠️ ' + cfg.tab + ' row ' + rec.row + ': ' + e.message);
        }
      }

      if (tabFixed > 0) {
        lines.push('✅ ' + cfg.tab + ': ' + tabFixed + ' IDs assigned');
      } else {
        lines.push('✓ ' + cfg.tab + ': all rows already have IDs');
      }
    }

    if (fixed > 0) {
      _cachePersonalData();
      lines.push('');
      lines.push('Done: ' + fixed + ' total IDs assigned. State updated.');
    } else {
      lines.push('');
      lines.push('All rows already have Inventory IDs — nothing to do.');
    }

  } catch(e) {
    lines.push('❌ Error: ' + e.message);
    console.error('Backfill all error:', e);
  }

  out.innerHTML = lines.join('<br>');
  if (btn) { btn.disabled = false; btn.textContent = 'Run Backfill'; }
}

// ═══════════════════════════════════════════════════════════════
// Wizard Category Preferences
// ═══════════════════════════════════════════════════════════════

function _buildWizCatToggles() {
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('rr_wizard_cats') || '{}'); } catch(e) {}
  var prefs = Object.assign({}, DEFAULT_WIZARD_CATEGORIES, saved);

  var cats = [
    { id: 'lionel',  label: 'Cataloged Item #', desc: 'Train, car, accessory' },
    { id: 'set',     label: 'Complete Set',     desc: 'Outfit box with components' },
    { id: 'paper',   label: 'Paper Item',       desc: 'Catalog, ad, flyer' },
    { id: 'mockups', label: 'Mock-Up',          desc: 'Pre-production prototype' },
    { id: 'other',   label: 'Other Item',       desc: 'Accessory, display' },
    { id: 'manual',  label: 'Manual Entry',     desc: 'Any item, any era' },
  ];

  var html = '';
  cats.forEach(function(c) {
    var checked = prefs[c.id] !== false;
    html += '<div class="pref-row">'
      + '<div class="pref-row-label">'
      + '<strong>' + c.label + '</strong>'
      + '<span>' + c.desc + '</span>'
      + '</div>'
      + '<label class="pref-toggle">'
      + '<input type="checkbox" ' + (checked ? 'checked' : '')
      + ' onchange="_toggleWizCat(\'' + c.id + '\', this.checked)">'
      + '<div class="pref-toggle-track"></div>'
      + '</label></div>';
  });
  return html;
}

function _toggleWizCat(catId, on) {
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('rr_wizard_cats') || '{}'); } catch(e) {}
  saved[catId] = on;
  localStorage.setItem('rr_wizard_cats', JSON.stringify(saved));
}
