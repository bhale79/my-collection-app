// ═══════════════════════════════════════════════════════════════
// PREFERENCES — buildPrefsPage, health check, admin tools
// Loaded after app.js. Reads from state, _prefGet, _prefSet.
// ═══════════════════════════════════════════════════════════════

// v0.9.652/653 (Brad): the What-I-Collect toggles rebuild the whole prefs
// page AND re-render dashboard/browse — several of those reset scroll, so the
// user was bounced to the top after every checkbox click. v0.9.653: snapshot
// the scroll BEFORE any re-render (v652 captured too late), restore after —
// twice (rAF + 60ms) because late renders can scroll again.
function _prefsScrollSnapshot() {
  var saves = [];
  try {
    saves.push([null, window.scrollY || window.pageYOffset || 0]);   // window
    var n = document.getElementById('prefs-content');
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.scrollTop > 0) saves.push([n, n.scrollTop]);
      n = n.parentElement;
    }
    var se = document.scrollingElement;
    if (se && se.scrollTop > 0) saves.push([se, se.scrollTop]);
  } catch (e) {}
  var apply = function() {
    try {
      saves.forEach(function(sv) {
        if (sv[0] === null) window.scrollTo(0, sv[1]);
        else sv[0].scrollTop = sv[1];
      });
    } catch (e) {}
  };
  return function() { requestAnimationFrame(apply); setTimeout(apply, 60); };
}
function _rebuildPrefsKeepScroll() {
  var restore = _prefsScrollSnapshot();
  buildPrefsPage();
  restore();
}

