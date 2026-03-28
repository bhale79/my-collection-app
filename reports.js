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
    ownedItems.forEach(pd => {
      totalWorth += parseFloat(pd.userEstWorth || 0);
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
    hdrEl.innerHTML = `
      <div class="ins-report-header">
        <div class="ins-report-title">Lionel Postwar Collection — Insurance Documentation</div>
        <div class="ins-report-meta">
          ${ownerName ? `<span>Owner: <strong>${ownerName}</strong></span>` : ''}
          <span>Generated: <strong>${dateStr}</strong></span>
          <span>Items: <strong>${ownedItems.length.toLocaleString()}</strong></span>
        </div>
      </div>
      <div class="ins-report-totals">
        ${totalWorth > 0 ? `<span>Total Est. Worth: <strong>$${Math.round(totalWorth).toLocaleString()}</strong></span>` : ''}
        <span style="color:var(--text-dim);font-size:0.78rem">Est. Worth = user-entered value for insurance purposes</span>
      </div>`;

    thead.innerHTML = `<tr>
      <th>Photo</th>
      <th>Item #</th>
      <th>Description</th>
      <th>Variation</th>
      <th>Cond.</th>
      <th>All Orig.</th>
      <th>Box</th>
      <th>Box Cond.</th>
      <th>Est. Worth</th>
      <th>Notes</th>
    </tr>`;

    tbody.innerHTML = ownedItems.map((pd, idx) => {
      const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum)) || {};
      const desc   = master.roadName || master.description || master.itemType || '—';
      const year   = pd.yearMade || master.yearProd || '—';
      const worth  = pd.userEstWorth ? '$' + parseFloat(pd.userEstWorth).toLocaleString() : '—';
      const photoId = 'ins-photo-' + idx;
      return `<tr>
        <td><div id="${photoId}" class="ins-photo-placeholder" style="font-size:0.6rem;line-height:1.3">No<br>Photo</div></td>
        <td><span class="item-num">${pd.itemNum}</span></td>
        <td>${desc}</td>
        <td style="font-size:0.78rem;color:var(--text-dim)">${pd.variation || '—'}</td>
        <td style="text-align:center">${pd.condition || '—'}</td>
        <td style="text-align:center">${pd.allOriginal || '—'}</td>
        <td style="text-align:center">${pd.hasBox || '—'}</td>
        <td style="text-align:center">${pd.boxCond || '—'}</td>
        <td style="font-family:var(--font-mono);color:var(--accent2)">${worth}</td>
        <td style="font-size:0.77rem;color:var(--text-dim);max-width:160px">${pd.notes || ''}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="ui-empty">No owned items yet</td></tr>';

    // Async: load first photo for each item
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

    return;
  } // end insurance

  // Hide insurance header when switching to other report types
  const _insHdr = document.getElementById('ins-report-hdr');
  if (_insHdr) _insHdr.style.display = 'none';

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
          <button onclick="document.getElementById('rb-overlay').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:6px">✕</button>
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
        <button onclick="document.getElementById('rb-overlay').remove()"
          style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Cancel</button>
        <button onclick="_rbSave()"
          style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent2);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">Save Report</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _rbShowTab('columns');
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
  document.getElementById('rb-overlay')?.remove();
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

// APP_VERSION and APP_DATE defined in app.js (loads first)

const _RSV_PLACEHOLDER_PNG = 'data:image/png;base64,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';

