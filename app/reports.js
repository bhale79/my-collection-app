// ═══════════════════════════════════════════════════════════════
// REPORTS — buildReport, exportReport, custom report builder
// Loaded after app.js. Reads from state, _prefGet, sheetsGet.
// ═══════════════════════════════════════════════════════════════

var _wupView = 'all';
var _wupPartsLoading = false;
// v0.9.1710 (press audit A1): when the parts read FAILED, remember it. The
// v0.9.1325 note said "leave partsData unloaded; the next render retries" —
// but the failure handler itself re-rendered, the re-render found parts
// unloaded and read again, that read failed, and round it went: measured at
// ~2,900 failed reads a second, forever, with the page frozen. Now a failed
// read draws "Parts couldn't be loaded — Retry" and starts NOTHING; only a
// person (Retry, a section button, or reopening the report) reads again.
var _wupPartsFailed = false;
function _setWupView(v){ _wupView = v; _wupPartsFailed = false; buildReport(); }
function _wupRetryParts(){ _wupPartsFailed = false; buildReport(); }
// v0.9.1333: the preview modal moved to <body> (v1332, the stacking-context
// fix) — and these helpers still found the report's wrapper by PAGE
// ('#page-reports .table-wrap'), which now matches NOTHING, so the insurance
// report died on null.parentNode before drawing a single row. ONE resolver,
// anchored to the table itself — the identity that cannot move away from its
// own wrapper.
function _repTableWrap(){ var th = document.getElementById('report-thead'); return th ? th.closest('.table-wrap') : null; }
function _wupControls(){
  var tw = _repTableWrap(); if(!tw) return;
  var c = document.getElementById('wup-controls');
  if(!c){ c=document.createElement('div'); c.id='wup-controls'; c.style.cssText='display:flex;gap:0.4rem;margin-bottom:0.75rem;flex-wrap:wrap'; tw.parentNode.insertBefore(c, tw); }
  c.style.display='flex';
  var views=[['all','All'],['want','Want'],['upgrade','Upgrade'],['parts','Parts']];
  c.innerHTML = views.map(function(v){ var on=(_wupView===v[0]); return '<button onclick="_setWupView(\''+v[0]+'\')" style="padding:0.4rem 0.85rem;border-radius:7px;border:1.5px solid '+(on?'var(--accent2)':'var(--border)')+';background:'+(on?'rgba(180,140,60,0.12)':'var(--surface2)')+';color:'+(on?'var(--accent2)':'var(--text-mid)')+';font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">'+v[1]+'</button>'; }).join('');
}
if (typeof window!=='undefined'){ window._setWupView=_setWupView; window._wupRetryParts=_wupRetryParts; }