// v0.9.884 (Brad): Preferences row — open the Drive photos folder.
// Uses the cached folder id when present; otherwise runs Drive setup
// once (same folders the photo uploads use) and then opens it.
async function _prefsOpenPhotosFolder() {
  try {
    var pid = (typeof driveCache !== 'undefined' && driveCache.photosId) || localStorage.getItem('lv_photos_id');
    if (!pid && typeof driveEnsureSetup === 'function') {
      showToast('Finding your photo folder…', 2000);
      await driveEnsureSetup();
      pid = (typeof driveCache !== 'undefined' && driveCache.photosId) || '';
    }
    if (!pid) { showToast('Photo folder not set up yet — add a photo to an item first', 3500, true); return; }
    window.open('https://drive.google.com/drive/folders/' + pid, '_blank');
  } catch (e) {
    console.warn('[Prefs] photos folder open:', e);
    showToast('Could not open the photo folder — check your connection', 3000, true);
  }
}
if (typeof window !== 'undefined') window._prefsOpenPhotosFolder = _prefsOpenPhotosFolder;

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
      <div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">Account <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">▼</span></div>
      <div class="pref-section-body">
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
          <span>Open your Google Sheet</span>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-shrink:0">
          <a id="nav-sheet-link-p" href="${sheetId ? 'https://docs.google.com/spreadsheets/d/'+sheetId : '#'}" target="_blank"
            class="pref-btn" onclick="return _sheetLinkClick(event)" style="text-decoration:none">Open ↗</a>
        </div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>My Collection Photos</strong>
          <span>Open your photo folder in Google Drive</span>
        </div>
        <button class="pref-btn" onclick="_prefsOpenPhotosFolder()">Open ↗</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Back Up My Collection</strong>
          <span>Saves a snapshot to your Google Drive</span>
        </div>
        <button class="pref-btn" onclick="uiBackupNow()">Back Up Now</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>View Backups</strong>
          <span>See your saved snapshots in Google Drive</span>
        </div>
        <button class="pref-btn" onclick="uiBackupList()">View</button>
      </div>
      </div>
    </div>

    <!-- ── 2. Collection ──────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">Collection <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">▶</span></div>
      <div class="pref-section-body" style="display:none">
      <div class="pref-row">
        <div class="pref-row-label"><strong>Track Storage Location</strong><span>Turn this on if your trains have set spots — like “Storage Unit 1” or “Tote A” — and you want to record where each item lives. You’ll be asked for a location as you add items.</span></div>
        ${toggle('location', 'lv_location_enabled', 'false')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Storage Locations</strong><span>Set up your totes, shelves, rooms, etc. so you can tap one when adding items</span></div>
        <button class="pref-btn" onclick="_openLocationsModal()">Manage</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Items Per Page</strong><span>How many rows show per page when browsing. More per page means less clicking through pages, but very large lists may load a little slower.</span></div>
        <select class="pref-select" id="pref-page-size" onchange="_prefSet('lv_page_size', this.value); state.pageSize=parseInt(this.value); state.currentPage=1; if(document.getElementById('page-browse').classList.contains('active')) renderBrowse()">
          ${[25,50,100,200].map(n=>`<option value="${n}" ${_prefGet('lv_page_size','50')===String(n)?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Defaults</div>
      <div style="font-size:0.75rem;color:var(--text-dim);padding:0 0.2rem 0.4rem;line-height:1.4">Starting values for each new item you add — set these to what you collect most so there’s less to change during entry. You can still adjust any item individually.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem 0.6rem">
        <div class="pref-row" style="padding:0.45rem 0.6rem">
          <div class="pref-row-label"><strong>All Original</strong></div>
          <select class="pref-select" style="min-width:72px" onchange="_prefSet('lv_def_allOriginal', this.value)">
            <option value="Yes" ${_prefGet('lv_def_allOriginal','Yes')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_allOriginal','Yes')==='No'?'selected':''}>No</option><option value="Unknown" ${_prefGet('lv_def_allOriginal','Yes')==='Unknown'?'selected':''}>Unknown</option>
          </select>
        </div>
        <div class="pref-row" style="padding:0.45rem 0.6rem">
          <div class="pref-row-label"><strong>Has Box</strong></div>
          <select class="pref-select" style="min-width:72px" onchange="_prefSet('lv_def_hasBox', this.value)">
            <option value="Yes" ${_prefGet('lv_def_hasBox','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_hasBox','No')==='No'?'selected':''}>No</option>
          </select>
        </div>
        <div class="pref-row" style="padding:0.45rem 0.6rem">
          <div class="pref-row-label"><strong>Instruction Sheet</strong></div>
          <select class="pref-select" style="min-width:72px" onchange="_prefSet('lv_def_hasIS', this.value)">
            <option value="Yes" ${_prefGet('lv_def_hasIS','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_hasIS','No')==='No'?'selected':''}>No</option>
          </select>
        </div>
        <div class="pref-row" style="padding:0.45rem 0.6rem">
          <div class="pref-row-label"><strong>Error Item</strong></div>
          <select class="pref-select" style="min-width:72px" onchange="_prefSet('lv_def_isError', this.value)">
            <option value="Yes" ${_prefGet('lv_def_isError','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_isError','No')==='No'?'selected':''}>No</option>
          </select>
        </div>
        <div class="pref-row" style="padding:0.45rem 0.6rem">
          <div class="pref-row-label"><strong>Master Box</strong></div>
          <select class="pref-select" style="min-width:72px" onchange="_prefSet('lv_def_masterBox', this.value)">
            <option value="Yes" ${_prefGet('lv_def_masterBox','No')==='Yes'?'selected':''}>Yes</option><option value="No" ${_prefGet('lv_def_masterBox','No')==='No'?'selected':''}>No</option>
          </select>
        </div>
        <div class="pref-row" style="padding:0.45rem 0.6rem">
          <div class="pref-row-label"><strong>Condition</strong></div>
          <select class="pref-select" style="min-width:72px" id="pref-def-cond" onchange="_prefSet('lv_default_cond', this.value)">
            ${[...Array(10)].map((_,i)=>{const v=i+1; return `<option value="${v}" ${_prefGet('lv_default_cond','7')===String(v)?'selected':''}>${v}</option>`;}).join('')}
          </select>
        </div>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Photo ID</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;user-select:none;width:100%">
          <input id="pref-ai-opt" type="checkbox" class="rr-tap-box"
                 style="width:1rem;height:1rem;cursor:pointer;accent-color:var(--accent)"
                 ${(typeof rrAiOptedOut === 'function' && rrAiOptedOut()) ? '' : 'checked'}
                 onchange="_togglePrefPhotoReads(this.checked)">
          <span style="font-size:0.85rem;font-weight:600">Use my daily photo ID reads</span>
        </label>
        <div style="font-size:0.78rem;color:var(--text-dim);line-height:1.5">Every photo is checked free first — printed numbers and barcodes cost nothing. This only controls what happens when the free readers can't tell: on, the photo gets a closer read from your daily allowance; off, you're asked to type the number or search instead.</div>
        <div id="pref-ai-left" style="font-size:0.78rem;color:var(--accent2);font-weight:600">${(typeof rrAiRemainingLabel === 'function' && rrAiRemainingLabel()) || ''}</div>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Scales I Collect</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="font-size:0.78rem;color:var(--text-dim);line-height:1.5">Uncheck scales you don't collect — every era of every manufacturer in that scale gets hidden.</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.55rem;width:100%">
          ${Object.keys((window.WHAT_I_COLLECT && window.WHAT_I_COLLECT.SCALES) || {}).map(function(k) {
            var sc = window.WHAT_I_COLLECT.SCALES[k];
            var enabled = _getEnabledScales().indexOf(k) >= 0;
            return '<label style="display:flex;align-items:center;gap:0.45rem;padding:0.45rem 0.7rem;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);font-size:0.8rem;color:var(--accent);font-weight:600">'
              + '<input type="checkbox" ' + (enabled ? 'checked' : '') + ' onchange="_togglePrefScale(\'' + k + '\', this.checked)" style="accent-color:var(--accent);width:1rem;height:1rem;cursor:pointer"> '
              + sc.label
              + '</label>';
          }).join('')}
        </div>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Manufacturers I Collect</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="font-size:0.78rem;color:var(--text-dim);line-height:1.5">Uncheck manufacturers you don't collect — every era of that manufacturer gets hidden.</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.55rem;width:100%">
          ${Object.keys((window.WHAT_I_COLLECT && window.WHAT_I_COLLECT.MANUFACTURERS) || {}).map(function(k) {
            var mfr = window.WHAT_I_COLLECT.MANUFACTURERS[k];
            var enabled = _getEnabledManufacturers().indexOf(k) >= 0;
            return '<label style="display:flex;align-items:center;gap:0.45rem;padding:0.45rem 0.7rem;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);font-size:0.8rem;color:var(--accent);font-weight:600">'
              + '<input type="checkbox" ' + (enabled ? 'checked' : '') + ' onchange="_togglePrefMfr(\'' + k + '\', this.checked)" style="accent-color:var(--accent);width:1rem;height:1rem;cursor:pointer"> '
              + mfr.label
              + '</label>';
          }).join('')}
        </div>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Eras I Collect</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="font-size:0.78rem;color:var(--text-dim);line-height:1.5">The three time periods — uncheck any you don't collect. Every manufacturer except Lionel is Modern era, so picking a modern manufacturer turns Modern on automatically.</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.55rem;width:100%">
          ${(function() {
            // v0.9.934 (Brad): eras are the three TIME PERIODS, always shown
            // regardless of manufacturer/scale selections.
            var PERIODS = [
              { id: 'prewar', label: 'Pre-War',      years: '1901-1942' },
              { id: 'pw',     label: 'Postwar',      years: '1945-1969' },
              { id: 'modern', label: 'MPC / Modern', years: '1970-Today' },
            ];
            return PERIODS.map(function(p) {
              var enabled = (typeof _isPeriodEnabled === 'function') ? _isPeriodEnabled(p.id) : true;
              var lbl = p.label + ' <span style="color:var(--text-dim);font-weight:400">(' + p.years + ')</span>';
              return '<label style="display:flex;align-items:center;gap:0.45rem;padding:0.45rem 0.7rem;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);font-size:0.8rem;color:var(--accent);font-weight:600">'
                + '<input type="checkbox" ' + (enabled ? 'checked' : '') + ' onchange="_togglePrefEra(\'' + p.id + '\', this.checked)" style="accent-color:var(--accent);width:1rem;height:1rem;cursor:pointer"> '
                + lbl
                + '</label>';
            }).join('');
          })()}
        </div>
      </div>

      </div>
    </div>

    <!-- ── 3. Display ─────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">Display <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">▶</span></div>
      <div class="pref-section-body" style="display:none">
      <div class="pref-row">
        <div class="pref-row-label"><strong>${(window.A11Y && window.A11Y.ui && window.A11Y.ui.themeLabel) || 'Theme'}</strong><span>${(window.A11Y && window.A11Y.ui && window.A11Y.ui.themeHint) || 'App color scheme'}</span></div>
        <select class="pref-select" id="pref-theme" onchange="_prefSet('lv_theme', this.value); applyTheme(); buildPrefsPage()">
          ${(() => {
            var opts = (window.A11Y && window.A11Y.theme && window.A11Y.theme.options) || [
              {key:'dark',label:'🌙 Dark'},{key:'light',label:'☀️ Light'},{key:'system',label:'💻 System'}
            ];
            var current = _prefGet((window.A11Y && window.A11Y.theme && window.A11Y.theme.storageKey) || 'lv_theme', (window.A11Y && window.A11Y.theme && window.A11Y.theme.defaultKey) || 'dark');
            return opts.map(function(o){ return '<option value="'+o.key+'"'+(current===o.key?' selected':'')+'>'+o.label+'</option>'; }).join('');
          })()}
        </select>
      </div>
      ${(typeof APPEARANCE_ENABLED !== 'undefined' && APPEARANCE_ENABLED) ? `
      <div class="pref-row">
        <div class="pref-row-label"><strong>🎨 Appearance</strong><span>${(typeof window.rrAppearanceCanEdit === 'function' && !window.rrAppearanceCanEdit())
          ? 'Pick a ready-made look. Designing your own needs the room of a desktop screen.'
          : "Build your own look — paste a logo, match its colors, then preview it across the app before you keep it."}</span></div>
        <button class="pref-select" style="cursor:pointer;text-align:center" onclick="openAppearance()">${(typeof window.rrAppearanceCanEdit === 'function' && !window.rrAppearanceCanEdit()) ? 'Choose a Look' : 'Open Editor'}</button>
      </div>` : ''}
      <div class="pref-row">
        <div class="pref-row-label"><strong>${(window.A11Y && window.A11Y.ui && window.A11Y.ui.fontScaleLabel) || 'Text Size'}</strong><span>${(window.A11Y && window.A11Y.ui && window.A11Y.ui.fontScaleHint) || 'Makes all text in the app bigger or smaller.'}</span></div>
        <select class="pref-select" id="pref-font-scale" onchange="setFontScale(this.value); buildPrefsPage()">
          ${(() => {
            var cfg = (window.A11Y && window.A11Y.fontScale) || { options: [{key:'normal',label:'Normal',pct:100}], defaultKey: 'normal', storageKey: 'lv_font_scale' };
            var current = _prefGet(cfg.storageKey, cfg.defaultKey);
            return (cfg.options || []).map(function(o){ return '<option value="'+o.key+'"'+(current===o.key?' selected':'')+'>'+o.label+' ('+o.pct+'%)</option>'; }).join('');
          })()}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Upgrade Condition Threshold</strong><span>Flag items below this condition</span></div>
        <select class="pref-select" id="pref-upgrade-thresh" onchange="_prefSet('lv_upgrade_thresh', this.value)">
          ${[...Array(9)].map((_,i)=>{const v=String(i+1); return `<option value="${v}" ${_prefGet('lv_upgrade_thresh','7')===v?'selected':''}>${v} or below</option>`;}).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Show Accuracy Disclaimer</strong><span>Warning banner on catalog pages</span></div>
        ${toggle('disclaimer', 'lv_show_disclaimer', 'true')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Compact Mode</strong><span>Denser table rows, smaller fonts, hide the icon key. Maximizes the rows you see.</span></div>
        ${toggle('compact', 'lv_compact_mode', 'false')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Skip the crop step on a paid read</strong><span>Cropping to one item stops the reader answering about the wrong train, so it is on by default. Turn this on only if your photos are already tight.</span></div>
        ${toggle('skipreadcrop', 'rr_skip_read_crop', 'false')}
      </div>

      </div>
    </div>

    <!-- ── 4. Data ────────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">Data <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">▶</span></div>
      <div class="pref-section-body" style="display:none">
      <div class="pref-row">
        <div class="pref-row-label"><strong>Export Full Collection</strong><span>Download as CSV spreadsheet</span></div>
        <button class="pref-btn" onclick="exportFullCollection()">Download CSV</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Last updated</strong><span id="pref-cache-ts">${cacheDateStr} · ${cacheSize}</span></div>
        <button class="pref-btn" onclick="forceRefreshData().then(()=>buildPrefsPage())">Update now</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Clear saved copy on this device</strong><span>Your collection stays safe in Google — this only clears the copy kept here, and it reloads on next launch</span></div>
        <button class="pref-btn danger" onclick="_clearCacheOnly()">Clear Cache</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Protect key columns</strong><span>Asks "are you sure?" in Google Sheets if anyone edits the ID columns or a header row. Runs on its own — use this to put it back after changing protection by hand.</span></div>
        <button class="pref-btn" onclick="_reapplySheetProtection()">Re-apply Protection</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Refresh sheet styling</strong><span>Re-applies your Google Sheet's formatting — headers, colors, dropdowns and the Dashboard tab. Use it if the sheet looks off after hand edits.</span></div>
        <!-- v0.9.1276: _rebuildDashboardTab had existed since Session 155 with
             no caller — the button this row provides was never rendered, so a
             documented feature ("via the Rebuild Dashboard Tab button") was
             fiction, the same shape as R10's Re-apply Protection above. -->
        <button class="pref-btn" onclick="_rebuildDashboardTab()">Refresh Styling</button>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Dashboard</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5">
          Up to <strong style="color:var(--text)">${typeof MAX_CARDS !== 'undefined' ? MAX_CARDS : 6} stat cards</strong> and up to <strong style="color:var(--text)">3 large cards</strong> on your dashboard — use the <strong style="color:var(--text)">✎ Edit Dashboard</strong> button next to the greeting to choose, arrange, or remove them.
        </div>
        <button onclick="showPage('dashboard', document.querySelector('.nav-item[onclick*=dashboard]')); setTimeout(function(){ if (typeof openDashEditor === 'function') openDashEditor(); }, 150);" style="padding:0.35rem 0.8rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.8rem;cursor:pointer">
          Edit Dashboard →
        </button>
      </div>

      <div style="font-size:0.78rem;font-weight:600;color:var(--text-mid);padding:0.75rem 0.2rem 0.35rem;letter-spacing:0.03em;text-transform:uppercase">Collector's Market</div>
      <div id="vault-prefs-row"></div>
      </div>
    </div>

    <!-- ── Help & Tips ──────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">Help &amp; Tips <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">▶</span></div>
      <div class="pref-section-body" style="display:none">
      <div class="pref-row">
        <div class="pref-row-label"><strong>Help Center</strong><span>Guides, the tour, tips, and how to undo a mistake</span></div>
        <button class="pref-btn" onclick="if(typeof openHelpHub==='function')openHelpHub()">Open</button>
      </div>
      </div>
    </div>

    <!-- ── About ──────────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">About <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">▶</span></div>
      <div class="pref-section-body" style="display:none">
      <div class="pref-row">
        <div class="pref-row-label"><strong>The Rail Roster</strong><span>${APP_VERSION} · ${APP_DATE}</span></div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Master Catalog</strong><span id="pref-catalog-count">${state.masterData?.length?.toLocaleString() || '—'} items loaded${state.masterVersion?.v ? ' · sheet v' + state.masterVersion.v + (state.masterVersion.date ? ' (' + state.masterVersion.date + ')' : '') : ''}</span></div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Send Feedback</strong><span>Report a bug or suggest a feature</span></div>
        <a href="${_rrFeedbackMailto()}" class="pref-btn" style="text-decoration:none">Email ↗</a>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Terms of Service</strong><span>The rules for using The Rail Roster</span></div>
        <a href="/terms/" target="_blank" rel="noopener" class="pref-btn" style="text-decoration:none">View ↗</a>
      </div>
      <div class="pref-row">
        <div class="pref-row-label"><strong>Privacy Policy</strong><span>What data the app touches and where it lives</span></div>
        <a href="/privacy/" target="_blank" rel="noopener" class="pref-btn" style="text-decoration:none">View ↗</a>
      </div>
      </div>
    </div>`;

  _prefsApplySectionState();

  // Keep hidden pref-location-toggle in sync (used by wizard)
  const locTog = document.getElementById('ptog-location');
  const oldTog = document.getElementById('pref-location-toggle');
  if (oldTog && locTog) oldTog.checked = locTog.checked;

  // Render Collector's Market opt-in row
  if (typeof vaultRenderPrefsRow === 'function') {
    vaultRenderPrefsRow(document.getElementById('vault-prefs-row'));
  }
}


// ── v0.9.1055 (Brad): feedback that arrives useful ─────────────────────────
// The link used to open a blank mail with only a subject, so a report read
// "it didn't work" and the first reply was always the same three questions.
// The body now arrives pre-filled with the version, the device and the screen
// size — the things Brad always needs and a tester never thinks to send. It is
// only what the browser already tells every website: no account, no email
// address, nothing from the collection.
function _rrFeedbackMailto() {
  var lines = [];
  try {
    lines.push('', '', '\u2014\u2014 please write above this line \u2014\u2014', '');
    lines.push('Master sheet: v' + (state.masterVersion?.v || 'unknown — no Master Version tab'));
    lines.push('App version: ' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?')
      + (typeof APP_DATE !== 'undefined' ? ' \u00b7 ' + APP_DATE : ''));
    var ua = String(navigator.userAgent || '');
    // Keep it short and readable rather than the full 200-character string.
    var dev = (ua.match(/\((?:Linux; )?([^)]{0,60})\)/) || [])[1] || 'unknown device';
    var br  = (ua.match(/(Chrome|CriOS|Firefox|Edg|Safari)\/([\d.]+)/) || []).slice(1, 3).join(' ') || 'unknown browser';
    lines.push('Device: ' + dev);
    lines.push('Browser: ' + br);
    lines.push('Screen: ' + (window.innerWidth || '?') + ' \u00d7 ' + (window.innerHeight || '?')
      + (window.devicePixelRatio ? ' @' + window.devicePixelRatio + 'x' : ''));
    lines.push('Installed: ' + (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'yes (home screen)' : 'no (browser tab)'));
    lines.push('Online: ' + (navigator.onLine ? 'yes' : 'no'));
  } catch (e) {}
  return 'mailto:' + ADMIN_EMAIL
    + '?subject=' + encodeURIComponent('The Rail Roster feedback')
    + '&body=' + encodeURIComponent(lines.join('\n'));
}
if (typeof window !== 'undefined') window._rrFeedbackMailto = _rrFeedbackMailto;

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
    var sc=fails>0?"#e74c3c":warns>0?"#d4a843":"#2ecc71";
    var st=fails>0?fails+" issue(s) found":warns>0?"Minor warnings only":"All systems go!";
    var html="<div style='font-weight:700;color:"+sc+";margin-bottom:0.6rem;font-size:0.82rem'>"+passes+" passed &middot; "+fails+" failed &middot; "+warns+" warnings &mdash; "+st+"</div>";
    results.forEach(function(r) {
      var icon = r.s==="pass" ? "&#9989;" : r.s==="fail" ? "&#10060;" : "&#9888;";
      var c = r.s==="pass"?"#2ecc71":r.s==="fail"?"#e74c3c":"#d4a843";
      html += "<div style='color:"+c+"'>"+icon+" "+r.l+(r.d?" <span style='color:var(--text-dim);font-size:0.7rem'>&rarr; "+r.d+"</span>":"")+"</div>";
    });
    out.innerHTML = html;
    if (btn) { btn.disabled = false; btn.textContent = "Run Again"; }
  }, 50);
}

