// ═══════════════════════════════════════════════════════════════
// REPORTS — buildReport, exportReport, custom report builder
// Loaded after app.js. Reads from state, _prefGet, sheetsGet.
// ═══════════════════════════════════════════════════════════════

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
      const master_a = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(a.itemNum)) || {};
      const master_b = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(b.itemNum)) || {};
      const typeA = master_a.itemType || 'ZZZ';
      const typeB = master_b.itemType || 'ZZZ';
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      return (a.itemNum || '').localeCompare(b.itemNum || '', undefined, { numeric: true });
    });

    let totalWorth = 0;
    let totalPaid  = 0;
    ownedItems.forEach(pd => {
      totalWorth += parseFloat(pd.userEstWorth || 0);
      totalPaid  += parseFloat(pd.priceComplete || pd.priceItem || 0);
    });

    // Inject header above table
    const tableWrap = document.querySelector('#page-reports .table-wrap');
    let hdrEl = document.getElementById('ins-report-hdr');
    if (!hdrEl) {
      hdrEl = document.createElement('div');
      hdrEl.id = 'ins-report-hdr';
      tableWrap.parentNode.insertBefore(hdrEl, tableWrap);
    }
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
        ${totalPaid > 0 ? `<span>Total Paid: <strong>$${Math.round(totalPaid).toLocaleString()}</strong></span>` : ''}
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
        case 'description': return { text: master.roadName || master.description || master.itemType || '—' };
        case 'year':        return { text: pd.yearMade || master.yearProd || '—' };
        case 'variation':   return { text: pd.variation || '—' };
        case 'condition':   return { text: pd.condition || '—' };
        case 'allOriginal': return { text: pd.allOriginal || '—' };
        case 'hasBox':      return { text: pd.hasBox || '—' };
        case 'boxCond':     return { text: pd.boxCond || '—' };
        case 'estWorth':    return { text: pd.userEstWorth ? '$' + parseFloat(pd.userEstWorth).toLocaleString() : '—' };
        case 'pricePaid': {
          const paid = pd.priceComplete || pd.priceItem;
          return { text: paid ? '$' + parseFloat(paid).toLocaleString() : '—' };
        }
        case 'notes':       return { text: pd.notes || '' };
        default:            return { text: (pd[col.key] != null ? String(pd[col.key]) : '—') };
      }
    }

    tbody.innerHTML = ownedItems.map((pd, idx) => {
      const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum)) || {};
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
    if (!footEl) {
      footEl = document.createElement('div');
      footEl.id = 'ins-report-foot';
      tableWrap.parentNode.insertBefore(footEl, tableWrap.nextSibling);
    }
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

  if (type === 'wantlist') {
    thead.innerHTML = '<tr><th>Item #</th><th>Type</th><th>Description</th><th>Variation Description</th><th>Est. Market Value</th></tr>';
    const wants = state.masterData.filter(i => !state.personalData[`${i.itemNum}|${i.variation}`]?.owned);
    tbody.innerHTML = wants.map(i => `
      <tr>
        <td><span class="item-num">${i.itemNum}</span></td>
        <td><span class="tag">${i.itemType || '—'}</span></td>
        <td>${i.roadName || i.description || '—'}</td>
        <td>${i.varDesc || i.variation || '—'}</td>
        <td class="market-val">${i.marketVal ? '$'+parseFloat(i.marketVal).toLocaleString() : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="ui-empty">All items owned! 🎉</td></tr>';

  } else if (type === 'collection') {
    thead.innerHTML = '<tr><th>Item #</th><th>Type</th><th>Road Name</th><th>Variation</th><th>Copy #</th><th>Condition</th><th>Has Box</th><th>All Original</th><th>Item Price</th><th>Item+Box</th></tr>';
    const owned = state.masterData.filter(i => state.personalData[`${i.itemNum}|${i.variation}`]?.owned);
    tbody.innerHTML = owned.map(i => {
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      return `<tr>
        <td><span class="item-num">${i.itemNum}</span></td>
        <td><span class="tag">${i.itemType || '—'}</span></td>
        <td>${i.roadName || '—'}</td>
        <td>${i.variation || '—'}</td>
        <td>${pd.copy || '1'}</td>
        <td>${pd.condition || '—'}</td>
        <td>${pd.hasBox || '—'}</td>
        <td>${pd.allOriginal || '—'}</td>
        <td class="market-val">${pd.priceItem ? '$'+parseFloat(pd.priceItem).toLocaleString() : '—'}</td>
        <td class="market-val">${pd.priceComplete ? '$'+parseFloat(pd.priceComplete).toLocaleString() : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="ui-empty">No owned items yet</td></tr>';

  } else if (type === 'value') {
    thead.innerHTML = '<tr><th>Category</th><th>Owned</th><th>Total in Master</th><th>% Complete</th><th>Est. Collection Value</th></tr>';
    const cats = {};
    state.masterData.forEach(i => {
      const t = i.itemType || 'Other';
      if (!cats[t]) cats[t] = { total: 0, owned: 0, value: 0 };
      cats[t].total++;
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      if (pd?.owned) {
        cats[t].owned++;
        cats[t].value += parseFloat(pd.priceComplete || pd.priceItem || 0);
      }
    });
    tbody.innerHTML = Object.entries(cats).sort((a,b)=>b[1].owned-a[1].owned).map(([name, c]) => `
      <tr>
        <td>${name}</td>
        <td>${c.owned}</td>
        <td>${c.total}</td>
        <td>${c.total > 0 ? Math.round(c.owned/c.total*100) + '%' : '—'}</td>
        <td class="market-val">${c.value > 0 ? '$'+Math.round(c.value).toLocaleString() : '—'}</td>
      </tr>`).join('');

  } else if (type === 'missing-box') {
    thead.innerHTML = '<tr><th>Item #</th><th>Type</th><th>Road Name</th><th>Condition</th><th>Amount Paid</th></tr>';
    const noBox = state.masterData.filter(i => {
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      return pd?.owned && pd?.hasBox !== 'Yes';
    });
    tbody.innerHTML = noBox.map(i => {
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      return `<tr>
        <td><span class="item-num">${i.itemNum}</span></td>
        <td><span class="tag">${i.itemType || '—'}</span></td>
        <td>${i.roadName || '—'}</td>
        <td>${pd.condition || '—'}</td>
        <td class="market-val">${i.marketVal ? '$'+parseFloat(i.marketVal).toLocaleString() : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="ui-empty">All owned items have boxes!</td></tr>';
  }
}

function exportReport() {
  const type = document.getElementById('report-type')?.value || '';

  if (type.startsWith('custom:')) {
    const id = type.replace('custom:','');
    const def = (state.savedReports||[]).find(r=>r.id===id);
    if (def) exportCustomReport(def);
    return;
  }

  if (type === 'insurance') {
    const headers = ['Item #','Description','Type','Year','Variation','Condition','All Original','Has Box','Box Condition','Est. Worth','Amount Paid','Notes','Photo Folder Link'];
    const ownedItems = Object.values(state.personalData).filter(pd => {
      if (!pd.owned) return false;
      const condVal  = pd.condition?.toString().trim();
      const priceVal = pd.priceItem?.toString().trim();
      const noCondition = !condVal  || condVal  === '' || condVal  === 'N/A';
      const noItemPrice = !priceVal || priceVal === '' || priceVal === 'N/A';
      return !(pd.hasBox === 'Yes' && noCondition && noItemPrice);
    });
    ownedItems.sort((a, b) => {
      const ma = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(a.itemNum)) || {};
      const mb = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(b.itemNum)) || {};
      if ((ma.itemType||'ZZZ') !== (mb.itemType||'ZZZ')) return (ma.itemType||'ZZZ').localeCompare(mb.itemType||'ZZZ');
      return (a.itemNum||'').localeCompare(b.itemNum||'', undefined, { numeric: true });
    });
    const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
    const rows = ownedItems.map(pd => {
      const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum)) || {};
      return [
        esc(pd.itemNum), esc(master.roadName || master.description || ''),
        esc(master.itemType || ''), esc(pd.yearMade || master.yearProd || ''),
        esc(pd.variation || ''), esc(pd.condition || ''), esc(pd.allOriginal || ''),
        esc(pd.hasBox || ''), esc(pd.boxCond || ''),
        esc(pd.userEstWorth || ''), esc(pd.priceComplete || pd.priceItem || ''),
        esc(pd.notes || ''), esc(pd.photoItem || ''),
      ].join(',');
    });
    const dateTag = new Date().toISOString().slice(0,10);
    const csv = headers.map(h => `"${h}"`).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `insurance-report-${dateTag}.csv`; a.click();
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
  const a = document.createElement('a'); a.href = url; a.download = 'my-collection-report.csv'; a.click();
}

// ── REPORT BUILDER ───────────────────────────────────────────────

const REPORT_COLS = [
  { key:'itemNum',       label:'Item #'          },
  { key:'description',   label:'Description'     },
  { key:'itemType',      label:'Type'            },
  { key:'yearMade',      label:'Year Made'       },
  { key:'variation',     label:'Variation #'     },
  { key:'varDesc',       label:'Variation Desc.' },
  { key:'condition',     label:'Condition'       },
  { key:'allOriginal',   label:'All Original'    },
  { key:'hasBox',        label:'Has Box'         },
  { key:'boxCond',       label:'Box Condition'   },
  { key:'priceItem',     label:'Amount Paid'     },
  { key:'userEstWorth',  label:'Est. Worth'      },
  { key:'datePurchased', label:'Date Acquired'   },
  { key:'location',      label:'Location'        },
  { key:'notes',         label:'Notes'           },
  { key:'hasPhoto',      label:'Has Photo'       },
  { key:'groupId',       label:'Set/Group ID'    },
  { key:'isError',       label:'Error Variation' },
];

let _rbState  = null;
let _rbActiveTab = 'columns';

function openReportBuilder(editId) {
  const existing = editId ? (state.savedReports||[]).find(r=>r.id===editId) : null;
  _rbState = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: null, name: '',
    colOrder:   REPORT_COLS.map(c=>c.key),
    colEnabled: Object.fromEntries(REPORT_COLS.map(c=>[c.key,
      ['itemNum','description','itemType','yearMade','condition','hasBox','priceItem','userEstWorth'].includes(c.key)
    ])),
    filters: {},
    sort: [{ field:'itemType', dir:'asc' },{ field:'itemNum', dir:'asc' }],
  };
  _rbActiveTab = 'columns';

  const ov = document.createElement('div');
  ov.className = 'rb-overlay'; ov.id = 'rb-overlay';
  ov.innerHTML = `
    <div class="rb-sheet">
      <div style="padding:1rem 1.25rem 0;flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.65rem">
          <div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700">${existing?'Edit Report':'Build a Report'}</div>
          <button onclick="_rbCloseOverlay()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:6px">✕</button>
        </div>
        <input type="text" id="rb-name" value="${(_rbState.name||'').replace(/"/g,'&quot;')}"
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
      <div style="padding:0.85rem 1.25rem;border-top:1px solid var(--border);display:flex;gap:0.6rem;flex-shrink:0">
        <button onclick="_rbCloseOverlay()"
          style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Cancel</button>
        <button onclick="_rbSave()"
          style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent2);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">Save Report</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
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
  if (tab==='columns') { body.innerHTML = _rbColumnsHTML(); _rbAttachDrag(); }
  else if (tab==='filters') body.innerHTML = _rbFiltersHTML();
  else if (tab==='sort')    body.innerHTML = _rbSortHTML();
}

// ── Columns tab ──────────────────────────────────────────────────
function _rbColumnsHTML() {
  return '<div style="font-size:0.74rem;color:var(--text-dim);margin-bottom:0.75rem">Check columns to include · Drag <strong>⠿</strong> to reorder</div>'
    + '<div id="rb-col-list">'
    + _rbState.colOrder.map((key,idx) => {
        const col = REPORT_COLS.find(c=>c.key===key); if (!col) return '';
        const on = !!_rbState.colEnabled[key];
        return `<div class="rb-col-item" draggable="true" data-key="${key}" data-idx="${idx}">
          <span class="rb-drag-handle" title="Drag to reorder">⠿</span>
          <input type="checkbox" id="rbcol-${key}" ${on?'checked':''} onchange="_rbToggleCol('${key}',this.checked)">
          <label for="rbcol-${key}" style="${on?'':'color:var(--text-dim)'}">${col.label}</label>
        </div>`;
      }).join('')
    + '</div>';
}

function _rbAttachDrag() {
  const list = document.getElementById('rb-col-list');
  if (!list) return;
  let src = null;
  list.addEventListener('dragstart', e => {
    const el = e.target.closest('.rb-col-item'); if (!el) return;
    src = parseInt(el.dataset.idx);
    setTimeout(()=>el.classList.add('dragging'),0);
    e.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragend', e => {
    e.target.closest('.rb-col-item')?.classList.remove('dragging');
    list.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const el = e.target.closest('.rb-col-item'); if (!el) return;
    list.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    el.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
  });
  list.addEventListener('drop', e => {
    e.preventDefault();
    const el = e.target.closest('.rb-col-item'); if (!el) return;
    const dest = parseInt(el.dataset.idx);
    if (src===null || src===dest) return;
    const ord = [..._rbState.colOrder];
    const [moved] = ord.splice(src,1);
    ord.splice(dest,0,moved);
    _rbState.colOrder = ord; src = null;
    document.getElementById('rb-body').innerHTML = _rbColumnsHTML();
    _rbAttachDrag();
  });
}

window._rbToggleCol = (key, checked) => { _rbState.colEnabled[key]=checked; };

// ── Filters tab ──────────────────────────────────────────────────
function _rbFiltersHTML() {
  const f = _rbState.filters || {};
  const types = [...new Set(state.masterData.map(m=>m.itemType).filter(Boolean))].sort();
  const selTypes = f.itemType || [];

  const typeChips = types.map(t=>`<span class="rb-chip${selTypes.includes(t)?' selected':''}"
    onclick="_rbToggleType('${t.replace(/'/g,"\\'")}',this)">${t}</span>`).join('');

  const yneChips = (key) => ['Either','Yes','No'].map(v=>`<span class="rb-chip${
    (!f[key]&&v==='Either')||(f[key]===v)?' selected':''}" onclick="_rbSetF('${key}','${v}',this)">${v}</span>`).join('');

  const fld = (placeholder,stateKey,extra='') =>
    `<input type="number" value="${f[stateKey]||''}" placeholder="${placeholder}" ${extra}
      style="flex:1;padding:0.38rem 0.55rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.85rem;outline:none;min-width:0"
      oninput="_rbState.filters['${stateKey}']=this.value">`;

  return `
    <div class="rb-filter-row"><div class="rb-filter-label">Item Type (select any)</div>
      <div class="rb-filter-chips">${typeChips}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Has Box</div>
      <div class="rb-filter-chips">${yneChips('hasBox')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">All Original</div>
      <div class="rb-filter-chips">${yneChips('allOriginal')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Has Photo</div>
      <div class="rb-filter-chips">${yneChips('hasPhoto')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Quick Entry Items</div>
      <div class="rb-filter-chips">${['Include','Exclude','Only'].map(v=>`<span class="rb-chip${
        (!f.quickEntry&&v==='Include')||(f.quickEntry===v)?' selected':''}" onclick="_rbSetF('quickEntry','${v}',this)">${v}</span>`).join('')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Condition (1–10)</div>
      <div class="rb-range">${fld('Min','condMin','min="1" max="10"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('Max','condMax','min="1" max="10"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Year Made</div>
      <div class="rb-range">${fld('1945','yearMin','min="1945" max="1969"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('1969','yearMax','min="1945" max="1969"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Est. Worth ($)</div>
      <div class="rb-range">${fld('Min','worthMin','min="0"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('Max','worthMax','min="0"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Amount Paid ($)</div>
      <div class="rb-range">${fld('Min','paidMin','min="0"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('Max','paidMax','min="0"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Location (contains)</div>
      <input type="text" value="${(f.location||'').replace(/"/g,'&quot;')}" placeholder="e.g. Basement Shelf A"
        style="width:100%;padding:0.4rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box"
        oninput="_rbState.filters.location=this.value"></div>`;
}

window._rbToggleType = (type, el) => {
  if (!_rbState.filters.itemType) _rbState.filters.itemType=[];
  const arr=_rbState.filters.itemType, idx=arr.indexOf(type);
  if (idx>=0){arr.splice(idx,1);el.classList.remove('selected');}
  else{arr.push(type);el.classList.add('selected');}
};
window._rbSetF = (key, val, el) => {
  _rbState.filters[key]=val;
  el.closest('.rb-filter-chips')?.querySelectorAll('.rb-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
};

// ── Sort tab ─────────────────────────────────────────────────────
function _rbSortHTML() {
  const sort = _rbState.sort || [];
  while (sort.length<2) sort.push({field:'',dir:'asc'});
  const opts = (sel) => '<option value="">— None —</option>'
    + REPORT_COLS.map(c=>`<option value="${c.key}"${sel===c.key?' selected':''}>${c.label}</option>`).join('');
  const row = (s,i) => `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.7rem">
      <div style="font-size:0.7rem;color:var(--text-dim);width:30px;flex-shrink:0;text-align:right">${i===0?'1st':'2nd'}</div>
      <select onchange="_rbState.sort[${i}].field=this.value"
        style="flex:1;padding:0.45rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none">
        ${opts(s.field)}
      </select>
      <button class="rb-sort-dir ${s.dir}" onclick="_rbFlipDir(${i},this)">
        ${s.dir==='asc'?'A → Z':'Z → A'}
      </button>
    </div>`;
  return '<div style="font-size:0.74rem;color:var(--text-dim);margin-bottom:0.85rem">First sort takes priority.</div>'
    + sort.map((s,i)=>row(s,i)).join('');
}
window._rbFlipDir = (idx, btn) => {
  const s = _rbState.sort[idx];
  s.dir = s.dir==='asc'?'desc':'asc';
  btn.textContent = s.dir==='asc'?'A → Z':'Z → A';
  btn.className = 'rb-sort-dir ' + s.dir;
};

// ── Save / Load ──────────────────────────────────────────────────
function _rbSave() {
  const nameEl = document.getElementById('rb-name');
  if (nameEl) _rbState.name = nameEl.value.trim();
  if (!_rbState.name) {
    if (nameEl) { nameEl.style.borderColor='var(--accent)'; nameEl.focus(); }
    showToast('Give your report a name first', 2500, true); return;
  }
  if (!Object.values(_rbState.colEnabled).some(Boolean)) {
    showToast('Select at least one column', 2500, true); return;
  }
  if (!_rbState.id) _rbState.id = 'rpt_' + Date.now().toString(36);
  if (!state.savedReports) state.savedReports = [];
  const idx = state.savedReports.findIndex(r=>r.id===_rbState.id);
  if (idx>=0) state.savedReports[idx] = _rbState;
  else state.savedReports.push(_rbState);
  localStorage.setItem('lv_saved_reports', JSON.stringify(state.savedReports));
  _rbRefreshDropdown();
  _rbCloseOverlay();
  const sel = document.getElementById('report-type');
  if (sel) { sel.value = 'custom:'+_rbState.id; buildReport(); _rbUpdateCustomControls(); }
  showToast('✓ Report "'+_rbState.name+'" saved');
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
  try { state.savedReports = JSON.parse(localStorage.getItem('lv_saved_reports')||'[]'); }
  catch(e) { state.savedReports=[]; }
  _rbRefreshDropdown();
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

function _rbDeleteSelected() {
  const sel = document.getElementById('report-type');
  if (!sel?.value?.startsWith('custom:')) return;
  const id  = sel.value.replace('custom:','');
  const rpt = (state.savedReports||[]).find(r=>r.id===id);
  if (!confirm('Delete report "' + (rpt?.name||'this report') + '"?')) return;
  state.savedReports = (state.savedReports||[]).filter(r=>r.id!==id);
  localStorage.setItem('lv_saved_reports', JSON.stringify(state.savedReports));
  _rbRefreshDropdown();
  sel.value = 'insurance';
  buildReport();
  _rbUpdateCustomControls();
  showToast('Report deleted');
}

// ── Run a custom report ──────────────────────────────────────────
function _rbCellVal(key, pd, master) {
  switch(key) {
    case 'itemNum':       return pd.itemNum || '';
    case 'description':   return master.roadName || master.description || '';
    case 'itemType':      return master.itemType || '';
    case 'yearMade':      return pd.yearMade || master.yearProd || '';
    case 'variation':     return pd.variation || '';
    case 'varDesc':       return master.varDesc || master.variationDesc || '';
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
    default: return '';
  }
}

function _rbCellHTML(key, val) {
  if (!val || val==='—') {
    if (['priceItem','userEstWorth'].includes(key)) return '—';
    return '<span class="text-dim">—</span>';
  }
  switch(key) {
    case 'itemNum':      return `<span class="item-num">${val}</span>`;
    case 'itemType':     return `<span class="tag">${val}</span>`;
    case 'priceItem':
    case 'userEstWorth': return `<span style="font-family:var(--font-mono);color:var(--accent2)">$${parseFloat(val).toLocaleString()}</span>`;
    case 'hasPhoto':     return val==='Yes' ? '<span style="color:#27ae60">✓</span>' : '<span class="text-dim">—</span>';
    default:             return val;
  }
}

function _rbGetItems(def) {
  const f = def.filters || {};
  let items = Object.values(state.personalData).filter(pd => {
    if (!pd.owned) return false;
    const condVal = pd.condition?.toString().trim(), priceVal = pd.priceItem?.toString().trim();
    const noC = !condVal||condVal===''||condVal==='N/A', noP = !priceVal||priceVal===''||priceVal==='N/A';
    return !(pd.hasBox==='Yes' && noC && noP);
  }).map(pd => ({
    pd,
    master: state.masterData.find(m=>normalizeItemNum(m.itemNum)===normalizeItemNum(pd.itemNum)) || {}
  }));

  // Apply filters
  items = items.filter(({pd,master}) => {
    if (f.itemType?.length && !f.itemType.includes(master.itemType||'')) return false;
    if (f.hasBox && f.hasBox!=='Either' && pd.hasBox!==f.hasBox) return false;
    if (f.allOriginal && f.allOriginal!=='Either' && pd.allOriginal!==f.allOriginal) return false;
    if (f.hasPhoto && f.hasPhoto!=='Either') { const h=!!pd.photoItem; if(f.hasPhoto==='Yes'&&!h) return false; if(f.hasPhoto==='No'&&h) return false; }
    if (f.quickEntry && f.quickEntry!=='Include') { const q=!!pd.quickEntry; if(f.quickEntry==='Exclude'&&q) return false; if(f.quickEntry==='Only'&&!q) return false; }
    const rng = (fMin,fMax,getVal,numeric=true) => {
      if (!fMin&&!fMax) return true;
      const v = numeric ? parseFloat(getVal()) : getVal();
      if (fMin!==''&&fMin!==undefined) { const mn=parseFloat(fMin); if(isNaN(v)||v<mn) return false; }
      if (fMax!==''&&fMax!==undefined) { const mx=parseFloat(fMax); if(isNaN(v)||v>mx) return false; }
      return true;
    };
    if (!rng(f.condMin,  f.condMax,  ()=>parseInt(pd.condition))) return false;
    if (!rng(f.yearMin,  f.yearMax,  ()=>parseInt(pd.yearMade||master.yearProd))) return false;
    if (!rng(f.worthMin, f.worthMax, ()=>parseFloat(pd.userEstWorth))) return false;
    if (!rng(f.paidMin,  f.paidMax,  ()=>parseFloat(pd.priceComplete||pd.priceItem))) return false;
    if (f.location?.trim() && !(pd.location||'').toLowerCase().includes(f.location.toLowerCase())) return false;
    return true;
  });

  // Apply sort
  const sorts = (def.sort||[]).filter(s=>s.field);
  const numKeys = new Set(['condition','priceItem','userEstWorth','yearMade','boxCond']);
  if (sorts.length) {
    items.sort((a,b) => {
      for (const s of sorts) {
        const va=_rbCellVal(s.field,a.pd,a.master), vb=_rbCellVal(s.field,b.pd,b.master);
        const cmp = numKeys.has(s.field) ? (parseFloat(va)||0)-(parseFloat(vb)||0) : va.localeCompare(vb,undefined,{numeric:true});
        if (cmp!==0) return s.dir==='desc'?-cmp:cmp;
      }
      return 0;
    });
  }
  return items;
}

function buildCustomReport(def) {
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  if (!thead||!tbody) return;
  const _insHdr = document.getElementById('ins-report-hdr');
  if (_insHdr) _insHdr.style.display='none';

  const cols = (def.colOrder||REPORT_COLS.map(c=>c.key))
    .filter(k=>def.colEnabled?.[k])
    .map(k=>REPORT_COLS.find(c=>c.key===k)).filter(Boolean);

  if (!cols.length) { tbody.innerHTML=`<tr><td class="ui-empty">No columns selected — click Edit to configure</td></tr>`; return; }

  thead.innerHTML = '<tr>' + cols.map(c=>`<th>${c.label}</th>`).join('') + '</tr>';
  const items = _rbGetItems(def);
  if (!items.length) {
    tbody.innerHTML=`<tr><td colspan="${cols.length}" class="ui-empty">No items match these filters</td></tr>`; return;
  }

  tbody.innerHTML = items.map(({pd,master}) =>
    '<tr>'+cols.map(c=>`<td>${_rbCellHTML(c.key,_rbCellVal(c.key,pd,master))}</td>`).join('')+'</tr>'
  ).join('');

  // Totals row for money columns
  const moneyCols = cols.filter(c=>['priceItem','userEstWorth'].includes(c.key));
  if (moneyCols.length) {
    const totals = Object.fromEntries(moneyCols.map(c=>[c.key, items.reduce((s,{pd,master})=>s+(parseFloat(_rbCellVal(c.key,pd,master))||0),0)]));
    tbody.innerHTML += '<tr style="border-top:2px solid var(--border);font-weight:700">'
      + cols.map(c=>{
          if (c.key==='itemNum') return `<td style="color:var(--text-dim);font-size:0.78rem">${items.length.toLocaleString()} items</td>`;
          if (totals[c.key]!==undefined) return `<td style="font-family:var(--font-mono);color:var(--accent2)">$${Math.round(totals[c.key]).toLocaleString()}</td>`;
          return '<td></td>';
        }).join('') + '</tr>';
  }
}

function exportCustomReport(def) {
  const cols = (def.colOrder||REPORT_COLS.map(c=>c.key))
    .filter(k=>def.colEnabled?.[k])
    .map(k=>REPORT_COLS.find(c=>c.key===k)).filter(Boolean);
  const items = _rbGetItems(def);
  const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
  const header = cols.map(c=>esc(c.label)).join(',');
  const rows = items.map(({pd,master})=>cols.map(c=>esc(_rbCellVal(c.key,pd,master))).join(','));
  const csv = header + '\n' + rows.join('\n');
  const dateTag = new Date().toISOString().slice(0,10);
  const safeName = (def.name||'report').replace(/[^a-z0-9]/gi,'-').toLowerCase();
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${safeName}-${dateTag}.csv`; a.click();
}

// ── PREFERENCES ─────────────────────────────────────────────────

// APP_VERSION, APP_DATE, _RSV_PLACEHOLDER_PNG defined in config.js