function buildReport() {
  const type = document.getElementById('report-type')?.value || 'insurance';

  // Custom saved report
  if (type.startsWith('custom:')) {
    const id = type.replace('custom:','');
    const def = (state.savedReports||[]).find(r=>r.id===id);
    if (def) buildCustomReport(def);
    else { document.getElementById('report-tbody').innerHTML='<tr><td class="ui-empty">Report not found</td></tr>'; }
    return;
  }
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  if (!thead || !tbody) return;
  var _ih=document.getElementById('ins-report-hdr'); if(_ih) _ih.style.display='none';
  var _wc0=document.getElementById('wup-controls'); if(_wc0) _wc0.style.display='none';

  if (type === 'contacts') {
    // ── Contacts report (v0.9.781, Brad brainstorm item 4) ──
    const cesc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    thead.innerHTML = '<tr><th>Name</th><th>Title</th><th>Business</th><th>Store Phone</th><th>Cell</th><th>Home</th><th>Email</th><th>Website</th><th>Address</th><th>Era / Deals in</th><th>Met at</th><th>Notes</th></tr>';
    const renderC = function () {
      const rows = (state.contactsData || []).slice().sort((a,b)=>(window._ctLastNameKey?window._ctLastNameKey(a.name).localeCompare(window._ctLastNameKey(b.name)):(a.name||'').localeCompare(b.name||'')));
      tbody.innerHTML = rows.length ? rows.map(function (c) {
        return '<tr><td>' + [c.name, c.title, c.business, c.phone, c.cellPhone, c.homePhone, c.email, c.website, c.address, c.specialties, c.metAt, c.notes].map(cesc).join('</td><td>') + '</td></tr>';
      }).join('') : '<tr><td class="ui-empty" colspan="12">No contacts yet — add some on the Contacts page.</td></tr>';
    };
    if ((state.contactsData || []).length) renderC();
    else if (typeof window._ctLoadContacts === 'function') {
      tbody.innerHTML = '<tr><td colspan="12">Loading contacts…</td></tr>';
      window._ctLoadContacts().then(renderC).catch(renderC);
    } else renderC();
    return;
  }

  if (type === 'insurance') {
    // ── Insurance Report ─────────────────────────────────────
    // All user-visible copy + column list come from INSURANCE_REPORT
    // (insurance-config.js). Edit there, not here.
    const CFG = (typeof INSURANCE_REPORT !== 'undefined') ? INSURANCE_REPORT : {
      title: 'Model Train Collection — Insurance Documentation',
      columns: [
        { key:'photo', label:'Photo', type:'photo' },
        { key:'itemNum', label:'Item #', type:'itemnum' },
        { key:'description', label:'Description', type:'text' },
        { key:'variation', label:'Variation', type:'dim' },
        { key:'condition', label:'Cond.', type:'text', align:'center' },
        { key:'hasBox', label:'Box', type:'text', align:'center' },
        { key:'estWorth', label:'Est. Worth', type:'money', align:'right' },
        { key:'notes', label:'Notes', type:'dim' },
      ],
    };
    const ownerName = state.user?.name || '';
    const dateStr   = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    const ownedItems = Object.values(state.personalData).filter(pd => {
      if (!pd.owned) return false;
      const condVal  = pd.condition?.toString().trim();
      const priceVal = pd.priceItem?.toString().trim();
      const noCondition  = !condVal  || condVal  === '' || condVal  === 'N/A';
      const noItemPrice  = !priceVal || priceVal === '' || priceVal === 'N/A';
      return !(pd.hasBox === 'Yes' && noCondition && noItemPrice); // exclude pure box-only
    });

    // Sort by itemType then itemNum
    ownedItems.sort((a, b) => {
      const master_a = findMaster(a.itemNum, a.variation, a) || {};   // v0.9.1821: the owned rows
      const master_b = findMaster(b.itemNum, b.variation, b) || {};
      const typeA = master_a.itemType || 'ZZZ';
      const typeB = master_b.itemType || 'ZZZ';
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      return (a.itemNum || '').localeCompare(b.itemNum || '', undefined, { numeric: true });
    });

    let totalWorth = 0;
    let totalPaid  = 0;
    // Session 144 (Tier 4.21): also accumulate per-manufacturer totals for the
    // breakdown block below the single-totals row. Only shown when 2+ mfrs.
    const _mfrTotals = {};
    ownedItems.forEach(pd => {
      const w = parseFloat(pd.userEstWorth || 0);
      const p = parseFloat(pd.priceComplete || pd.priceItem || 0);
      totalWorth += w;
      totalPaid  += p;
      let mfr = (pd.manufacturer || '').toString();
      if (!mfr && typeof _manufacturerOfItem === 'function') {
        mfr = _manufacturerOfItem(pd) || '';
        if (mfr) mfr = mfr.charAt(0).toUpperCase() + mfr.slice(1);
      }
      if (!mfr) mfr = 'Lionel';
      if (!_mfrTotals[mfr]) _mfrTotals[mfr] = { worth: 0, paid: 0, count: 0 };
      _mfrTotals[mfr].worth += w;
      _mfrTotals[mfr].paid  += p;
      _mfrTotals[mfr].count++;
    });

    // Inject header above table
    const tableWrap = _repTableWrap();
    let hdrEl = document.getElementById('ins-report-hdr');
    if (!hdrEl && tableWrap) {
      hdrEl = document.createElement('div');
      hdrEl.id = 'ins-report-hdr';
      // INSIDE the scroller, above the table — in the capped card (v1332) a
      // sibling would pin permanently; inside, it scrolls with the report,
      // which is how it has always read.
      tableWrap.insertBefore(hdrEl, tableWrap.firstChild);
    }
    if (!hdrEl) return;
    hdrEl.style.display = '';
    // Build meta lines from the template in config
    const metaVals = {
      ownerName: ownerName || '—',
      dateStr:   dateStr,
      itemCount: ownedItems.length.toLocaleString(),
      totalWorth: Math.round(totalWorth).toLocaleString(),
    };
    const metaHtml = (CFG.metaTemplate || []).map(line => {
      // Simple {placeholder} replacement
      const filled = line.replace(/\{(\w+)\}/g, (_, k) => metaVals[k] != null ? metaVals[k] : '');
      return '<span>' + filled + '</span>';
    }).join('');
    hdrEl.innerHTML = `
      <div class="ins-report-header">
        <div class="ins-report-title">${CFG.title || 'Insurance Documentation'}</div>
        ${CFG.subtitle ? `<div class="ins-report-subtitle" style="font-size:0.82rem;color:var(--text-mid);margin-top:0.25rem">${CFG.subtitle}</div>` : ''}
        <div class="ins-report-meta">${metaHtml}</div>
      </div>
      <div class="ins-report-totals">
        ${totalWorth > 0 ? `<span>Total Est. Worth: <strong>$${Math.round(totalWorth).toLocaleString()}</strong></span>` : ''}
        ${CFG.totalsNote ? `<span style="color:var(--text-dim);font-size:0.78rem">${CFG.totalsNote}</span>` : ''}
      </div>`;

    // ── Build thead + tbody from CFG.columns ─────────────────
    thead.innerHTML = '<tr>' + (CFG.columns || []).map(c =>
      '<th' + (c.align ? ' style="text-align:' + c.align + '"' : '') + '>' + c.label + '</th>'
    ).join('') + '</tr>';

    function _cellValue(col, pd, master, photoId) {
      switch (col.key) {
        case 'photo':       return { html: `<div id="${photoId}" class="ins-photo-placeholder" style="font-size:0.6rem;line-height:1.3">No<br>Photo</div>` };
        case 'itemNum':     return { html: `<span class="item-num">${pd.itemNum || ''}</span>` };
        case 'description': return { text: _repCleanDesc(master.roadName || master.description || master.itemType || '—', pd.itemNum) };
        case 'year':        return { text: pd.yearMade || master.yearProd || '—' };
        case 'variation':   return { text: pd.variation || '—' };
        case 'condition':   return { text: pd.condition || '—' };
        case 'allOriginal': return { text: pd.allOriginal || '—' };
        case 'hasBox':      return { text: pd.hasBox || '—' };
        case 'boxCond':     return { text: pd.boxCond || '—' };
        case 'estWorth':    return { text: pd.userEstWorth ? _currencySymbol() + parseFloat(pd.userEstWorth).toLocaleString() : '—' };
        case 'pricePaid': {
          const paid = pd.priceComplete || pd.priceItem;
          return { text: paid ? _currencySymbol() + parseFloat(paid).toLocaleString() : '—' };
        }
        case 'notes':       return { text: pd.notes || '' };
        default:            return { text: (pd[col.key] != null ? String(pd[col.key]) : '—') };
      }
    }

    tbody.innerHTML = ownedItems.map((pd, idx) => {
      const master = findMaster(pd.itemNum, pd.variation, pd) || {};
      const photoId = 'ins-photo-' + idx;
      const cells = (CFG.columns || []).map(c => {
        const v = _cellValue(c, pd, master, photoId);
        let style = '';
        if (c.align) style += `text-align:${c.align};`;
        if (c.type === 'dim')   style += 'font-size:0.77rem;color:var(--text-dim);max-width:160px;';
        if (c.type === 'money') style += 'font-family:var(--font-mono);color:var(--accent2);';
        return `<td${style ? ` style="${style}"` : ''}>${v.html != null ? v.html : (v.text != null ? v.text : '—')}</td>`;
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('') || `<tr><td colspan="${(CFG.columns || []).length}" class="ui-empty">No owned items yet</td></tr>`;

    // Async: load first photo for each item (only if photo column exists)
    const hasPhotoCol = (CFG.columns || []).some(c => c.key === 'photo');
    if (hasPhotoCol) {
      ownedItems.forEach((pd, idx) => {
        if (!pd.photoItem) return;
        const container = document.getElementById('ins-photo-' + idx);
        if (!container) return;
        driveGetFolderPhotos(pd.photoItem).then(photos => {
          if (!photos || !photos.length) return;
          const img = document.createElement('img');
          img.className = 'ins-photo';
          img.alt = pd.itemNum;
          container.innerHTML = '';
          container.appendChild(img);
          loadDriveThumb(photos[0].id, img, container);
        });
      });
    }

    // ── Signature / certification footer ─────────────────────
    let footEl = document.getElementById('ins-report-foot');
    if (!footEl && tableWrap) {
      footEl = document.createElement('div');
      footEl.id = 'ins-report-foot';
      // Bottom of the scroller, after the table — same reasoning as the header.
      tableWrap.appendChild(footEl);
    }
    if (!footEl) return;
    footEl.style.display = '';
    footEl.innerHTML = `
      <div class="ins-report-footer" style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)">
        ${CFG.footerCertification ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.55;margin-bottom:1.5rem;font-style:italic">${CFG.footerCertification}</div>` : ''}
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-top:1rem">
          <div style="flex:1;min-width:240px">
            <div style="border-bottom:1px solid var(--text);height:2.2rem"></div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.25rem">${CFG.signatureLabel || 'Owner signature'}</div>
          </div>
          <div style="flex:0.5;min-width:140px">
            <div style="border-bottom:1px solid var(--text);height:2.2rem"></div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.25rem">${CFG.dateLabel || 'Date'}</div>
          </div>
        </div>
      </div>`;

    return;
  } // end insurance

  // Hide insurance header + footer when switching to other report types
  const _insHdr = document.getElementById('ins-report-hdr');
  if (_insHdr) _insHdr.style.display = 'none';
  const _insFoot = document.getElementById('ins-report-foot');
  if (_insFoot) _insFoot.style.display = 'none';

  if (type === 'collection') {
    thead.innerHTML = '<tr><th>Item #</th><th>Description</th><th>Variation #</th><th>Condition</th><th>Box</th><th>All Original</th><th>Est. Worth</th><th>Location</th><th>Notes</th></tr>';
    const owned = Object.values(state.personalData).filter(pd => {
      if (!pd.owned) return false;
      const c=(pd.condition||'').toString().trim(), pr=(pd.priceItem||'').toString().trim();
      const noC=!c||c==='N/A', noP=!pr||pr==='N/A';
      return !(pd.hasBox==='Yes' && noC && noP);
    });
    owned.sort((a,b)=>{
      const ma=findMaster(a.itemNum,a.variation,a)||{}, mb=findMaster(b.itemNum,b.variation,b)||{};   // v0.9.1821
      if ((ma.itemType||'ZZZ')!==(mb.itemType||'ZZZ')) return (ma.itemType||'ZZZ').localeCompare(mb.itemType||'ZZZ');
      return (a.itemNum||'').localeCompare(b.itemNum||'',undefined,{numeric:true});
    });
    tbody.innerHTML = owned.map(pd=>{
      const m=findMaster(pd.itemNum,pd.variation, pd)||{};
      const desc=m.roadName||m.description||m.itemType||'—';
      const worth=pd.userEstWorth?_currencySymbol()+parseFloat(pd.userEstWorth).toLocaleString():'—';
      return `<tr>
        <td><span class="item-num">${rrEsc(pd.itemNum)}</span></td>
        <td>${rrEsc(desc)}</td>
        <td>${rrEsc(pd.variation)||'—'}</td>
        <td style="text-align:center">${pd.condition||'—'}</td>
        <td style="text-align:center">${pd.hasBox||'—'}</td>
        <td style="text-align:center">${pd.allOriginal||'—'}</td>
        <td class="market-val">${worth}</td>
        <td>${rrEsc(pd.location)||'—'}</td>
        <td style="font-size:0.77rem;color:var(--text-dim)">${rrEsc(String(pd.notes||'').replace(/\s*\[grp:[^\]]*\]\s*/g,'').trim())}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="ui-empty">No owned items yet</td></tr>';

  } else if (type === 'wantupgrade') {
    _wupControls();
    thead.innerHTML = '<tr><th>Item / Part #</th><th>Description</th><th>Var #</th><th>Priority / Target</th><th>Target Price</th><th>Notes</th></tr>';
    // v0.9.1040: this `esc` only stringified — it never escaped, so every
    // esc(...) call below was a no-op. Both now go through the shared rrEsc.
    const esc=v=>rrEsc(v);
    const cn=v=>rrEsc(String(v||'').replace(/\s*\[grp:[^\]]*\]\s*/g,'').trim());   // strip internal group tags, then escape
    const sect=(label,n)=>`<tr><td colspan="6" style="background:var(--surface2);font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);padding:0.45rem 0.6rem">${label} (${n})</td></tr>`;
    let html='';
    const showWant=(_wupView==='all'||_wupView==='want');
    const showUpg=(_wupView==='all'||_wupView==='upgrade');
    const showParts=(_wupView==='all'||_wupView==='parts');
    if (showWant) {
      const w=(typeof foldWantEntries==='function') ? foldWantEntries(Object.values(state.wantData||{})) : Object.values(state.wantData||{});   // v0.9.722: pairs = one row, one price
      html+=sect('Want List', w.length);
      html+= w.length ? w.map(e=>{ const m=findMaster(e.itemNum,e.variation, e)||{}; const d=rrEsc((m.roadName||m.description||'—'))+(e._wantMates?' 🔗 '+rrEsc(e._wantMates.join(' + ')):''); const _pv=e._pairPrice||e.expectedPrice; const pr=_pv?_currencySymbol()+parseFloat(_pv).toLocaleString():'—'; return `<tr><td><span class="item-num">${esc(e.itemNum)}</span></td><td>${d}</td><td>${esc(e.variation)||'—'}</td><td>${esc(e.priority)||'—'}</td><td class="market-val">${pr}</td><td style="font-size:0.77rem;color:var(--text-dim)">${cn(e.notes)}</td></tr>`; }).join('') : '<tr><td colspan="6" class="ui-empty">Nothing on your want list</td></tr>';
    }
    if (showUpg) {
      const u=(typeof foldWantEntries==='function') ? foldWantEntries(Object.values(state.upgradeData||{})) : Object.values(state.upgradeData||{});   // v0.9.722
      html+=sect('Upgrade List', u.length);
      html+= u.length ? u.map(e=>{ const m=findMaster(e.itemNum,e.variation, e)||{}; const d=rrEsc((m.roadName||m.description||'—'))+(e._wantMates?' 🔗 '+rrEsc(e._wantMates.join(' + ')):''); const tgt=[esc(e.priority),e.targetCondition?('→ cond '+e.targetCondition):''].filter(Boolean).join(' '); const pr=e.maxPrice?_currencySymbol()+parseFloat(e.maxPrice).toLocaleString():'—'; return `<tr><td><span class="item-num">${esc(e.itemNum)}</span></td><td>${d}</td><td>${esc(e.variation)||'—'}</td><td>${tgt||'—'}</td><td class="market-val">${pr}</td><td style="font-size:0.77rem;color:var(--text-dim)">${cn(e.notes)}</td></tr>`; }).join('') : '<tr><td colspan="6" class="ui-empty">Nothing on your upgrade list</td></tr>';
    }
    if (showParts) {
      if (!state.partsData && _wupPartsFailed) {
        // v0.9.1710 (press audit A1): the read failed. Say so, offer Retry,
        // and start nothing — see _wupPartsFailed above.
        html+=sect('Parts Needed', '?');
        html+='<tr><td colspan="6" class="ui-empty">Parts couldn\u2019t be loaded' + (navigator.onLine === false ? ' \u2014 you\u2019re offline' : '') +
              '. <button type="button" onclick="_wupRetryParts()" style="margin-left:0.4rem;padding:0.25rem 0.7rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.8rem;font-weight:600;cursor:pointer">Retry</button></td></tr>';
      } else if (!state.partsData) {
        // Parts load lazily (only fetched when needed). Show a placeholder and
        // fetch in the background so want/upgrade always render immediately.
        html+=sect('Parts Needed', '…');
        html+='<tr><td colspan="6" class="ui-empty">Loading parts…</td></tr>';
        if (!_wupPartsLoading) {
          // v0.9.1325: TWO layers used to turn a failed read into a confident
          // "No parts on your list". The `.catch(()=>({values:[]}))` yielded no
          // rows, and the outer catch then set state.partsData = {} — which is
          // TRUTHY, so `if (!state.partsData)` never fired again and nothing
          // else invalidates it. Open this report once while offline and it
          // said your parts list was empty for the rest of the session, no
          // matter how many times you re-opened it. (The Parts PAGE self-heals
          // because it re-fetches per visit; only the report was stuck.)
          // A failure leaves it undefined; v0.9.1710 adds _wupPartsFailed so
          // the re-render offers Retry instead of reading again by itself.
          _wupPartsLoading=true;
          (async()=>{ try{ if(typeof _ensurePartsTab==='function') await _ensurePartsTab(); const res=await sheetsGet(state.personalSheetId,'Parts Needed!A3:H'); const parts={}; (res.values||[]).forEach((r,idx)=>{ if(!r[0]||r[0]==='Part ID')return; parts['p'+(idx+3)]={row:idx+3,id:r[0]||'',description:r[1]||'',partNum:r[2]||'',forItem:r[3]||'',forInv:r[4]||'',photo:r[5]||'',notes:r[6]||'',dateAdded:r[7]||''}; }); state.partsData=parts; _wupPartsFailed=false; }catch(e){ console.warn('[Report] parts read failed \u2014 left unloaded; the report offers Retry (v0.9.1710):', e); _wupPartsFailed=true; } _wupPartsLoading=false; var _sel=document.getElementById('report-type'); if(_sel && _sel.value==='wantupgrade') buildReport(); })();
        }
      } else {
        const pp=Object.values(state.partsData||{});
        html+=sect('Parts Needed', pp.length);
        html+= pp.length ? pp.map(e=>{ const forL=e.forItem?('for '+e.forItem):''; const d=[esc(e.description),forL].filter(Boolean).join(' — '); return `<tr><td><span class="item-num">${esc(e.partNum)||'—'}</span></td><td>${d||'—'}</td><td>—</td><td>—</td><td>—</td><td style="font-size:0.77rem;color:var(--text-dim)">${cn(e.notes)}</td></tr>`; }).join('') : '<tr><td colspan="6" class="ui-empty">No parts on your list</td></tr>';
      }
    }
    tbody.innerHTML = html;
  }
}

// v0.9.1962 (Brad: "keep past reports so that we can send those quickly"): a
// CSV export is filed in Past reports too, like the PDF and the Google Doc.
// The generic table's file gets the report's name and the date, so a list of
// past reports can tell them apart.
// v0.9.1966: ONE name for a CSV — the download and the kept copy alike — with
// the local date and time (two made the same day had identical names).
function _repCsvName(base) {
  if (typeof window !== 'undefined' && typeof window._repStampName === 'function') return window._repStampName(base, '.csv');
  return base + '-' + new Date().toISOString().slice(0, 10) + '.csv';
}
function _repKeepCsv(blob, name) {
  try { if (typeof window._archiveBlob === 'function') window._archiveBlob(blob, name, 'text/csv'); } catch (e) {}
}
function exportReport() {
  const type = document.getElementById('report-type')?.value || '';

  if (type.startsWith('custom:')) {
    const id = type.replace('custom:','');
    const def = (state.savedReports||[]).find(r=>r.id===id);
    if (def) exportCustomReport(def);
    return;
  }

  if (type === 'contacts') {
    const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
    const headers = ['Name','Title','Business','Store Phone','Cell','Home','Email','Website','Address','Era / Deals in','Met at','Notes'];
    const rows = (state.contactsData || []).slice().sort((a,b)=>(window._ctLastNameKey?window._ctLastNameKey(a.name).localeCompare(window._ctLastNameKey(b.name)):(a.name||'').localeCompare(b.name||'')))
      .map(c => [c.name, c.title, c.business, c.phone, c.cellPhone, c.homePhone, c.email, c.website, c.address, c.specialties, c.metAt, c.notes].map(esc).join(','));
    const csv = headers.map(h => `"${h}"`).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; const _cn = _repCsvName('contacts'); a.download = _cn; a.click(); _repKeepCsv(blob, _cn);
    return;
  }

  if (type === 'insurance') {
    const headers = ['Item #','Description','Variation #','Condition','Box','Est. Worth','Photo Folder Link'];
    const ownedItems = Object.values(state.personalData).filter(pd => {
      if (!pd.owned) return false;
      const condVal  = pd.condition?.toString().trim();
      const priceVal = pd.priceItem?.toString().trim();
      const noCondition = !condVal  || condVal  === '' || condVal  === 'N/A';
      const noItemPrice = !priceVal || priceVal === '' || priceVal === 'N/A';
      return !(pd.hasBox === 'Yes' && noCondition && noItemPrice);
    });
    ownedItems.sort((a, b) => {
      const ma = findMaster(a.itemNum, a.variation, a) || {};   // v0.9.1821
      const mb = findMaster(b.itemNum, b.variation, b) || {};
      if ((ma.itemType||'ZZZ') !== (mb.itemType||'ZZZ')) return (ma.itemType||'ZZZ').localeCompare(mb.itemType||'ZZZ');
      return (a.itemNum||'').localeCompare(b.itemNum||'', undefined, { numeric: true });
    });
    const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
    const rows = ownedItems.map(pd => {
      const master = findMaster(pd.itemNum, pd.variation, pd) || {};
      return [
        esc(pd.itemNum), esc(_repCleanDesc(master.roadName || master.description || '', pd.itemNum)),
        esc(pd.variation || ''), esc(pd.condition || ''),
        esc(pd.hasBox || ''), esc(pd.userEstWorth || ''),
        esc(pd.photoItem || ''),
      ].join(',');
    });
    const csv = headers.map(h => `"${h}"`).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; const _cn = _repCsvName('insurance-report'); a.download = _cn; a.click(); _repKeepCsv(blob, _cn);
    return;
  }

  // All other reports — scrape visible table
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  const headers = [...thead.querySelectorAll('th')].map(th => th.textContent).join(',');
  const rows = [...tbody.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => `"${td.textContent.replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  const csv = headers + '\n' + rows;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; const _cn = _repCsvName((typeof _repSlugOf === 'function') ? _repSlugOf(type) : 'collection-report'); a.download = _cn; a.click(); _repKeepCsv(blob, _cn);
}

// ── REPORT BUILDER ───────────────────────────────────────────────
// ══ v0.9.1985 — THE BUILD A REPORT SETUP, REBUILT ═════════════════
// Brad, 2026-10-18 (brainstorm, then "yes"): "lets clean up the build a
// report set up screen … two rows of columns maybe. also, we need to have the
// custom columns that a user can set up here too. filters, this is crazy, we
// need item types to somehow do like boxcars, then do the sub types … also we
// are missing eras like postwar, then things like catalogs, drawings, mock
// ups etc."
//
// What was wrong, measured in the code:
//   * the column list was a hand-typed copy (18 entries) — none of the user's
//     own fields (Custom 1–5 under their names, Location Detail, Shipper,
//     Sub-collection) and no Maker, Era, Road Name or Section;
//   * a report only ever read My Collection's train rows — catalogs, paper,
//     mock-ups, instruction sheets and science / construction sets kept on
//     their own tabs were never in any custom report;
//   * the Type filter listed every Type word in the whole catalog (hundreds,
//     most of which the user owns none of), and the year box stopped at 1969;
//   * saved reports were written to this browser only, AND nothing read them
//     back when the app started (the reader lost its caller on 2026-03-06),
//     so a report saved yesterday was gone today — and saving a new one then
//     wrote over the old ones.
//
// Now:
//   * COLUMNS come from ONE list (REPORT_COLS below) whose user-field entries
//     are made from RR_USER_FIELDS (config.js) — a field switched on in
//     Preferences, or holding data, is offered here under the user's own name.
//     Shown grouped, two to a row on a computer.
//   * ROWS come from ONE gatherer (_rbAllRows) — every owned row on every tab,
//     each knowing its section, era, maker, type and sub-type ONCE.
//   * FILTERS offer only what the user owns, with counts, and every count is
//     the number you would get if you picked it (each group counted with the
//     other groups' picks in force). A live "N items match" says what the
//     report will hold before you save it.
//   * SAVED REPORTS go through the one settings door (_prefSet), so they
//     follow the account to every device, and are read back on every visit
//     to Reports. Two devices that each saved reports before this are
//     COMBINED the first time they meet (RR_PREF_UNION, config.js).
// tests/report_builder_1985_tests.js holds all of it, in a real browser.

const REPORT_COL_GROUPS = [
  { id: 'item',  label: 'The item' },
  { id: 'cond',  label: 'Condition' },
  { id: 'money', label: 'Money' },
  { id: 'where', label: 'Where it is' },
  { id: 'own',   label: 'Your own fields' },
  { id: 'notes', label: 'Photos & notes' },
];
// The fixed columns. `field` names the personal-sheet field, so the one-line
// help (rrFieldHelp, config.js) can be shown on hover. The user's own fields
// are added from RR_USER_FIELDS by _rbColumns() — never typed here.
const REPORT_COLS = [
  { key:'itemNum',       label:'Item #',          group:'item',  field:'itemNum' },
  { key:'description',   label:'Description',     group:'item',  field:'description' },
  { key:'manufacturer',  label:'Maker',           group:'item',  field:'manufacturer' },
  { key:'section',       label:'Section',         group:'item' },
  { key:'itemType',      label:'Type',            group:'item',  field:'itemType' },
  { key:'eraPeriod',     label:'Era',             group:'item' },
  { key:'yearMade',      label:'Year Made',       group:'item',  field:'yearMade' },
  { key:'variation',     label:'Variation #',     group:'item',  field:'variation' },
  { key:'varDesc',       label:'Variation Desc.', group:'item' },
  { key:'roadName',      label:'Road Name',       group:'item',  field:'roadName' },
  { key:'roadNumber',    label:'Road Number',     group:'item',  field:'roadNumber' },
  { key:'groupId',       label:'Set/Group ID',    group:'item',  field:'groupId' },
  { key:'isError',       label:'Error Variation', group:'item',  field:'isError' },
  { key:'condition',     label:'Condition',       group:'cond',  field:'condition' },
  { key:'yourGrade',     label:'Your Grade',      group:'cond',  field:'yourGrade' },
  { key:'allOriginal',   label:'All Original',    group:'cond',  field:'allOriginal' },
  { key:'hasBox',        label:'Has Box',         group:'cond',  field:'hasBox' },
  { key:'boxCond',       label:'Box Condition',   group:'cond',  field:'boxCond' },
  { key:'priceItem',     label:'Amount Paid',     group:'money', field:'priceItem' },
  { key:'userEstWorth',  label:'Est. Worth',      group:'money', field:'userEstWorth' },
  { key:'datePurchased', label:'Date Acquired',   group:'money', field:'datePurchased' },
  { key:'purchasedFrom', label:'Bought From',     group:'money', field:'purchasedFrom' },
  { key:'location',      label:'Location',        group:'where', field:'location' },
  { key:'hasPhoto',      label:'Has Photo',       group:'notes', field:'photoItem' },
  { key:'notes',         label:'Notes',           group:'notes', field:'notes' },
  { key:'yourDescription', label:'Your Description', group:'notes', field:'yourDescription' },
  { key:'dateAdded',     label:'Date Added',      group:'notes', field:'dateAdded' },
];
// Which group a user field sits in: the spot inside a location sits with
// Location; every other one is the user's own.
const _RB_USER_FIELD_GROUP = { locationDetail: 'where', shipper: 'where' };
// The words each kind of column sorts by.
const _RB_NUM_KEYS  = { condition:1, priceItem:1, userEstWorth:1, boxCond:1 };
const _RB_YEAR_KEYS = { yearMade:1 };
const _RB_DATE_KEYS = { datePurchased:1, dateAdded:1 };

// Every column a report can show, in group order: the fixed ones, then each
// user field (RR_USER_FIELDS) that is switched on, holds data in one of the
// rows, or is already in this report. Labels are the user's own (rrFieldLabel).
function _rbColumns(rows, def) {
  const out = REPORT_COLS.map(c => Object.assign({}, c));
  const enabledIn = (def && def.colEnabled) || {};
  (window.RR_USER_FIELDS || []).forEach(f => {
    let show = false;
    try { show = (typeof rrFieldEnabled === 'function') && rrFieldEnabled(f); } catch (e) {}
    if (!show && enabledIn[f.key]) show = true;
    if (!show && rows) show = rows.some(r => String((r.pd && r.pd[f.key]) || '').trim() !== '');
    if (!show) return;
    let label = f.label;
    try { if (typeof rrFieldLabel === 'function') label = rrFieldLabel(f) || f.label; } catch (e) {}
    out.push({ key: f.key, label: label, group: _RB_USER_FIELD_GROUP[f.key] || 'own', field: f.key, userField: true });
  });
  return out;
}
function _rbColByKey(key, cols) {
  return (cols || _rbColumns(null, _rbState)).find(c => c.key === key) || null;
}

let _rbState  = null;
let _rbActiveTab = 'columns';
let _rbRowsCache = null;

function _rbBlankState() {
  return {
    id: null, name: '',
    colOrder: ['itemNum','description','itemType','yearMade','condition','hasBox','priceItem','userEstWorth'],
    colEnabled: Object.fromEntries(['itemNum','description','itemType','yearMade','condition','hasBox','priceItem','userEstWorth'].map(k => [k, true])),
    filters: {},
    sort: [{ field:'itemType', dir:'asc' },{ field:'itemNum', dir:'asc' }],
  };
}
// A report saved before v0.9.1985 picked raw catalog Type words ("Boxcar",
// "Box Car", "Operating Boxcar"…). Opened here, each becomes the type group
// the app files it under — the same groups the chips offer.
function _rbUpgradeFilters(f) {
  if (!f || !Array.isArray(f.itemType) || !f.itemType.length || (Array.isArray(f.type) && f.type.length)) return f;
  const seen = {};
  f.type = [];
  f.itemType.forEach(t => {
    const sec = (typeof ephSectionOfType === 'function') ? ephSectionOfType(t) : '';
    const word = sec ? ((ephTab(sec) || {}).single || t)
      : ((typeof getTypeBucket === 'function' ? getTypeBucket({ itemType: t }) : '') || t);
    if (!seen[word]) { seen[word] = 1; f.type.push(word); }
  });
  delete f.itemType;
  return f;
}

function openReportBuilder(editId) {
  if (typeof _rbSyncSaved === 'function') _rbSyncSaved();
  const existing = editId ? (state.savedReports||[]).find(r=>r.id===editId) : null;
  _rbState = existing ? JSON.parse(JSON.stringify(existing)) : _rbBlankState();
  if (!_rbState.filters) _rbState.filters = {};
  if (!_rbState.colEnabled) _rbState.colEnabled = {};
  if (!Array.isArray(_rbState.colOrder)) _rbState.colOrder = [];
  _rbUpgradeFilters(_rbState.filters);
  _rbRowsCache = _rbAllRows();
  _rbActiveTab = 'columns';

  const ov = document.createElement('div');
  ov.className = 'rb-overlay'; ov.id = 'rb-overlay';
  ov.innerHTML = `
    <div class="rb-sheet rb-sheet-wide">
      <div style="padding:1rem 1.25rem 0;flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.65rem">
          <div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700">${existing?'Edit Report':'Build a Report'}</div>
          <button onclick="_rbCloseOverlay()" aria-label="Close" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:6px">✕</button>
        </div>
        <input type="text" id="rb-name" value="${rrEsc(_rbState.name||'')}"
          placeholder="Report name (e.g. Unboxed Locomotives)…"
          style="width:100%;padding:0.55rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box"
          oninput="_rbState.name=this.value">
        <div class="rb-tabs" style="margin-top:0.75rem">
          <button class="rb-tab" id="rbtab-columns" onclick="_rbShowTab('columns')">Columns</button>
          <button class="rb-tab" id="rbtab-filters" onclick="_rbShowTab('filters')">Filters</button>
          <button class="rb-tab" id="rbtab-sort"    onclick="_rbShowTab('sort')">Sort</button>
        </div>
      </div>
      <div class="rb-body" id="rb-body" style="flex:1;overflow-y:auto;padding:1rem 1.25rem;-webkit-overflow-scrolling:touch"></div>
      <div style="padding:0.85rem 1.25rem;border-top:1px solid var(--border);display:flex;gap:0.6rem;align-items:center;flex-shrink:0">
        <div id="rb-match-foot" class="rb-match-foot"></div>
        <button onclick="_rbCloseOverlay()"
          style="flex:1;max-width:9rem;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Cancel</button>
        <button id="rb-save-btn" onclick="_rbSave()"
          style="flex:1;max-width:12rem;padding:0.7rem;border-radius:9px;border:none;background:var(--accent2);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">Save Report</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#rb-body').addEventListener('click', _rbBodyClick);
  ov.querySelector('#rb-body').addEventListener('change', _rbBodyChange);
  ov.querySelector('#rb-body').addEventListener('input', _rbBodyInput);
  _rbShowTab('columns');
  if (window.BackStack) window.BackStack.push('report-builder', _rbCloseOverlaySilently);
}

// Voluntary close (X, Cancel) — removes the overlay AND rewinds BackStack.
function _rbCloseOverlay() {
  _rbCloseOverlaySilently();
  if (window.BackStack) window.BackStack.pop('report-builder');
}

// Silent close — used when BackStack itself triggered the close on a
// device-back press (BackStack has already popped its own entry).
function _rbCloseOverlaySilently() {
  document.getElementById('rb-overlay')?.remove();
  _rbRowsCache = null;
}

function _rbShowTab(tab) {
  _rbActiveTab = tab;
  const nameEl = document.getElementById('rb-name');
  if (nameEl) _rbState.name = nameEl.value;
  ['columns','filters','sort'].forEach(t => {
    document.getElementById('rbtab-'+t)?.classList.toggle('active', t===tab);
  });
  const body = document.getElementById('rb-body');
  if (!body) return;
  if (tab==='columns')      body.innerHTML = _rbColumnsHTML();
  else if (tab==='filters') body.innerHTML = _rbFiltersHTML();
  else if (tab==='sort')    body.innerHTML = _rbSortHTML();
  _rbPaintMatch();
}

// ── Columns tab ──────────────────────────────────────────────────
// The columns ticked, in the order the report shows them.
function _rbEnabledOrder(cols) {
  cols = cols || _rbColumns(_rbRowsCache, _rbState);
  const known = {}; cols.forEach(c => { known[c.key] = 1; });
  const order = (_rbState.colOrder || []).filter(k => known[k] && _rbState.colEnabled[k]);
  cols.forEach(c => { if (_rbState.colEnabled[c.key] && order.indexOf(c.key) < 0) order.push(c.key); });
  return order;
}
function _rbColumnsHTML() {
  const cols = _rbColumns(_rbRowsCache, _rbState);
  const help = (c) => {
    try { return c.field && typeof rrFieldHelp === 'function' ? (rrFieldHelp(c.field) || '') : ''; } catch (e) { return ''; }
  };
  const groups = REPORT_COL_GROUPS.map(g => {
    const mine = cols.filter(c => c.group === g.id);
    if (!mine.length) return '';
    return `<div class="rb-colgroup" data-rb-group="${g.id}">
      <div class="rb-colgroup-title">${rrEsc(g.label)}</div>
      ${mine.map(c => {
        const on = !!_rbState.colEnabled[c.key];
        const h = help(c);
        return `<label class="rb-colpick${on?' on':''}" data-rb-col="${rrEsc(c.key)}"${h?` title="${rrEsc(h)}"`:''}>
          <input type="checkbox" data-rb-colbox="${rrEsc(c.key)}" ${on?'checked':''}>
          <span>${rrEsc(c.label)}</span>
        </label>`;
      }).join('')}
    </div>`;
  }).join('');
  return '<div class="rb-hint">Tick the columns you want in this report. They appear in the order you tick them.</div>'
    + '<div class="rb-colgrid">' + groups + '</div>'
    + '<div class="rb-colorder" id="rb-colorder">' + _rbOrderLine(cols) + '</div>';
}
function _rbOrderLine(cols) {
  const order = _rbEnabledOrder(cols);
  if (!order.length) return '<span class="rb-warn">No columns ticked yet.</span>';
  return '<span class="rb-colorder-lbl">In this report:</span> ' +
    order.map(k => { const c = _rbColByKey(k, cols); return '<span class="rb-colorder-chip">' + rrEsc(c ? c.label : k) + '</span>'; }).join('');
}
function _rbToggleCol(key, checked) {
  _rbState.colEnabled[key] = !!checked;
  const ord = (_rbState.colOrder || []).filter(k => k !== key);
  if (checked) {
    // after the last ticked column — "the order you tick them"
    let at = -1;
    ord.forEach((k, i) => { if (_rbState.colEnabled[k]) at = i; });
    ord.splice(at + 1, 0, key);
  }
  _rbState.colOrder = ord;
  const box = document.querySelector('[data-rb-col="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
  if (box) box.classList.toggle('on', !!checked);
  const line = document.getElementById('rb-colorder');
  if (line) line.innerHTML = _rbOrderLine();
}
window._rbToggleCol = _rbToggleCol;

// ── Filters tab ──────────────────────────────────────────────────
const _RB_FACETS = [
  { id: 'section', label: 'Section' },
  { id: 'era',     label: 'Era' },
  { id: 'maker',   label: 'Maker' },
  { id: 'type',    label: 'Type' },
  { id: 'sub',     label: 'Sub-type' },
];
function _rbFacetValue(row, id) {
  if (id === 'section') return row.secLabel;
  if (id === 'era')     return row.eraLabel;
  if (id === 'maker')   return row.maker;
  if (id === 'type')    return row.type;
  if (id === 'sub')     return row.sub;
  return '';
}
// The chips for one group: every value the rows passing the OTHER groups'
// picks carry, with how many. A picked value with no rows left still shows
// (at 0) so it can be un-picked.
function _rbFacetCounts(rows, f, id) {
  const skip = (id === 'type') ? { type: 1, sub: 1 } : { [id]: 1 };
  const counts = {};
  rows.forEach(r => {
    if (!_rbRowPasses(r, f, skip)) return;
    const v = _rbFacetValue(r, id);
    if (!v) return;
    counts[v] = (counts[v] || 0) + 1;
  });
  (f[id] || []).forEach(v => { if (!(v in counts)) counts[v] = 0; });
  return counts;
}
function _rbFacetOrder(id, counts) {
  const keys = Object.keys(counts);
  if (id === 'era') {
    const rank = { 'Pre-war': 0, 'Postwar': 1, 'Modern': 2 };
    return keys.sort((a, b) => ((a in rank) ? rank[a] : 9) - ((b in rank) ? rank[b] : 9) || a.localeCompare(b));
  }
  if (id === 'section') {
    return keys.sort((a, b) => (a === 'Trains' ? -1 : b === 'Trains' ? 1 : a.localeCompare(b)));
  }
  return keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function _rbChipsHTML() {
  const f = _rbState.filters || {};
  const rows = _rbRowsCache || [];
  return _RB_FACETS.map(fc => {
    if (fc.id === 'sub' && !(f.type && f.type.length)) {
      return `<div class="rb-filter-row" data-rb-facet="sub"><div class="rb-filter-label">Sub-type</div>
        <div class="rb-hint" style="margin:0">Pick a Type above to narrow it further (Boxcar → Operating, Refrigerator…).</div></div>`;
    }
    const counts = _rbFacetCounts(rows, f, fc.id);
    const keys = _rbFacetOrder(fc.id, counts);
    if (!keys.length) {
      if (fc.id === 'sub') return `<div class="rb-filter-row" data-rb-facet="sub"><div class="rb-filter-label">Sub-type</div><div class="rb-hint" style="margin:0">None of these have a sub-type.</div></div>`;
      return '';
    }
    const sel = f[fc.id] || [];
    return `<div class="rb-filter-row" data-rb-facet="${fc.id}">
      <div class="rb-filter-label">${fc.label}${sel.length ? ` <button class="rb-clear" data-rb-clear="${fc.id}">clear</button>` : ''}</div>
      <div class="rb-filter-chips">${keys.map(k =>
        `<span class="rb-chip${sel.indexOf(k) >= 0 ? ' selected' : ''}" data-rb-facet-chip="${fc.id}" data-rb-val="${rrEsc(k)}">${rrEsc(k)} <span class="rb-chip-n">${counts[k].toLocaleString()}</span></span>`
      ).join('')}</div></div>`;
  }).join('');
}
function _rbFiltersHTML() {
  const f = _rbState.filters || {};
  const yne = (key) => ['Either','Yes','No'].map(v => `<span class="rb-chip${(!f[key]&&v==='Either')||(f[key]===v)?' selected':''}" data-rb-yn="${key}" data-rb-val="${v}">${v}</span>`).join('');
  const years = (_rbRowsCache || []).map(r => r.year).filter(Boolean);
  const yLo = years.length ? Math.min.apply(null, years) : '';
  const yHi = years.length ? Math.max.apply(null, years) : '';
  const fld = (placeholder, key, extra) =>
    `<input type="number" value="${rrEsc(f[key]||'')}" placeholder="${placeholder}" ${extra||''} data-rb-range="${key}">`;
  return `
    <div class="rb-match" id="rb-match-top"></div>
    <div id="rb-fchips">${_rbChipsHTML()}</div>
    <div class="rb-filter-grid">
      <div class="rb-filter-row"><div class="rb-filter-label">Has Box</div><div class="rb-filter-chips">${yne('hasBox')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">All Original</div><div class="rb-filter-chips">${yne('allOriginal')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">Has Photo</div><div class="rb-filter-chips">${yne('hasPhoto')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">Condition (1–10)</div>
        <div class="rb-range">${fld('Min','condMin','min="1" max="10"')} <span class="rb-to">to</span> ${fld('Max','condMax','min="1" max="10"')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">Year Made</div>
        <div class="rb-range">${fld(yLo || 'From','yearMin')} <span class="rb-to">to</span> ${fld(yHi || 'To','yearMax')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">Est. Worth</div>
        <div class="rb-range">${fld('Min','worthMin','min="0"')} <span class="rb-to">to</span> ${fld('Max','worthMax','min="0"')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">Amount Paid</div>
        <div class="rb-range">${fld('Min','paidMin','min="0"')} <span class="rb-to">to</span> ${fld('Max','paidMax','min="0"')}</div></div>
      <div class="rb-filter-row"><div class="rb-filter-label">Location (contains)</div>
        <input type="text" class="rb-text" value="${rrEsc(f.location||'')}" placeholder="e.g. Basement" data-rb-range="location"></div>
    </div>`;
}
// "N items match" — at the top of Filters and in the footer on every tab.
function _rbMatchCount() {
  const f = _rbState ? (_rbState.filters || {}) : {};
  return (_rbRowsCache || []).filter(r => _rbRowPasses(r, f, null)).length;
}
function _rbPaintMatch() {
  const n = _rbMatchCount(), total = (_rbRowsCache || []).length;
  const txt = n === total ? `All ${total.toLocaleString()} of your items` : `${n.toLocaleString()} of your ${total.toLocaleString()} items match`;
  const top = document.getElementById('rb-match-top');
  if (top) { top.textContent = txt; top.classList.toggle('none', n === 0); }
  const foot = document.getElementById('rb-match-foot');
  if (foot) { foot.textContent = txt; foot.classList.toggle('none', n === 0); }
}
function _rbRepaintFilters() {
  const box = document.getElementById('rb-fchips');
  if (box) box.innerHTML = _rbChipsHTML();
  _rbPaintMatch();
}
function _rbToggleFacet(id, val) {
  const f = _rbState.filters;
  const arr = Array.isArray(f[id]) ? f[id] : (f[id] = []);
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1); else arr.push(val);
  if (!arr.length) delete f[id];
  // A sub-type belongs to a type: with no type picked there is no sub-type,
  // and a sub-type no longer offered under the picked types is let go.
  if (id === 'type') {
    if (!f.type) delete f.sub;
    else if (f.sub) {
      const still = _rbFacetCounts(_rbRowsCache || [], f, 'sub');
      f.sub = f.sub.filter(s => still[s] > 0);
      if (!f.sub.length) delete f.sub;
    }
  }
  _rbRepaintFilters();
}
function _rbBodyClick(e) {
  const chip = e.target.closest('[data-rb-facet-chip]');
  if (chip) { _rbToggleFacet(chip.getAttribute('data-rb-facet-chip'), chip.getAttribute('data-rb-val')); return; }
  const clr = e.target.closest('[data-rb-clear]');
  if (clr) {
    const id = clr.getAttribute('data-rb-clear');
    delete _rbState.filters[id];
    if (id === 'type') delete _rbState.filters.sub;
    _rbRepaintFilters(); return;
  }
  const yn = e.target.closest('[data-rb-yn]');
  if (yn) {
    const key = yn.getAttribute('data-rb-yn'), v = yn.getAttribute('data-rb-val');
    if (v === 'Either') delete _rbState.filters[key]; else _rbState.filters[key] = v;
    yn.parentNode.querySelectorAll('.rb-chip').forEach(c => c.classList.toggle('selected', c === yn));
    _rbRepaintFilters(); return;
  }
  const flip = e.target.closest('[data-rb-flip]');
  if (flip) { _rbFlipDir(parseInt(flip.getAttribute('data-rb-flip'), 10), flip); }
}
function _rbBodyChange(e) {
  const box = e.target.closest('[data-rb-colbox]');
  if (box) { _rbToggleCol(box.getAttribute('data-rb-colbox'), box.checked); return; }
  const sel = e.target.closest('[data-rb-sortfield]');
  if (sel) {
    const i = parseInt(sel.getAttribute('data-rb-sortfield'), 10);
    _rbState.sort[i].field = sel.value;
    const btn = document.querySelector('[data-rb-flip="' + i + '"]');
    if (btn) btn.textContent = _rbDirWords(sel.value, _rbState.sort[i].dir);
  }
}
function _rbBodyInput(e) {
  const inp = e.target.closest('[data-rb-range]');
  if (!inp) return;
  const key = inp.getAttribute('data-rb-range');
  if (String(inp.value).trim() === '') delete _rbState.filters[key]; else _rbState.filters[key] = inp.value;
  _rbRepaintFilters();
}

// ── Sort tab ─────────────────────────────────────────────────────
// The direction words fit the column: numbers Low → High, dates Oldest →
// Newest, everything else A → Z.
function _rbSortKind(key) {
  if (_RB_NUM_KEYS[key]) return 'num';
  if (_RB_YEAR_KEYS[key]) return 'year';
  if (_RB_DATE_KEYS[key]) return 'date';
  return 'text';
}
function _rbDirWords(key, dir) {
  const k = _rbSortKind(key);
  const w = k === 'num' ? ['Low → High', 'High → Low']
    : (k === 'year' || k === 'date') ? ['Oldest → Newest', 'Newest → Oldest']
    : ['A → Z', 'Z → A'];
  return dir === 'desc' ? w[1] : w[0];
}
function _rbSortHTML() {
  const sort = _rbState.sort || (_rbState.sort = []);
  while (sort.length<2) sort.push({field:'',dir:'asc'});
  const cols = _rbColumns(_rbRowsCache, _rbState);
  const opts = (sel) => '<option value="">— None —</option>'
    + cols.map(c=>`<option value="${rrEsc(c.key)}"${sel===c.key?' selected':''}>${rrEsc(c.label)}</option>`).join('');
  const row = (s,i) => `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.7rem">
      <div style="font-size:0.75rem;color:var(--text-dim);width:4.5rem;flex-shrink:0;text-align:right">${i===0?'Sort by':'then by'}</div>
      <select data-rb-sortfield="${i}"
        style="flex:1;padding:0.45rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none">
        ${opts(s.field)}
      </select>
      <button class="rb-sort-dir ${s.dir}" data-rb-flip="${i}">${_rbDirWords(s.field, s.dir)}</button>
    </div>`;
  return '<div class="rb-hint">The report is put in order by the first choice; the second decides between rows that tie.</div>'
    + sort.map((s,i)=>row(s,i)).join('');
}
window._rbFlipDir = (idx, btn) => {
  const s = _rbState.sort[idx];
  s.dir = s.dir==='asc'?'desc':'asc';
  btn.textContent = _rbDirWords(s.field, s.dir);
  btn.className = 'rb-sort-dir ' + s.dir;
};

// ── Save / Load ──────────────────────────────────────────────────
// v0.9.1985: saved reports are an ACCOUNT setting — written through the one
// settings door (_prefSet, via rrPrefWrite) and read through the one reader
// (_prefGet, via rrPrefRead), so a report built on the computer is there on
// the phone. ONE reader and ONE writer here; nothing else touches the key.
const RB_SAVED_KEY = 'lv_saved_reports';
function _rbReadSaved() {
  try {
    const raw = (typeof rrPrefRead === 'function') ? rrPrefRead(RB_SAVED_KEY) : localStorage.getItem(RB_SAVED_KEY);
    const a = JSON.parse(raw || '[]');
    return Array.isArray(a) ? a.filter(r => r && r.id) : [];
  } catch (e) { return []; }
}
function _rbWriteSaved(list) {
  const txt = JSON.stringify(list || []);
  if (typeof rrPrefWrite === 'function') rrPrefWrite(RB_SAVED_KEY, txt);
  else localStorage.setItem(RB_SAVED_KEY, txt);
}
// What is stored is the truth: every visit to Reports reads it fresh (an
// account sync may have brought a report from another device meanwhile).
function _rbSyncSaved() {
  state.savedReports = _rbReadSaved();
  return state.savedReports;
}

function _rbSave() {
  const nameEl = document.getElementById('rb-name');
  if (nameEl) _rbState.name = nameEl.value.trim();
  if (!_rbState.name) {
    if (nameEl) { nameEl.style.borderColor='var(--accent)'; nameEl.focus(); }
    showToast('Give your report a name first', 2500, true); return;
  }
  if (!_rbEnabledOrder().length) {
    showToast('Tick at least one column', 2500, true); return;
  }
  _rbState.colOrder = _rbEnabledOrder().concat((_rbState.colOrder || []).filter(k => !_rbState.colEnabled[k]));
  if (!_rbState.id) _rbState.id = 'rpt_' + Date.now().toString(36);
  // Read the stored list at the moment of saving — never write a list that
  // was read before another report was added (that is how reports were lost).
  const list = _rbReadSaved();
  const idx = list.findIndex(r=>r.id===_rbState.id);
  if (idx>=0) list[idx] = _rbState;
  else list.push(_rbState);
  _rbWriteSaved(list);
  state.savedReports = list;
  _rbRefreshDropdown(); if (typeof renderReportLibrary==='function') renderReportLibrary();
  const savedName = _rbState.name, savedId = _rbState.id;
  _rbCloseOverlay();
  const sel = document.getElementById('report-type');
  if (sel) { sel.value = 'custom:'+savedId; buildReport(); _rbUpdateCustomControls(); }
  showToast('✓ Report "'+savedName+'" saved');
}

function _rbRefreshDropdown() {
  const sel = document.getElementById('report-type');
  if (!sel) return;
  sel.querySelectorAll('option[data-custom],optgroup[data-custom-grp]').forEach(o=>o.remove());
  const saved = state.savedReports || [];
  if (!saved.length) return;
  const grp = document.createElement('optgroup');
  grp.label = 'My Saved Reports';
  grp.dataset.customGrp = '1';
  saved.forEach(r => {
    const opt = document.createElement('option');
    opt.value = 'custom:'+r.id; opt.dataset.custom=r.id; opt.textContent=r.name;
    grp.appendChild(opt);
  });
  sel.appendChild(grp);
}

function loadSavedReports() {
  _rbSyncSaved();
  _rbRefreshDropdown(); if (typeof renderReportLibrary==='function') renderReportLibrary();
}

function _rbUpdateCustomControls() {
  const sel = document.getElementById('report-type');
  const ctrl = document.getElementById('rb-custom-controls');
  if (!ctrl) return;
  const isCustom = sel?.value?.startsWith('custom:');
  ctrl.style.display = isCustom ? 'flex' : 'none';
}

function _rbEditSelected() {
  const sel = document.getElementById('report-type');
  if (!sel?.value?.startsWith('custom:')) return;
  openReportBuilder(sel.value.replace('custom:',''));
}

async function _rbDeleteSelected() {
  const sel = document.getElementById('report-type');
  if (!sel?.value?.startsWith('custom:')) return;
  const id  = sel.value.replace('custom:','');
  const rpt = _rbReadSaved().find(r=>r.id===id);
  const okDel = await appConfirm('Delete report "' + rrEsc(rpt?.name||'this report') + '"?', { danger: true, ok: 'Delete', title: 'Delete report' });
  if (!okDel) return;
  const list = _rbReadSaved().filter(r=>r.id!==id);
  _rbWriteSaved(list);
  state.savedReports = list;
  _rbRefreshDropdown(); if (typeof renderReportLibrary==='function') renderReportLibrary();
  sel.value = 'insurance';
  buildReport();
  _rbUpdateCustomControls();
  showToast('Report deleted');
}


// ── The rows a custom report can hold — ONE gatherer (v0.9.1985) ─────────
// Every owned row on every tab, as { pd, master, sec, secLabel, era,
// eraLabel, maker, type, sub, year }. pd is the row's own record — for the
// tabs that keep their own columns (catalogs, paper, mock-ups and other on a
// pre-v0.9.990 sheet, instruction sheets, science and construction sets) it
// is that record read into My Collection's field names, so every column and
// every filter below reads one shape. Sets are NOT rows of their own: a set's
// pieces are already in My Collection, and counting the set too would count
// its worth twice.
const _RB_SECTION_LABELS = { items: 'Trains', is: 'Instruction Sheets', science: 'Science Sets', construction: 'Construction Sets' };
const _RB_ERA_LABELS = { prewar: 'Pre-war', postwar: 'Postwar', modern: 'Modern' };
function _rbSectionLabel(sec) {
  if (_RB_SECTION_LABELS[sec]) return _RB_SECTION_LABELS[sec];
  const t = (typeof ephTab === 'function') ? ephTab(sec) : null;
  if (t) return t.label;
  const ut = ((typeof state !== 'undefined' && state.userDefinedTabs) || []).find(x => x && x.id === sec);
  return ut ? ut.label : sec;
}
function _rbYearOf(v) {
  const m = String(v == null ? '' : v).match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? parseInt(m[1], 10) : 0;
}
function _rbMakerLabel(word) {
  const w = String(word || '').trim();
  if (!w) return '';
  const WIC = (typeof window !== 'undefined' && window.WHAT_I_COLLECT) || {};
  const mc = WIC.MANUFACTURERS && WIC.MANUFACTURERS[w.toLowerCase()];
  return (mc && mc.label) || w;
}
// The kind of item a section holds, in the words its Type is written with
// ("Catalog", "Paper Item", "Instruction Sheet"…).
function _rbSectionKind(sec) {
  const t = (typeof ephTab === 'function') ? ephTab(sec) : null;
  if (t) return t.single;
  if (sec === 'is') return 'Instruction Sheet';
  if (sec === 'science') return 'Science Set';
  if (sec === 'construction') return 'Construction Set';
  return _rbSectionLabel(sec);
}
// The Type a row is filed under: a train by the catalog's own groups
// (getTypeBucket — the same answer the Dashboard counts by); anything else
// by its section's kind — so Type → Sub-type reads the same everywhere:
// Boxcar → Operating Boxcar, Catalog → Consumer, Paper Item → Poster.
function _rbTypeOf(pd, master, sec) {
  if (sec !== 'items') return _rbSectionKind(sec);
  let b = '';
  try {
    if (typeof getTypeBucket === 'function') {
      b = (master && Object.keys(master).length) ? getTypeBucket(master)
        : getTypeBucket({ itemType: pd.itemType || '', description: pd.description || '', _personalOnly: true });
    }
  } catch (e) {}
  return b || String((master && master.itemType) || pd.itemType || '').trim();
}
// The Sub-type: the user's own Sub Type first; for a train then the
// catalog's sub type, then the catalog's Type word when it says more than the
// group does (a Refrigerator Car under Boxcar). Spelling-only differences
// ("Box Car") are not a sub-type. A catalog's Consumer / Advance and a paper
// item's kind arrive as the row's own sub type (_rbFromOwnTab).
function _rbSubOf(pd, master, sec, type) {
  const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const own = String(pd.subType || '').trim();
  if (own && flat(own) !== flat(type)) return own;
  if (sec !== 'items') return '';
  const ms = String((master && master.subType) || '').trim();
  if (ms && flat(ms) !== flat(type)) return ms;
  const mt = String((master && master.itemType) || '').trim();
  if (mt && flat(mt) !== flat(type)) {
    const lbl = ((window.TYPE_BUCKETS || []).find(b => b.id === type) || {}).label;
    if (!lbl || flat(mt) !== flat(lbl)) return mt;
  }
  return '';
}
function _rbRowOf(pd, master, sec) {
  master = master || {};
  let eraKey = null;
  try {
    if (typeof _itemEraPeriod === 'function') {
      eraKey = _itemEraPeriod({
        eraPeriod: pd.eraPeriod, yearProd: master.yearProd, yearMade: pd.yearMade,
        _era: master._era || pd.era, era: pd.era, _tab: master._tab,
      });
    }
  } catch (e) {}
  let makerWord = String(pd.manufacturer || '').trim();
  if (!makerWord && Object.keys(master).length) {
    try { makerWord = (typeof _manufacturerOfItem === 'function') ? (_manufacturerOfItem(master) || '') : ''; } catch (e) {}
  }
  const type = _rbTypeOf(pd, master, sec);
  return {
    pd, master, sec,
    secLabel: _rbSectionLabel(sec),
    era: eraKey || '',
    eraLabel: _RB_ERA_LABELS[eraKey] || 'Not dated',
    maker: _rbMakerLabel(makerWord),
    type: type,
    sub: _rbSubOf(pd, master, sec, type),
    year: _rbYearOf(pd.yearMade) || _rbYearOf(master.yearProd),
  };
}
// A record from one of the tabs with their own columns, in My Collection's
// field names.
function _rbFromOwnTab(rec, sec) {
  const typeWord = _rbSectionKind(sec);
  const desc = sec === 'is'
    ? ['Instruction sheet', rec.linkedItem ? 'for ' + rec.linkedItem : '', rec.formCode || ''].filter(Boolean).join(' ')
    : [rec.title || '', (rec.description && rec.description !== rec.title) ? rec.description : ''].filter(Boolean).join(' — ');
  return {
    _ownTab: sec,
    itemNum: rec.itemNum || rec.sheetNum || '',
    itemType: typeWord,
    description: desc || rec.description || '',
    variation: rec.variation || '',
    yearMade: rec.year || '',
    manufacturer: rec.manufacturer || '',
    condition: rec.condition || '',
    allOriginal: rec.allOriginal || '',
    hasBox: rec.hasCase || rec.hasMailer || '',
    boxCond: rec.caseCond || '',
    priceItem: rec.pricePaid || '',
    userEstWorth: rec.estValue || rec.estWorth || '',
    datePurchased: rec.dateAcquired || '',
    notes: rec.notes || '',
    photoItem: rec.photoLink || '',
    groupId: rec.groupId || '',
    inventoryId: rec.inventoryId || '',
    subType: rec.catType || rec.paperType || '',
  };
}
// The section a My Collection row is in, by what it IS (its Type) — the rule
// My Collection's Show chips use (ephSectionOfType, config.js).
function _rbSectionOfPd(pd, master) {
  const t = pd.itemType || (master && master.itemType) || '';
  const eph = (typeof ephSectionOfType === 'function') ? ephSectionOfType(t) : '';
  if (eph) return eph;
  const tl = String(t).trim().toLowerCase();
  if (tl === 'science set') return 'science';
  if (tl === 'construction set') return 'construction';
  if (tl === 'instruction sheet') return 'is';
  return 'items';
}
function _rbAllRows() {
  const out = [];
  Object.values(state.personalData || {}).forEach(pd => {
    if (!pd || !pd.owned) return;
    // The rule every collection report has always used: a box entered on
    // its own, with no condition and no price, is part of its item, not an
    // item of its own.
    const condVal = pd.condition?.toString().trim(), priceVal = pd.priceItem?.toString().trim();
    const noC = !condVal||condVal==='N/A', noP = !priceVal||priceVal==='N/A';
    if (pd.hasBox==='Yes' && noC && noP) return;
    const master = (typeof findMaster === 'function' ? findMaster(pd.itemNum, pd.variation, pd) : null) || {};
    out.push(_rbRowOf(pd, master, _rbSectionOfPd(pd, master)));
  });
  Object.entries(state.ephemeraData || {}).forEach(([sec, bucket]) => {
    Object.values(bucket || {}).forEach(rec => { if (rec) out.push(_rbRowOf(_rbFromOwnTab(rec, sec), {}, sec)); });
  });
  [['is', state.isData], ['science', state.scienceData], ['construction', state.constructionData]].forEach(([sec, bucket]) => {
    Object.values(bucket || {}).forEach(rec => { if (rec) out.push(_rbRowOf(_rbFromOwnTab(rec, sec), {}, sec)); });
  });
  return out;
}

// Does a row pass the filters? `skip` names filter groups to leave out (the
// chip counts ask "how many if I picked this", so a group is counted with
// every OTHER group's picks in force).
function _rbRowPasses(row, f, skip) {
  f = f || {}; skip = skip || {};
  const pd = row.pd, master = row.master;
  const inList = (id, v) => skip[id] || !Array.isArray(f[id]) || !f[id].length || f[id].indexOf(v) >= 0;
  if (!inList('section', row.secLabel)) return false;
  if (!inList('era', row.eraLabel)) return false;
  if (!inList('maker', row.maker)) return false;
  if (!inList('type', row.type)) return false;
  if (!inList('sub', row.sub)) return false;
  // A report saved before v0.9.1985 and not opened since: its raw Type words.
  if (Array.isArray(f.itemType) && f.itemType.length && f.itemType.indexOf(master.itemType || pd.itemType || '') < 0) return false;
  if (f.hasBox && f.hasBox!=='Either' && pd.hasBox!==f.hasBox) return false;
  if (f.allOriginal && f.allOriginal!=='Either' && pd.allOriginal!==f.allOriginal) return false;
  if (f.hasPhoto && f.hasPhoto!=='Either') { const h=!!pd.photoItem; if(f.hasPhoto==='Yes'&&!h) return false; if(f.hasPhoto==='No'&&h) return false; }
  if (f.quickEntry && f.quickEntry!=='Include') { const q=!!pd.quickEntry; if(f.quickEntry==='Exclude'&&q) return false; if(f.quickEntry==='Only'&&!q) return false; }
  const num = (v) => parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  const rng = (fMin, fMax, v) => {
    const has = (x) => x !== '' && x !== undefined && x !== null && !isNaN(parseFloat(x));
    if (!has(fMin) && !has(fMax)) return true;
    if (isNaN(v)) return false;
    if (has(fMin) && v < parseFloat(fMin)) return false;
    if (has(fMax) && v > parseFloat(fMax)) return false;
    return true;
  };
  if (!rng(f.condMin,  f.condMax,  num(pd.condition))) return false;
  if (!rng(f.yearMin,  f.yearMax,  row.year || NaN)) return false;
  if (!rng(f.worthMin, f.worthMax, num(pd.userEstWorth))) return false;
  if (!rng(f.paidMin,  f.paidMax,  num(pd.priceComplete||pd.priceItem))) return false;
  if (f.location && String(f.location).trim() && !(pd.location||'').toLowerCase().includes(String(f.location).trim().toLowerCase())) return false;
  return true;
}

// ── Run a custom report ──────────────────────────────────────────
// ── v0.9.1553 (Brad, looking at his PDF: "6-22477 6-22477 Lionel Tin Sign
// Replica") ────────────────────────────────────────────────────────────
// Plenty of catalog descriptions begin with the item's own number, because
// that is how the source lists them. Printed next to an Item # column it
// reads as a stutter and eats the width the description actually needs.
// Strip a leading copy of THIS item's number — and only that; a number that
// belongs to the description ("6464-1970 uncataloged boxcar" under item
// 6-19212) is left alone.
function _repCleanDesc(desc, itemNum) {
  var d = String(desc == null ? '' : desc).trim();
  var n = String(itemNum == null ? '' : itemNum).trim();
  if (!d || !n) return d;
  var bare = function (v) { return v.replace(/^6-/, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); };
  var first = d.split(/\s+/)[0];
  if (first && bare(first) === bare(n)) {
    var rest = d.slice(first.length).trim().replace(/^[-–—:]\s*/, '');
    if (rest) return rest;
  }
  return d;
}
if (typeof window !== 'undefined') window._repCleanDesc = _repCleanDesc;

// The words one cell shows. `row` (from _rbAllRows) carries what the row IS
// — section, era, maker — worked out once.
function _rbCellVal(key, pd, master, row) {
  master = master || {}; row = row || {};
  switch(key) {
    case 'itemNum':       return pd.itemNum || '';
    case 'description':   return _repCleanDesc(master.roadName || master.description || pd.description || pd.masterDescription || '', pd.itemNum);
    case 'manufacturer':  return row.maker || _rbMakerLabel(pd.manufacturer);
    case 'section':       return row.secLabel || '';
    case 'itemType':      return master.itemType || pd.itemType || '';
    case 'eraPeriod':     return row.era ? (_RB_ERA_LABELS[row.era] || '') : '';
    case 'yearMade':      return pd.yearMade || master.yearProd || '';
    case 'variation':     return pd.variation || '';
    case 'varDesc':       return master.varDesc || master.variationDesc || pd.variationDescription || '';
    case 'roadName':      return pd.roadName || master.roadName || '';
    case 'roadNumber':    return pd.roadNumber || master.roadNumber || '';
    case 'condition':     return pd.condition || '';
    case 'allOriginal':   return pd.allOriginal || '';
    case 'hasBox':        return pd.hasBox || '';
    case 'boxCond':       return pd.boxCond || '';
    case 'priceItem':     return pd.priceComplete || pd.priceItem || '';
    case 'userEstWorth':  return pd.userEstWorth || '';
    case 'datePurchased': return pd.datePurchased || '';
    case 'location':      return pd.location || '';
    case 'notes':         return pd.notes || '';
    case 'hasPhoto':      return pd.photoItem ? 'Yes' : 'No';
    case 'groupId':       return pd.groupId || '';
    case 'isError':       return pd.isError || '';
    case 'subType':       return pd.subType || master.subType || '';
    default:
      // Every other column is a plain value on the personal row: Your Grade,
      // Bought From, Date Added, Your Description and the user's own fields
      // (RR_USER_FIELDS).
      return (pd[key] != null) ? String(pd[key]) : '';
  }
}

function _rbCellHTML(key, val) {
  if (!val || val==='—') {
    if (['priceItem','userEstWorth'].includes(key)) return '—';
    return '<span class="text-dim">—</span>';
  }
  const sym = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
  switch(key) {
    case 'itemNum':      return `<span class="item-num">${rrEsc(val)}</span>`;
    case 'itemType':     return `<span class="tag">${rrEsc(val)}</span>`;
    case 'priceItem':
    case 'userEstWorth': { const n = parseFloat(String(val).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? rrEsc(val) : `<span style="font-family:var(--font-mono);color:var(--accent2)">${sym}${n.toLocaleString()}</span>`; }
    case 'hasPhoto':     return val==='Yes' ? '<span style="color:var(--t-green)">✓</span>' : '<span class="text-dim">—</span>';
    default:             return rrEsc(val);
  }
}

// The rows of a saved report, filtered and in order. Each is the row from
// _rbAllRows ({ pd, master, … }).
function _rbGetItems(def) {
  // A report saved by an older release runs exactly as it always did (its raw
  // Type words); it is moved to the Type chips only when opened to edit.
  const f = (def && def.filters) || {};
  let items = _rbAllRows().filter(r => _rbRowPasses(r, f, null));
  const sorts = ((def && def.sort)||[]).filter(s=>s.field);
  if (sorts.length) {
    items.sort((a,b) => {
      for (const s of sorts) {
        const va=_rbCellVal(s.field,a.pd,a.master,a), vb=_rbCellVal(s.field,b.pd,b.master,b);
        const kind = _rbSortKind(s.field);
        let cmp;
        if (kind === 'num') cmp = (parseFloat(String(va).replace(/[^0-9.\-]/g,''))||0)-(parseFloat(String(vb).replace(/[^0-9.\-]/g,''))||0);
        else if (kind === 'year') cmp = (_rbYearOf(va)||0)-(_rbYearOf(vb)||0);
        else if (kind === 'date') cmp = ((Date.parse(va)||0)-(Date.parse(vb)||0));
        else cmp = String(va).localeCompare(String(vb),undefined,{numeric:true});
        if (cmp!==0) return s.dir==='desc'?-cmp:cmp;
      }
      return 0;
    });
  }
  return items;
}
// The columns a saved report shows, in its order, with today's labels.
function _rbReportCols(def) {
  const cols = _rbColumns(null, def);
  const known = {}; cols.forEach(c => { known[c.key] = c; });
  const order = (def.colOrder||REPORT_COLS.map(c=>c.key)).filter(k=>def.colEnabled?.[k] && known[k]);
  Object.keys(def.colEnabled || {}).forEach(k => { if (def.colEnabled[k] && known[k] && order.indexOf(k) < 0) order.push(k); });
  return order.map(k => known[k]);
}

function buildCustomReport(def) {
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  if (!thead||!tbody) return;
  const _insHdr = document.getElementById('ins-report-hdr');
  if (_insHdr) _insHdr.style.display='none';

  const cols = _rbReportCols(def);

  if (!cols.length) { tbody.innerHTML=`<tr><td class="ui-empty">No columns selected — click Edit to configure</td></tr>`; return; }

  thead.innerHTML = '<tr>' + cols.map(c=>`<th>${rrEsc(c.label)}</th>`).join('') + '</tr>';
  const items = _rbGetItems(def);
  if (!items.length) {
    tbody.innerHTML=`<tr><td colspan="${cols.length}" class="ui-empty">No items match these filters</td></tr>`; return;
  }

  tbody.innerHTML = items.map(r =>
    '<tr>'+cols.map(c=>`<td>${_rbCellHTML(c.key,_rbCellVal(c.key,r.pd,r.master,r))}</td>`).join('')+'</tr>'
  ).join('');

  // Totals row for money columns
  const moneyCols = cols.filter(c=>['priceItem','userEstWorth'].includes(c.key));
  if (moneyCols.length) {
    const sym = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
    const totals = Object.fromEntries(moneyCols.map(c=>[c.key, items.reduce((s,r)=>s+(parseFloat(String(_rbCellVal(c.key,r.pd,r.master,r)).replace(/[^0-9.\-]/g,''))||0),0)]));
    tbody.innerHTML += '<tr style="border-top:2px solid var(--border);font-weight:700">'
      + cols.map((c, i)=>{
          if (i===0 && totals[c.key]===undefined) return `<td style="color:var(--text-dim);font-size:0.78rem">${items.length.toLocaleString()} items</td>`;
          if (totals[c.key]!==undefined) return `<td style="font-family:var(--font-mono);color:var(--accent2)">${sym}${Math.round(totals[c.key]).toLocaleString()}</td>`;
          return '<td></td>';
        }).join('') + '</tr>';
  }
}

function exportCustomReport(def) {
  const cols = _rbReportCols(def);
  const items = _rbGetItems(def);
  const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
  const header = cols.map(c=>esc(c.label)).join(',');
  const rows = items.map(r=>cols.map(c=>esc(_rbCellVal(c.key,r.pd,r.master,r))).join(','));
  const csv = header + '\n' + rows.join('\n');
  const safeName = (def.name||'report').replace(/[^a-z0-9]/gi,'-').toLowerCase();
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; const _cn = _repCsvName(safeName); a.download=_cn; a.click(); _repKeepCsv(blob, _cn);
}

// ── PREFERENCES ─────────────────────────────────────────────────

// APP_VERSION, APP_DATE, _RSV_PLACEHOLDER_PNG defined in config.js