// v0.9.1285 (overnight housekeeping): a ~10KB console health-check script
// (_HEALTH_CHECK_SCRIPT) and its copier (_copyHealthCheckScript) sat here
// from Session 51 with no caller — no button ever offered the copy. The
// test suite's 2,700 assertions are the health check now. Removed rather
// than left to mislead the next search.

// v0.9.1276 (R11 leftovers): a QA checklist (_QA_ITEMS and its
// localStorage key 'lv_qa_checklist') sat here from Session ~150 with no
// caller and no render — a feature that never shipped, kept looking like
// one that had. Removed rather than left to mislead the next search for
// where a stored key is written.

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
    // Apply live so the wizard shows the location field without a reload
    if (typeof _prefLocEnabled !== 'undefined') _prefLocEnabled = !!val;
    // Keep hidden toggle in sync
    const old = document.getElementById('pref-location-toggle');
    if (old) old.checked = val;
  }
  if (id === 'disclaimer') {
    _applyDisclaimerPref();
  }
  if (id === 'compact') {
    if (typeof _applyCompactMode === 'function') _applyCompactMode();
  }
}

function _clearCacheOnly() {
  // Wipe ALL cache layers so the next launch is a true fresh load:
  //   1. personal data cache
  //   2. master / catalog / companion / set / IS-ref / era-total caches (all eras)
  //   3. service-worker caches (fetched assets)
  // Auth tokens, user prefs, vault id, sheet ids etc. are preserved so
  // the user does NOT have to re-sign-in or re-onboard. (Session 120)
  var CACHE_PREFIXES = [
    'lv_personal_cache',
    'lv_master_cache',
    'lv_catalog_ref',
    'lv_companion_cache',
    'lv_set_cache',
    'lv_is_ref_cache',
    'lv_era_total'
  ];
  var removed = 0;
  var keys = [];
  for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  keys.forEach(function(k) {
    if (!k) return;
    if (CACHE_PREFIXES.some(function(p) { return k.indexOf(p) === 0; })) {
      localStorage.removeItem(k);
      removed++;
    }
  });
  if (typeof caches !== 'undefined' && caches.keys) {
    caches.keys().then(function(names) {
      names.forEach(function(n) { caches.delete(n); });
    }).catch(function() {});
  }
  showToast('Cleared ' + removed + ' cache entries — will reload from sheet on next launch');
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


// ── Re-apply Sheet Protection ──────────────────────────────────
// v0.9.1269 (R10). The button app-auth.js has claimed existed since Session 155.
// Forces a re-apply even when protection is already in place — the reason to
// press it is having changed protection by hand in Google Sheets.
//
// Every outcome gets a sentence a collector can act on, because the honest
// answers here include "we turned it back off again" and that needs explaining
// rather than a silent tick. Raw API error text stays in the console (§199g).
let _reapplyProtectionRunning = false;
async function _reapplySheetProtection() {
  if (_reapplyProtectionRunning) return;
  if (!state.personalSheetId) { showToast('No personal sheet connected', 3000, true); return; }
  if (typeof ensureSheetProtection !== 'function') {
    showToast('Sheet builder not loaded — refresh and try again', 3000, true);
    return;
  }
  _reapplyProtectionRunning = true;
  try {
    showToast('Re-applying protection…', 2000);
    const res = await ensureSheetProtection(state.personalSheetId, { force: true });
    if (res && res.applied) {
      showToast('Protection is on. Google will ask before anyone edits the ID columns or a header row.', 5000);
      return;
    }
    const why = (res && res.reason) || '';
    if (why === 'blocks app writes') {
      showToast('Protection was turned back off — with it on, Google would not let the app save your changes.', 7000, true);
    } else if (why === 'unverified') {
      showToast('Protection was turned back off — the app could not confirm it can still save. Nothing was changed.', 7000, true);
    } else if (why === 'formatting') {
      showToast('The sheet is being formatted right now — try again in a moment.', 4000, true);
    } else if (why === 'unknown state') {
      showToast('Could not read the sheet just now, so nothing was changed. Try again in a moment.', 5000, true);
    } else {
      showToast('Could not apply protection. Nothing on your sheet was changed.', 5000, true);
    }
  } catch (e) {
    console.error('Re-apply protection failed:', e);
    showToast('Could not apply protection. Nothing on your sheet was changed.', 5000, true);
  } finally {
    _reapplyProtectionRunning = false;
  }
}


// ── Rebuild Dashboard Tab ──────────────────────────────────────
let _rebuildInProgress = false;
async function _rebuildDashboardTab() {
  if (_rebuildInProgress) {
    console.log('[Prefs] Rebuild already running, ignoring duplicate click');
    return;
  }
  _rebuildInProgress = true;
  setTimeout(function(){ _rebuildInProgress = false; }, 30000);   // safety auto-reset after 30s
  if (!state.personalSheetId) {
    _rebuildInProgress = false;
    showToast('No personal sheet connected', 3000, true);
    return;
  }
  // Session 155 v6: call applySheetFormatting (has built-in version check).
  // If sheet is at current version, it just refreshes Dashboard stats.
  // If older, runs full format apply (headers, banding, freeze, hide cols,
  // dropdowns, currency/date, auto-resize). This lets the user trigger a
  // style refresh without signing out / back in.
  if (typeof applySheetFormatting !== 'function') {
    // Fallback to old behavior if newer fn isn't loaded
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
      showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Failed to rebuild: ' + e.message, 4000, true);
    }
    return;
  }
  try {
    showToast('Refreshing sheet styling…', 2500);
    await applySheetFormatting(state.personalSheetId, { force: true });
    showToast('Sheet refreshed!');
  } catch(e) {
    console.error('Refresh sheet styling failed:', e);
    showToast(rrSaveError(e, 'the sheet refresh', { kept: false }), 4000, true);
  } finally {
    _rebuildInProgress = false;
  }
}


