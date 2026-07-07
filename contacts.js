// ═══════════════════════════════════════════════════════════════
// contacts.js — 📇 Contacts (dealer/collector rolodex) — v0.9.763
//
// Brad's brainstorm picks: own page, listed as "Contacts", entry ABOVE
// Preferences in the account menu. Business-card photo capture (Drive
// folder "The Rail Roster - Contacts") with OCR prefill (reuses the
// box-label Tesseract via window._ensureTesseract). Data = "Contacts"
// tab in the personal sheet, auto-created on first save:
//   A Contact ID | B Name | C Business | D Phone | E Email |
//   F Specialties | G Notes | H Card Photo Link | I Met At | J Date Added
// Contact ID reserved for Phase 2 item-linking ("bought from Dave").
// Integration points (all marked "contacts hook"): index.html page div +
// script tag, app-setup.js menu item, app.js showPage hook,
// barcode.js _ensureTesseract export.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var TAB = 'Contacts';
  // v0.9.764 (Brad): + Mailing Address, Website. Columns K/L appended (tab is
  // created on first save, so widening now costs nothing). "Store name" = the
  // Business column (label reads Store / Business). Phase 2 (Brad-confirmed):
  // item linking ("bought from Dave") via Contact ID + per-purchase WARRANTY
  // notes/expiry shown on the contact's page.
  var HEADERS = ['Contact ID', 'Name', 'Business', 'Phone', 'Email', 'Specialties', 'Notes', 'Card Photo Link', 'Met At', 'Date Added', 'Mailing Address', 'Website'];
  var SPECIALTY_CHIPS = ['Prewar', 'Postwar', 'Modern', 'MTH', 'Atlas', 'Menards', 'Parts', 'Repairs', 'Paper', 'Sets'];

  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _today() { try { return new Date().toLocaleDateString('en-CA'); } catch (e) { return ''; } }

  // ── sheet plumbing ─────────────────────────────────────────────
  var _tabEnsured = false;
  async function _ensureTab() {
    if (_tabEnsured) return true;
    try {
      var metaRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties', { headers: { Authorization: 'Bearer ' + accessToken } });
      var meta = await metaRes.json();
      var has = (meta.sheets || []).some(function (s) { return s.properties.title === TAB; });
      if (!has) {
        await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate', {
          method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
        });
        await sheetsUpdate(state.personalSheetId, TAB + '!A1:L1', [HEADERS]);
      }
      _tabEnsured = true;
      return true;
    } catch (e) { console.warn('[contacts tab]', e); return false; }
  }

  async function _load() {
    try {
      var r = await sheetsGet(state.personalSheetId, TAB + '!A2:L');
      var out = [];
      (r && r.values || []).forEach(function (v, i) {
        if (!v || !(v[1] || v[0])) return;
        out.push({ row: i + 2, id: v[0] || '', name: v[1] || '', business: v[2] || '', phone: v[3] || '', email: v[4] || '', specialties: v[5] || '', notes: v[6] || '', cardLink: v[7] || '', metAt: v[8] || '', dateAdded: v[9] || '', address: v[10] || '', website: v[11] || '' });
      });
      state.contactsData = out;
      return out;
    } catch (e) { state.contactsData = state.contactsData || []; return state.contactsData; }
  }

  // ── page ───────────────────────────────────────────────────────
  window.buildContactsPage = async function () {
    var page = document.getElementById('page-contacts');
    if (!page) return;
    page.innerHTML = '<div class="page-title">Contacts</div>'
      + '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap">'
      + '<input id="ct-search" type="text" placeholder="Search name, business, specialty…" oninput="_ctRenderList()" style="flex:1;min-width:200px;padding:0.6rem 0.8rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem">'
      + '<button onclick="_ctOpenEdit(null)" style="padding:0.6rem 1.1rem;border-radius:9px;border:1.5px solid var(--accent);background:rgba(232,64,28,0.1);color:var(--accent);font-weight:700;cursor:pointer;font-family:var(--font-body)">+ Add Contact</button>'
      + '</div>'
      + '<div id="ct-list"><div class="loading"><div class="spinner"></div></div></div>';
    await _load();
    window._ctRenderList();
  };

  window._ctRenderList = function () {
    var el = document.getElementById('ct-list');
    if (!el) return;
    var q = ((document.getElementById('ct-search') || {}).value || '').toLowerCase();
    var rows = (state.contactsData || []).filter(function (c) {
      if (!q) return true;
      return (c.name + ' ' + c.business + ' ' + c.specialties + ' ' + c.notes + ' ' + c.metAt).toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    if (!rows.length) {
      el.innerHTML = '<div class="empty-state"><p>' + (q ? 'No contacts match.' : 'No contacts yet — add your first dealer, repair shop, or collector friend.') + '</p></div>';
      return;
    }
    el.innerHTML = rows.map(function (c) {
      var chips = (c.specialties || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        .map(function (s) { return '<span style="font-size:0.68rem;border:1px solid var(--accent2);color:var(--accent2);border-radius:4px;padding:0.05rem 0.35rem;margin-right:0.25rem">' + _esc(s) + '</span>'; }).join('');
      return '<div style="border:1px solid var(--border);border-radius:11px;background:var(--surface);padding:0.8rem 1rem;margin-bottom:0.55rem">'
        + '<div style="display:flex;align-items:flex-start;gap:0.6rem;flex-wrap:wrap">'
        + '<div style="flex:1;min-width:200px">'
        +   '<div style="font-weight:800;color:var(--text);font-size:1rem">' + _esc(c.name) + (c.business ? ' <span style="font-weight:400;color:var(--text-mid);font-size:0.85rem">· ' + _esc(c.business) + '</span>' : '') + '</div>'
        +   (chips ? '<div style="margin-top:0.25rem">' + chips + '</div>' : '')
        +   (c.notes ? '<div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.3rem;line-height:1.4">' + _esc(c.notes) + '</div>' : '')
        +   (c.metAt ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.2rem">Met: ' + _esc(c.metAt) + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:0.3rem;flex-shrink:0">'
        +   (c.phone ? '<a href="tel:' + _esc(c.phone.replace(/[^+0-9]/g, '')) + '" style="padding:0.35rem 0.7rem;border-radius:7px;border:1px solid #2ecc71;color:#2ecc71;text-decoration:none;font-size:0.78rem;text-align:center">📞 ' + _esc(c.phone) + '</a>' : '')
        +   (c.email ? '<a href="mailto:' + _esc(c.email) + '" style="padding:0.35rem 0.7rem;border-radius:7px;border:1px solid #3498db;color:#3498db;text-decoration:none;font-size:0.78rem;text-align:center">✉ Email</a>' : '')
        +   (c.website ? '<a href="' + _esc((/^https?:/i.test(c.website) ? c.website : 'https://' + c.website)) + '" target="_blank" rel="noopener" style="padding:0.35rem 0.7rem;border-radius:7px;border:1px solid #9b59b6;color:#9b59b6;text-decoration:none;font-size:0.78rem;text-align:center">🌐 Website</a>' : '')
        +   (c.address ? '<a href="https://maps.google.com/?q=' + encodeURIComponent(c.address) + '" target="_blank" rel="noopener" style="padding:0.35rem 0.7rem;border-radius:7px;border:1px solid #16a085;color:#16a085;text-decoration:none;font-size:0.78rem;text-align:center">🗺 Map</a>' : '')
        +   (c.cardLink ? '<a href="' + _esc(c.cardLink) + '" target="_blank" rel="noopener" style="padding:0.35rem 0.7rem;border-radius:7px;border:1px solid var(--accent2);color:var(--accent2);text-decoration:none;font-size:0.78rem;text-align:center">📇 Card</a>' : '')
        +   '<button onclick="_ctOpenEdit(' + c.row + ')" style="padding:0.35rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-size:0.78rem;font-family:var(--font-body)">Edit</button>'
        + '</div></div></div>';
    }).join('');
  };

  // ── add / edit modal ───────────────────────────────────────────
  window._ctOpenEdit = function (row) {
    var c = row ? (state.contactsData || []).find(function (x) { return x.row === row; }) : null;
    c = c || { id: '', name: '', business: '', phone: '', email: '', specialties: '', notes: '', cardLink: '', metAt: '', dateAdded: '', address: '', website: '' };
    var old = document.getElementById('ct-modal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'ct-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    function fld(label, id, val, ph, type) {
      return '<div style="margin-bottom:0.6rem"><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);margin-bottom:0.2rem">' + label + '</div>'
        + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(val) + '" placeholder="' + _esc(ph || '') + '" style="width:100%;box-sizing:border-box;padding:0.6rem 0.75rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem"></div>';
    }
    ov.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:460px;width:100%;padding:1.2rem;max-height:92vh;overflow-y:auto">'
      + '<div style="font-family:var(--font-head);font-size:1.1rem;color:var(--text);margin-bottom:0.8rem">' + (row ? 'Edit Contact' : '📇 New Contact') + '</div>'
      + '<button onclick="document.getElementById(\'ct-card-file\').click()" style="width:100%;margin-bottom:0.7rem;padding:0.75rem;border-radius:9px;border:1.5px dashed #3498db;background:rgba(52,152,219,0.08);color:#3498db;font-weight:700;cursor:pointer;font-family:var(--font-body)">📷 Snap / upload their business card</button>'
      + '<input type="file" id="ct-card-file" accept="image/*" capture="environment" style="display:none">'
      + '<div id="ct-card-status" style="font-size:0.75rem;color:var(--text-dim);margin:-0.3rem 0 0.5rem"></div>'
      + fld('Name', 'ct-f-name', c.name, 'Dave Miller')
      + fld('Store / Business', 'ct-f-biz', c.business, "Dave's Trains")
      + fld('Phone', 'ct-f-phone', c.phone, '(555) 123-4567', 'tel')
      + fld('Email', 'ct-f-email', c.email, 'dave@example.com', 'email')
      + '<div style="margin-bottom:0.2rem;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim)">Deals in</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.4rem">' + SPECIALTY_CHIPS.map(function (s) {
          var on = (c.specialties || '').indexOf(s) >= 0;
          return '<button data-ct-chip="' + s + '" style="padding:0.25rem 0.55rem;border-radius:999px;font-size:0.75rem;cursor:pointer;font-family:var(--font-body);border:1.5px solid ' + (on ? 'var(--accent2);background:rgba(201,146,42,0.15);color:var(--accent2)' : 'var(--border);background:var(--surface2);color:var(--text-mid)') + '">' + s + '</button>';
        }).join('') + '</div>'
      + fld('Other specialties', 'ct-f-spec', '', 'anything not covered above')
      + fld('Website', 'ct-f-web', c.website, 'davestrains.com')
      + fld('Mailing address', 'ct-f-addr', c.address, '123 Main St, Anytown PA 17400')
      + fld('Met at', 'ct-f-met', c.metAt, 'York, October 2026')
      + '<div style="margin-bottom:0.6rem"><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);margin-bottom:0.2rem">Notes</div>'
      + '<textarea id="ct-f-notes" rows="3" placeholder="strong on tinplate, will negotiate, ships…" style="width:100%;box-sizing:border-box;padding:0.6rem 0.75rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;resize:vertical">' + _esc(c.notes) + '</textarea></div>'
      + '<div style="display:flex;gap:0.5rem">'
      + '<button id="ct-save" style="flex:2;padding:0.8rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-weight:800;cursor:pointer;font-family:var(--font-body)">✓ Save Contact</button>'
      + (row ? '<button id="ct-del" style="flex:1;padding:0.8rem;border-radius:9px;border:1px solid #e74c3c;background:none;color:#e74c3c;cursor:pointer;font-family:var(--font-body)">Delete</button>' : '')
      + '<button onclick="document.getElementById(\'ct-modal\').remove()" style="flex:1;padding:0.8rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body)">Cancel</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('[data-ct-chip]');
      if (chip) {
        var on = chip.style.borderColor !== 'var(--border)' && chip.style.color === 'var(--accent2)';
        if (on) { chip.style.cssText = chip.style.cssText.replace(/border:[^;]+;?/, '') + ';border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid)'; }
        else { chip.style.cssText = chip.style.cssText.replace(/border:[^;]+;?/, '') + ';border:1.5px solid var(--accent2);background:rgba(201,146,42,0.15);color:var(--accent2)'; }
      }
    });

    var _cardFile = null;
    var fileInp = ov.querySelector('#ct-card-file');
    fileInp.addEventListener('change', async function () {
      var f = fileInp.files && fileInp.files[0];
      if (!f) return;
      _cardFile = f;
      var st = ov.querySelector('#ct-card-status');
      st.textContent = '📇 Card attached — reading it…';
      // OCR prefill (best effort, empty fields only)
      try {
        if (typeof window._ensureTesseract === 'function') {
          var T = await window._ensureTesseract();
          var res = await T.recognize(f, 'eng', {});
          var text = (res && res.data && res.data.text) || '';
          var email = (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || '';
          var phone = (text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [])[0] || '';
          var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 2; });
          var nameGuess = (lines.find(function (l) { return !/\d/.test(l) && !/@/.test(l) && l.length < 40; }) || '');
          var set = function (id, v) { var el = ov.querySelector('#' + id); if (el && !el.value && v) el.value = v; };
          set('ct-f-email', email); set('ct-f-phone', phone); set('ct-f-name', nameGuess);
          st.textContent = '📇 Card attached' + ((email || phone || nameGuess) ? ' — details read from the card, double-check them' : ' — couldn’t read details, type them in');
        } else st.textContent = '📇 Card attached — will be saved with the contact';
      } catch (e) { st.textContent = '📇 Card attached — will be saved with the contact'; }
    });

    ov.querySelector('#ct-save').onclick = async function () {
      var v = function (id) { var el = ov.querySelector('#' + id); return el ? el.value.trim() : ''; };
      var name = v('ct-f-name');
      if (!name) { showToast('Give them at least a name', 3000, true); return; }
      this.textContent = 'Saving…'; this.disabled = true;
      var chips = [].slice.call(ov.querySelectorAll('[data-ct-chip]')).filter(function (ch) { return ch.style.color === 'var(--accent2)'; }).map(function (ch) { return ch.getAttribute('data-ct-chip'); });
      var extra = v('ct-f-spec');
      var specialties = chips.concat(extra ? [extra] : []).join(', ');
      var cardLink = c.cardLink || '';
      try {
        if (_cardFile && typeof driveFindOrCreateFolder === 'function' && typeof driveUploadPhoto === 'function') {
          var folder = await driveFindOrCreateFolder('The Rail Roster - Contacts');
          if (folder && folder.id) {
            var up = await driveUploadPhoto(_cardFile, (name + ' card ' + _today() + '.jpg'), folder.id);
            if (up && up.id) cardLink = 'https://drive.google.com/file/d/' + up.id + '/view';
          }
        }
      } catch (e) { console.warn('[contact card upload]', e); }
      var id = c.id || ('C-' + Date.now());
      var rowVals = [id, name, v('ct-f-biz'), v('ct-f-phone'), v('ct-f-email'), specialties, v('ct-f-notes'), cardLink, v('ct-f-met'), c.dateAdded || _today(), v('ct-f-addr'), v('ct-f-web')];
      try {
        if (!(await _ensureTab())) throw new Error('no tab');
        if (row) await sheetsUpdate(state.personalSheetId, TAB + '!A' + row + ':L' + row, [rowVals]);
        else await sheetsAppend(state.personalSheetId, TAB + '!A:L', [rowVals]);
        ov.remove();
        showToast('✓ ' + name + ' saved to Contacts');
        await _load();
        window._ctRenderList();
      } catch (e) {
        console.warn('[contact save]', e);
        showToast('Could not save — check your connection and try again', 4000, true);
        this.textContent = '✓ Save Contact'; this.disabled = false;
      }
    };
    var del = ov.querySelector('#ct-del');
    if (del) del.onclick = async function () {
      if (!confirm('Delete this contact?')) return;
      try {
        await sheetsUpdate(state.personalSheetId, TAB + '!A' + row + ':L' + row, [['', '', '', '', '', '', '', '', '', '', '', '']]);
        ov.remove();
        showToast('Contact deleted');
        await _load();
        window._ctRenderList();
      } catch (e) { showToast('Delete failed — try again', 3500, true); }
    };
  };
})();