// ═══════════════════════════════════════════════════════════════
// Wizard Category Preferences
// ═══════════════════════════════════════════════════════════════

// ── "What I Collect" era toggle handler ──
// Adds/removes an era from the user's enabled-eras pref. Updates the era
// dropdown visibility immediately. Refuses to disable the LAST remaining era
// (must keep at least one selected) unless user is admin.
function _togglePrefEra(eraId, on) {
  // v0.9.934: eraId is a PERIOD key (prewar / pw / modern). Normalize whatever
  // is stored (legacy era keys or periods) to periods, then add/remove.
  var enabled = (typeof _getEnabledPeriods === 'function') ? _getEnabledPeriods().slice() : _getEnabledEras();
  if (on) {
    if (enabled.indexOf(eraId) < 0) enabled.push(eraId);
  } else {
    if (enabled.length <= 1) {
      showToast('Keep at least one era selected.');
      // Re-tick the box visually
      _rebuildPrefsKeepScroll();
      return;
    }
    enabled = enabled.filter(function(e) { return e !== eraId; });
  }
  _setEnabledEras(enabled);
  if (on && typeof _ensureEnabledErasLoaded === 'function') _ensureEnabledErasLoaded();
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
}

// v0.9.1163: the Photo ID spending switch, from Preferences. Writes through the
// SAME rrAiSetOptOut the crop-screen checkbox uses — one stored flag, two places
// to see it, never two sources of truth. The Photo Inbox reads the flag when it
// renders, so its button text and token line correct themselves next time it opens.
function _togglePrefPhotoReads(on) {
  if (typeof rrAiSetOptOut === 'function') rrAiSetOptOut(!on);
  var left = document.getElementById('pref-ai-left');
  if (left) left.textContent = on
    ? ((typeof rrAiRemainingLabel === 'function' && rrAiRemainingLabel()) || '')
    : 'Off — free readers only';
  if (typeof showToast === 'function') {
    showToast(on ? 'Photo ID reads are on' : 'Photo ID reads are off — free readers only', 2600);
  }
}
if (typeof window !== 'undefined') window._togglePrefPhotoReads = _togglePrefPhotoReads;

// Session 136: scale toggle handler — parallel to _togglePrefEra. When user
// disables a scale, every era of every manufacturer in that scale becomes
// hidden via _isEraEnabled. Keep at least one scale selected for non-admins.
function _togglePrefScale(scaleId, on) {
  var enabled = _getEnabledScales();
  if (on) {
    if (enabled.indexOf(scaleId) < 0) enabled.push(scaleId);
  } else {
    var nonAdminCount = enabled.filter(function(s) { return s !== scaleId; }).length;
    if (nonAdminCount === 0) {
      showToast('Keep at least one scale selected.');
      _rebuildPrefsKeepScroll();
      return;
    }
    enabled = enabled.filter(function(s) { return s !== scaleId; });
  }
  _setEnabledScales(enabled);
  if (on && typeof _ensureEnabledErasLoaded === 'function') _ensureEnabledErasLoaded();
  var _restoreScroll = _prefsScrollSnapshot();   // v0.9.653: capture BEFORE the re-renders
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
  if (typeof buildDashboard === 'function') buildDashboard();
  if (typeof renderBrowse === 'function') renderBrowse();
  // Session 138: re-render so the Eras list filter updates
  buildPrefsPage();
  _restoreScroll();
}

// Session 137: manufacturer toggle handler — parallel to scale + era. When
// user disables a manufacturer, every era of that manufacturer becomes hidden.
function _togglePrefMfr(mfrId, on) {
  var enabled = _getEnabledManufacturers();
  if (on) {
    if (enabled.indexOf(mfrId) < 0) enabled.push(mfrId);
  } else {
    var nonAdminCount = enabled.filter(function(m) { return m !== mfrId; }).length;
    if (nonAdminCount === 0) {
      showToast('Keep at least one manufacturer selected.');
      _rebuildPrefsKeepScroll();
      return;
    }
    enabled = enabled.filter(function(m) { return m !== mfrId; });
  }
  _setEnabledManufacturers(enabled);
  // v0.9.934 (Brad): a manufacturer needs its time period on, or its items
  // stay hidden. Everyone except Lionel is Modern — auto-enable it.
  if (on && mfrId !== 'lionel' && typeof _isPeriodEnabled === 'function' && !_isPeriodEnabled('modern')) {
    var _pp = _getEnabledPeriods().slice(); _pp.push('modern');
    _setEnabledEras(_pp);
    var _mLbl = (window.WHAT_I_COLLECT && WHAT_I_COLLECT.MANUFACTURERS[mfrId] && WHAT_I_COLLECT.MANUFACTURERS[mfrId].label) || mfrId;
    showToast('Modern era turned on for ' + _mLbl);
  }
  if (on && typeof _ensureEnabledErasLoaded === 'function') _ensureEnabledErasLoaded();
  var _restoreScroll = _prefsScrollSnapshot();   // v0.9.653: capture BEFORE the re-renders
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
  if (typeof buildDashboard === 'function') buildDashboard();
  if (typeof renderBrowse === 'function') renderBrowse();
  // Session 138: re-render so the Eras list filter updates
  buildPrefsPage();
  _restoreScroll();
}

// ── Storage Locations (managed flat list) ─────────────────────
var LOCATION_TYPES = ['Tote','Shelf','Room','Building','Storage Unit','Display Case','Other'];
function _locEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _getSavedLocations(){
  try { var a = JSON.parse(localStorage.getItem('lv_saved_locations') || '[]'); return Array.isArray(a) ? a : []; }
  catch(e){ return []; }
}
function _setSavedLocations(arr){ localStorage.setItem('lv_saved_locations', JSON.stringify(arr || [])); }
function _addSavedLocation(){
  var nameEl = document.getElementById('loc-new-name'); var typeEl = document.getElementById('loc-new-type');
  if (!nameEl) return;
  var name = (nameEl.value || '').trim(); if (!name){ nameEl.focus(); return; }
  var type = typeEl ? typeEl.value : '';
  var locs = _getSavedLocations();
  if (locs.some(function(l){ return (l.name||'').toLowerCase() === name.toLowerCase(); })){ showToast('That location already exists'); nameEl.value=''; nameEl.focus(); return; }
  locs.push({ name: name, type: type });
  _setSavedLocations(locs);
  nameEl.value=''; nameEl.focus();
  _renderLocList();
}
function _deleteSavedLocation(i){
  var locs = _getSavedLocations(); if (i<0 || i>=locs.length) return;
  locs.splice(i,1); _setSavedLocations(locs); _renderLocList();
}
function _seedLocationsFromItems(){
  var locs = _getSavedLocations(); var have = {};
  locs.forEach(function(l){ have[(l.name||'').toLowerCase()] = true; });
  var added = 0;
  Object.values((typeof state!=='undefined' && state.personalData) ? state.personalData : {}).forEach(function(pd){
    if (pd && pd.location && pd.location.trim()){
      var n = pd.location.trim();
      if (!have[n.toLowerCase()]){ locs.push({ name: n, type: 'Other' }); have[n.toLowerCase()] = true; added++; }
    }
  });
  _setSavedLocations(locs); _renderLocList();
  showToast(added ? ('Added ' + added + ' location' + (added>1?'s':'')) : 'No new locations found');
}
function _renderLocList(){
  var el = document.getElementById('loc-list'); if (!el) return;
  var locs = _getSavedLocations();
  if (!locs.length){ el.innerHTML = '<div style="color:var(--text-dim);font-size:0.82rem;font-style:italic;padding:0.5rem 0">No locations yet — add your first above.</div>'; return; }
  el.innerHTML = locs.map(function(loc, i){
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.35rem;background:var(--surface2)">'
      + '<div><strong style="font-size:0.88rem;color:var(--text)">' + _locEsc(loc.name) + '</strong>'
      + (loc.type ? ' <span style="font-size:0.72rem;color:var(--text-dim)">&middot; ' + _locEsc(loc.type) + '</span>' : '') + '</div>'
      + '<button data-loc-del="' + i + '" title="Remove" style="background:none;border:none;color:var(--text-dim);font-size:1.2rem;cursor:pointer;line-height:1;padding:0 0.25rem">&times;</button>'
      + '</div>';
  }).join('');
  el.querySelectorAll('[data-loc-del]').forEach(function(btn){
    btn.addEventListener('click', function(){ _deleteSavedLocation(parseInt(btn.getAttribute('data-loc-del'),10)); });
  });
}
function _openLocationsModal(){
  var old = document.getElementById('loc-setup-modal'); if (old) old.remove();
  var modal = document.createElement('div');
  modal.id = 'loc-setup-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  var typeOpts = LOCATION_TYPES.map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('');
  modal.innerHTML =
    '<div style="background:var(--surface);border-radius:14px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.4);font-family:var(--font-body)">'
    + '<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
    +   '<strong style="font-size:1.05rem;color:var(--text)">Storage Locations</strong>'
    +   '<button id="loc-close" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;line-height:1">&times;</button>'
    + '</div>'
    + '<div style="padding:1rem 1.25rem;overflow:auto;flex:1">'
    +   '<div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.85rem">Add the places you keep your trains — totes, shelves, rooms, buildings, storage units. When you add an item, tap one instead of typing.</div>'
    +   '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">'
    +     '<input id="loc-new-name" type="text" placeholder="e.g. Tote A" style="flex:1;min-width:140px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.7rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;box-sizing:border-box">'
    +     '<select id="loc-new-type" class="pref-select" style="min-width:130px">' + typeOpts + '</select>'
    +     '<button id="loc-add-btn" class="pref-btn">Add</button>'
    +   '</div>'
    +   '<div id="loc-list" style="margin-top:0.85rem"></div>'
    +   '<button id="loc-seed-btn" class="pref-btn" style="margin-top:0.85rem;font-size:0.8rem">+ Add from items I already entered</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
  document.getElementById('loc-close').addEventListener('click', function(){ modal.remove(); });
  document.getElementById('loc-add-btn').addEventListener('click', _addSavedLocation);
  document.getElementById('loc-seed-btn').addEventListener('click', _seedLocationsFromItems);
  var nm = document.getElementById('loc-new-name');
  if (nm) nm.addEventListener('keydown', function(e){ if (e.key === 'Enter') _addSavedLocation(); });
  _renderLocList();
}

// v0.9.932 (Brad): section open/closed state survives the page rebuilds that
// every checkbox toggle triggers. _prefsSectionState maps section title ->
// true (open) / false (closed); _prefsApplySectionState() re-applies it after
// each buildPrefsPage() render, so an expanded section stays expanded while
// the user ticks multiple boxes.
var _prefsSectionState = {};
function _prefsSectionKey(titleEl) {
  return (titleEl.textContent || '').replace(/[▶▼]/g, '').trim();
}
function _togglePrefSection(titleEl) {
  var body = titleEl.nextElementSibling;
  var arrow = titleEl.querySelector('span');
  if (!body) return;
  var open = (body.style.display === 'none');
  body.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▼' : '▶';
  _prefsSectionState[_prefsSectionKey(titleEl)] = open;
}
function _prefsApplySectionState() {
  try {
    document.querySelectorAll('#prefs-content .pref-section-title').forEach(function(titleEl) {
      var key = _prefsSectionKey(titleEl);
      if (!(key in _prefsSectionState)) return;   // untouched -> keep markup default
      var body = titleEl.nextElementSibling;
      var arrow = titleEl.querySelector('span');
      if (!body) return;
      var open = !!_prefsSectionState[key];
      body.style.display = open ? '' : 'none';
      if (arrow) arrow.textContent = open ? '▼' : '▶';
    });
  } catch (e) {}
}


// ── Sheet protection (Session 155) ─────────────────────────────


// ── Version-history help modal (Session 155) ───────────────────
function _uiShowVersionHistoryHelp() {
  let existing = document.getElementById('vh-help-modal');
  if (existing) existing.remove();

  const sheetId = state.personalSheetId || '';
  const sheetUrl = sheetId
    ? 'https://docs.google.com/spreadsheets/d/' + sheetId
    : 'https://sheets.google.com';

  const modal = document.createElement('div');
  modal.id = 'vh-help-modal';
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;' +
    'display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML =
    '<div style="background:var(--surface,#fff);color:var(--text,#111);' +
      'border-radius:12px;max-width:560px;width:100%;max-height:85vh;' +
      'display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.4)">' +
      '<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border,#ddd);' +
        'display:flex;align-items:center;justify-content:space-between">' +
        '<strong style="font-size:1.05rem">How to Undo a Mistake</strong>' +
        '<button onclick="document.getElementById(\'vh-help-modal\').remove()" ' +
          'style="background:none;border:none;color:var(--text,#111);' +
          'font-size:1.5rem;cursor:pointer;line-height:1;padding:0 0.25rem">×</button>' +
      '</div>' +
      '<div style="padding:1.25rem;overflow:auto;line-height:1.55;font-size:0.92rem">' +
        '<p style="margin:0 0 0.85rem 0">Google Sheets keeps <strong>every version</strong> of your sheet automatically. ' +
        'If you accidentally delete something, change the wrong cell, or want to go back to how things were yesterday, ' +
        'you can restore an earlier version in about 30 seconds.</p>' +
        '<p style="margin:0 0 0.5rem 0;font-weight:600">Steps:</p>' +
        '<ol style="margin:0 0 1rem 0;padding-left:1.4rem">' +
          '<li style="margin-bottom:0.4rem">Open your Google Sheet ' +
            '(use the <em>Open Sheet</em> button in Preferences, or tap below).</li>' +
          '<li style="margin-bottom:0.4rem">In Google Sheets, click <strong>File → Version history → See version history</strong>.</li>' +
          '<li style="margin-bottom:0.4rem">A panel opens on the right showing every change, grouped by day. Click any version to preview it.</li>' +
          '<li style="margin-bottom:0.4rem">Found the version you want? Click <strong>Restore this version</strong> at the top.</li>' +
        '</ol>' +
        '<div style="background:var(--surface-alt,#f4f4f4);border-left:3px solid var(--accent,#4a7);' +
          'padding:0.7rem 0.9rem;border-radius:6px;margin:1rem 0">' +
          '<strong style="display:block;margin-bottom:0.25rem">Tip</strong>' +
          'Version history is fine-grained (every change tracked). For bigger rollbacks — like restoring your collection ' +
          'to exactly how it was a week ago — use the <strong>Back Up My Collection</strong> + <strong>View Backups</strong> ' +
          'buttons in Preferences instead.</div>' +
        '<p style="margin:1rem 0 0 0;font-size:0.85rem;color:var(--text-dim,#777)">' +
          'Both methods are non-destructive — they don\'t throw away your current state, they just give you a way back.</p>' +
      '</div>' +
      '<div style="padding:0.85rem 1.25rem;border-top:1px solid var(--border,#ddd);' +
        'display:flex;gap:0.5rem;justify-content:flex-end">' +
        '<button onclick="document.getElementById(\'vh-help-modal\').remove()" ' +
          'style="background:none;border:1px solid var(--border,#ddd);color:var(--text,#111);' +
          'padding:0.45rem 0.9rem;border-radius:6px;cursor:pointer">Close</button>' +
        '<a href="' + sheetUrl + '" target="_blank" rel="noopener" ' +
          'style="background:var(--accent,#4a7);color:#fff;text-decoration:none;' +
          'padding:0.5rem 0.95rem;border-radius:6px;font-weight:600">Open My Sheet ↗</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
}
window._uiShowVersionHistoryHelp = _uiShowVersionHistoryHelp;
