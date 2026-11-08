// ═══════════════════════════════════════════════════════════════════════════
// command-ids.js — COMMAND IDs (2026-10-31, [stated] Brad, PLAN 2026-10-31
// "Command IDs: Lionel TMCC / Legacy, MTH DCS and DCC" → approved, all
// decisions made).
//
// The number an engine (or a command car, crane, sound car, accessory…)
// answers to on a command-control system is set by its OWNER on THEIR copy, so
// it lives on the collection sheet (one column per system at the END — PERSONAL_SCHEMA,
// app.js) and never on the master catalog.
//
// What is where — one definition of each thing:
//   the three fields      RR_USER_FIELDS (config.js), ownCard: 'cmdid'
//   every word            RR_CMDID (config.js)
//   what the catalog says RR_CMDID.hintRules (config.js) — read from the
//                         row's own words, never a list of item numbers
//   Modern or not         _itemEraPeriod (browse.js) — THE era decider
//   on the track or not   getTypeBucket + rrBucketOnTrack (type-groups.js)
//   the row write         rrPersonalUpdateRow + rrPersonalSafeWrite (app.js)
//
// This file draws and writes them, and nothing else does:
//   rrCmdIdRenderCard(pd, it)   the item page card (#cmdid-card, app-collection.js)
//   rrCmdIdWizHtml(d)           the Add steps' "＋ Add command ID" button
//   rrCmdIdSaveValues(d)        what an Add save writes (wizard-save.js, the item's own row only)
//   rrCmdIdQuery / rrCmdIdMatches   search: "ID 12", "DCS 12", "TMCC 12", "Legacy 12", "DCC 12"
//   rrCmdIdHas(pd)              the report builder's "Has a Command ID" filter
//   rrCmdIdReportDef()          the ready-made Command ID report
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function W(k) { var o = window.RR_CMDID || {}; return o[k] == null ? '' : o[k]; }
  function fill(s, o) { return String(s || '').replace(/\{(\w+)\}/g, function (m, k) { return (o && o[k] != null) ? o[k] : m; }); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(m, ms, err) { if (typeof showToast === 'function') showToast(m, ms || 2500, !!err); }

  // ── the three fields (config.js) ──────────────────────────────────────────
  function rrCmdIdFields() {
    return (window.RR_USER_FIELDS || []).filter(function (f) { return f && f.ownCard === 'cmdid'; });
  }
  function fieldOf(key) { return rrCmdIdFields().filter(function (f) { return f.key === key; })[0] || null; }
  function labelOf(f) { return (typeof rrFieldLabel === 'function') ? rrFieldLabel(f) : f.label; }

  // One value in → { ok, v }. Plain digits only, at most f.digits of them once
  // the leading zeros are gone ("07" = "7"). Blank is fine (= not set).
  function rrCmdIdNorm(val, f) {
    var s = String(val == null ? '' : val).trim().replace(/^'/, '').replace(/\s+/g, '');
    if (!s) return { ok: true, v: '' };
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');   // a spreadsheet's "12.0"
    if (!/^\d+$/.test(s)) return { ok: false, v: '' };
    s = s.replace(/^0+(?=\d)/, '');
    var max = (f && f.digits) || 5;
    if (s.length > max) return { ok: false, v: '' };
    return { ok: true, v: s };
  }
  // A copy's IDs, cleaned: { tmccId: '12', … } (blank ones left out).
  function rrCmdIdValues(pd) {
    var out = {};
    rrCmdIdFields().forEach(function (f) {
      var n = rrCmdIdNorm(pd && pd[f.key], f);
      if (n.ok && n.v) out[f.key] = n.v;
    });
    return out;
  }
  function rrCmdIdHas(pd) { return Object.keys(rrCmdIdValues(pd)).length > 0; }

  // ── which catalog row a copy is ───────────────────────────────────────────
  function masterOf(pd) {
    try { return (typeof findMaster === 'function' && pd && pd.itemNum) ? (findMaster(pd.itemNum, pd.variation, pd) || null) : null; }
    catch (e) { return null; }
  }

  // ── Modern? — THE era decider, asked the way the report builder asks it ──
  function rrCmdIdPeriod(pd, master) {
    pd = pd || {}; master = master || {};
    try {
      if (typeof _itemEraPeriod !== 'function') return null;
      return _itemEraPeriod({
        eraPeriod: pd.eraPeriod || master.eraPeriod, yearProd: master.yearProd, yearMade: pd.yearMade,
        _era: master._era || pd._era || pd.era, era: pd.era, _tab: master._tab,
      });
    } catch (e) { return null; }
  }
  // Offered = a Modern copy, or ANY copy that already holds an ID (a value you
  // entered is never hidden — the Era changed by hand later, say).
  function rrCmdIdOffered(pd, master) {
    if (rrCmdIdHas(pd)) return true;
    return rrCmdIdPeriod(pd, master) === 'modern';
  }

  // ── what the catalog says is inside (a HINT, never a gate) ────────────────
  // → { order: [field keys, the hinted system first], says: ['Proto-Sound — DCS', …] }
  function rrCmdIdHint(master) {
    var m = master || {};
    var text = {
      control: String(m.control || ''),
      trackPower: String(m.trackPower || ''),
      words: [m.description, m.varDesc, m.variationDesc, m.subType].filter(Boolean).join(' '),
    };
    var found = [], says = [];
    (W('hintRules') || []).forEach(function (r) {
      if (!r || !r.re || found.indexOf(r.sys) >= 0) return;
      if (r.re.test(text[r.from] || '')) { found.push(r.sys); says.push(r.say); }
    });
    var fs = rrCmdIdFields();
    var order = [];
    found.forEach(function (sys) { fs.forEach(function (f) { if (f.sys === sys && order.indexOf(f.key) < 0) order.push(f.key); }); });
    fs.forEach(function (f) { if (order.indexOf(f.key) < 0) order.push(f.key); });
    return { order: order, says: says, systems: found };
  }

  // ── on the track, or beside it? (the duplicate warning's two groups) ─────
  function rrCmdIdOnTrack(pd, master) {
    pd = pd || {}; master = master || {};
    try {
      if (typeof getTypeBucket !== 'function' || typeof rrBucketOnTrack !== 'function') return false;
      var probe = Object.assign({}, master, {
        itemType: master.itemType || pd.itemType || '',
        subType: pd.subType || master.subType || '',
        description: master.description || pd.description || '',
        itemNum: master.itemNum || pd.itemNum || '',
      });
      if (!master.itemNum) probe._personalOnly = true;
      return rrBucketOnTrack(getTypeBucket(probe));
    } catch (e) { return false; }
  }

  // The words for another item in a message: "2343 Santa Fe Diesel" — its
  // number, road name and the type's short word (the one bucketer's label).
  function itemName(p, master) {
    p = p || {}; master = master || masterOf(p) || {};
    var road = String(p.roadName || master.roadName || '').trim();
    var t = String(master.itemType || p.itemType || '').trim();
    try {
      if (typeof getTypeBucketLabel === 'function') {
        var bl = getTypeBucketLabel(Object.assign({}, master, { itemType: t, description: master.description || p.description || '' }));
        if (bl) t = bl;
      }
    } catch (e) {}
    var name = String(p.customName || '').trim();
    return [String(p.itemNum || '').trim(), name || road, name ? '' : t].filter(Boolean).join(' ') || 'item';
  }

  // Every OTHER owned copy set to the same number ON THE SAME SYSTEM, in the
  // same group (on the track / beside it). Matched by the copy's own row
  // (inventory ID / the record itself) — never by item number, so a second
  // copy of the same engine is "another item" like any other.
  // vals: { tmccId: '12', … } as about to be saved.
  function rrCmdIdClashes(pd, master, vals) {
    var out = [];
    var mine = rrCmdIdOnTrack(pd, master);
    var myId = String((pd && pd.inventoryId) || '').trim();
    var all = (typeof state !== 'undefined' && state && state.personalData) ? state.personalData : {};
    var keys = Object.keys(vals || {}).filter(function (k) { return vals[k]; });
    if (!keys.length) return out;
    Object.keys(all).forEach(function (k) {
      var p = all[k];
      if (!p || !p.owned || p === pd) return;
      if (myId && String(p.inventoryId || '').trim() === myId) return;
      var pv = rrCmdIdValues(p);
      var hits = keys.filter(function (key) { return pv[key] && pv[key] === vals[key]; });
      if (!hits.length) return;
      var pm = masterOf(p);
      if (rrCmdIdOnTrack(p, pm) !== mine) return;   // an engine 12 and an accessory 12 do not clash
      hits.forEach(function (key) { out.push({ key: key, num: vals[key], other: p, otherMaster: pm }); });
    });
    return out;
  }
  // Ask about each clash. true = save (Keep both); a field key = go back and
  // change that one.
  async function askClashes(clashes) {
    for (var i = 0; i < clashes.length; i++) {
      var c = clashes[i], f = fieldOf(c.key);
      var msg = fill(W('clash'), { item: esc(itemName(c.other, c.otherMaster)), sys: esc(f.say || labelOf(f)), num: esc(c.num) });
      var keep = await appConfirm(msg, { title: W('clashTitle'), ok: W('keepBoth'), cancel: W('changeThis') });
      if (!keep) return c.key;
    }
    return true;
  }

  // ── which system the drop-down starts on ──────────────────────────────────
  // 2026-11-02 ([stated] Brad "yes"): the system this copy already has a
  // number for; else what the catalog says; else the maker's (Lionel and Atlas
  // → TMCC / Legacy, MTH → DCS — RR_CMDID.makerSys, read through rrMakerKey,
  // the one maker rule); else DCC (HO, N and the rest). Always changeable.
  function makerKeyOf(pd, master, extra) {
    var words = [];
    if (pd && pd.manufacturer) words.push(pd.manufacturer);
    (extra || []).forEach(function (w) { if (w) words.push(w); });
    try { if (master && typeof _manufacturerOfItem === 'function') words.push(_manufacturerOfItem(master) || ''); } catch (e) {}
    for (var i = 0; i < words.length; i++) {
      var k = (typeof rrMakerKey === 'function') ? rrMakerKey(words[i]) : '';
      if (k) return k;
    }
    return '';
  }
  function rrCmdIdStartKey(vals, master, makerKey) {
    var fs = rrCmdIdFields();
    var keyOfSys = function (sys) { var f = fs.filter(function (x) { return x.sys === sys; })[0]; return f ? f.key : ''; };
    var h = rrCmdIdHint(master);
    var has = h.order.filter(function (k) { return vals && vals[k]; });
    if (has.length) return has[0];
    if (h.systems.length && keyOfSys(h.systems[0])) return keyOfSys(h.systems[0]);
    var ms = (W('makerSys') || {})[makerKey || ''];
    if (ms && keyOfSys(ms)) return keyOfSys(ms);
    return keyOfSys(W('fallbackSys')) || (fs[0] && fs[0].key) || '';
  }

  // ── the drop-down + the number box (the card and the Add steps share them) ─
  // ONE visible number box. Each system's number is held in its own hidden
  // field (id prefix + field key), so switching the drop-down shows that
  // system's number and an engine on two systems keeps both; the save reads
  // the hidden fields (readBoxes) — every system, every time.
  function boxesHtml(prefix, vals, master, makerKey) {
    var h = rrCmdIdHint(master);
    var fs = rrCmdIdFields();
    var start = rrCmdIdStartKey(vals, master, makerKey);
    var sf = fieldOf(start) || fs[0] || {};
    var hint = h.says.length
      ? '<div class="rr-cmdid-hint" style="font-size:0.8rem;color:var(--accent2);margin-bottom:0.5rem;font-weight:600">' + esc(fill(W('hint'), { say: h.says.join(' · ') })) + '</div>' : '';
    var LBL = 'display:flex;flex-direction:column;gap:0.25rem;font-size:0.8rem;color:var(--text-mid)';
    var BOX = 'padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);box-sizing:border-box;width:100%';
    return hint +
      '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.45;margin-bottom:0.6rem">' + esc(W('intro')) + '</div>' +
      '<div class="rr-cmdid-boxes" style="display:flex;flex-wrap:wrap;gap:0.6rem">' +
      '<label style="flex:1;min-width:140px;' + LBL + '">' + esc(W('pickLabel')) +
        '<select id="' + prefix + 'sys" data-cmdid-pick="1" onchange="rrCmdIdPick(\'' + prefix + '\',this.value)" style="' + BOX + ';font-family:var(--font-body);font-size:1rem">' +
        fs.map(function (f) { return '<option value="' + f.key + '"' + (f.key === start ? ' selected' : '') + '>' + esc(f.pick || labelOf(f)) + '</option>'; }).join('') +
        '</select></label>' +
      '<label style="flex:1;min-width:120px;' + LBL + '">' + esc(W('numLabel')) +
        '<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" id="' + prefix + 'num" data-cmdid-num="1"' +
        ' value="' + esc((vals && vals[start]) || '') + '" placeholder="' + esc(sf.hint || '') + '"' +
        ' oninput="this.value=this.value.replace(/[^0-9]/g,\'\').slice(0,' + ((sf.digits || 5) + 2) + ');rrCmdIdNumInput(\'' + prefix + '\',this)"' +
        ' style="' + BOX + ';font-family:var(--font-mono);font-size:1.05rem">' +
        '</label>' +
      fs.map(function (f) { return '<input type="hidden" id="' + prefix + f.key + '" data-cmdid-key="' + f.key + '" value="' + esc((vals && vals[f.key]) || '') + '">'; }).join('') +
      '</div>';
  }
  // The drop-down changed: show that system's own number in the box.
  function rrCmdIdPick(prefix, key) {
    var f = fieldOf(key); if (!f) return;
    var sel = document.getElementById(prefix + 'sys'), num = document.getElementById(prefix + 'num'), held = document.getElementById(prefix + key);
    if (sel && sel.value !== key) sel.value = key;
    if (num) { num.value = held ? held.value : ''; num.placeholder = f.hint || ''; }
  }
  // A number typed: it belongs to the system the drop-down shows.
  function rrCmdIdNumInput(prefix, el) {
    var sel = document.getElementById(prefix + 'sys'); if (!sel || !el) return;
    var key = sel.value, held = document.getElementById(prefix + key);
    if (held) held.value = el.value;
    if (prefix === 'wiz-cmdid-') { var d = wizData(); if (d) d[key] = el.value; }
  }
  // Put the box on one system and the cursor in it (opening, or "Change this one").
  function focusKey(prefix, key) {
    if (key) rrCmdIdPick(prefix, key);
    var num = document.getElementById(prefix + 'num');
    if (num) { try { num.focus(); num.select(); } catch (e) {} }
  }
  // The numbers, as set: [{ key, short, num }] in the card's order.
  function shownNums(vals) {
    return rrCmdIdFields().filter(function (f) { return vals[f.key]; }).map(function (f) { return { key: f.key, short: f.short || labelOf(f), num: vals[f.key] }; });
  }
  function readBoxes(prefix) {
    var out = {}, bad = null;
    rrCmdIdFields().forEach(function (f) {
      var el = document.getElementById(prefix + f.key);
      var n = rrCmdIdNorm(el ? el.value : '', f);
      if (!n.ok && !bad) bad = f;
      out[f.key] = n.v;
    });
    return { vals: out, bad: bad };
  }

  // ═══ THE ITEM PAGE CARD ═══════════════════════════════════════════════════
  var _card = { pd: null, it: null, open: false, saving: false };
  var BTN = 'padding:0.45rem 0.85rem;border-radius:8px;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer';
  function cardShell(inner) {
    return '<div class="rr-cmdid-card" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.75rem 0.9rem;margin-top:0.5rem">' +
      '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.45rem">' + esc(W('title')) + '</div>' + inner + '</div>';
  }
  function cardHtml() {
    var pd = _card.pd, master = _card.it;
    if (!pd || !rrCmdIdOffered(pd, master)) return '';
    var vals = rrCmdIdValues(pd);
    if (_card.open) {
      return cardShell(boxesHtml('cmdid-in-', vals, master, makerKeyOf(pd, master)) +
        '<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.7rem">' +
        '<button type="button" id="cmdid-cancel" onclick="rrCmdIdCancel()" style="' + BTN + ';border:1px solid var(--border);background:var(--surface2);color:var(--text-mid)">' + esc(W('cancel')) + '</button>' +
        '<button type="button" id="cmdid-save" onclick="rrCmdIdSave()" style="' + BTN + ';border:none;background:var(--accent);color:var(--on-accent)">' + esc(W('save')) + '</button>' +
        '</div>');
    }
    var nums = shownNums(vals);
    if (!nums.length) {
      // No ID yet: ONE small button — nothing else, the page stays clean.
      return '<button type="button" id="cmdid-add" class="rr-cmdid-add" onclick="rrCmdIdOpen()" style="' + BTN + ';margin-top:0.5rem;border:1.5px dashed var(--accent2);background:transparent;color:var(--accent2)">' + esc(W('addBtn')) + '</button>';
    }
    var clashes = rrCmdIdClashes(pd, master, vals);
    return cardShell(
      '<div id="cmdid-show" role="button" tabindex="0" onclick="rrCmdIdOpen()" onkeydown="if(event.key===\'Enter\')rrCmdIdOpen()" title="' + esc(W('change')) + '" style="cursor:pointer;display:flex;flex-wrap:wrap;gap:0.4rem 1.6rem;align-items:baseline">' +
      nums.map(function (n) {
        var cl = clashes.filter(function (c) { return c.key === n.key; });
        return '<div class="rr-cmdid-num" data-cmdid-key="' + n.key + '">' +
          '<span style="font-family:var(--font-head);font-size:0.95rem;letter-spacing:0.06em;color:var(--text-mid);margin-right:0.45rem">' + esc(n.short) + '</span>' +
          '<span style="font-family:var(--font-mono);font-size:2.6rem;font-weight:700;line-height:1.05;color:var(--t-accent,var(--text))">' + esc(n.num) + '</span>' +
          (cl.length ? '<div class="rr-cmdid-clash" style="font-size:0.74rem;color:var(--t-orange);margin-top:0.1rem">⚠ ' + esc(fill(W('clashNote'), { item: cl.map(function (c) { return itemName(c.other, c.otherMaster); }).join(', ') })) + '</div>' : '') +
          '</div>';
      }).join('') +
      '</div>' +
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.3rem">' + esc(W('change')) + '</div>');
  }
  function paintCard() {
    var el = document.getElementById('cmdid-card');
    if (el) el.innerHTML = cardHtml();
  }
  function rrCmdIdRenderCard(pd, it) {
    if (_card.pd !== pd) _card.open = false;
    _card.pd = pd; _card.it = it || masterOf(pd);
    paintCard();
  }
  function rrCmdIdOpen() {
    if (!_card.pd) return;
    _card.open = true; paintCard();
    focusKey('cmdid-in-', '');
  }
  function rrCmdIdCancel() { _card.open = false; paintCard(); }
  async function rrCmdIdSave() {
    var pd = _card.pd;
    if (!pd || _card.saving) return false;   // one save at a time (rule 5)
    var r = readBoxes('cmdid-in-');
    if (r.bad) { toast(fill(W('bad'), { label: labelOf(r.bad), n: r.bad.digits || 5 }), 3500, true); return false; }
    var before = rrCmdIdValues(pd);
    var changed = rrCmdIdFields().some(function (f) { return (before[f.key] || '') !== (r.vals[f.key] || ''); });
    if (!changed) { _card.open = false; paintCard(); return true; }
    // the warning only for numbers THIS save sets (re-saving the same copy is silent)
    var newly = {};
    Object.keys(r.vals).forEach(function (k) { if (r.vals[k] && r.vals[k] !== before[k]) newly[k] = r.vals[k]; });
    var ans = await askClashes(rrCmdIdClashes(pd, _card.it, newly));
    if (ans !== true) { focusKey('cmdid-in-', ans); return false; }
    _card.saving = true;
    var btn = document.getElementById('cmdid-save'); if (btn) btn.disabled = true;
    try {
      var write = {};
      rrCmdIdFields().forEach(function (f) { write[f.key] = r.vals[f.key] || ''; });
      var base = Object.assign({}, pd);
      var values = rrPersonalUpdateRow(pd, write);
      var ok = await rrPersonalSafeWrite(pd, values, base, { user: true });   // STALEPAGE: the person's own save — a copy removed elsewhere closes its page
      if (!ok) { if (btn) btn.disabled = false; return false; }
      Object.keys(write).forEach(function (k) { pd[k] = write[k]; });
      try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
      _card.open = false;
      paintCard();
      toast(rrCmdIdHas(pd) ? W('saved') : W('cleared'), 2200);
      return true;
    } catch (e) {
      toast((typeof rrSaveError === 'function') ? rrSaveError(e, 'the Command ID') : 'The Command ID was not saved — try again.', 5000, true);
      if (btn) btn.disabled = false;
      return false;
    } finally {
      _card.saving = false;
    }
  }

  // ═══ THE ADD STEPS ════════════════════════════════════════════════════════
  // The same small button on Purchase & Value (catalog and hand-made adds),
  // every Modern item. Its values ride wizard.data under the field keys; the
  // save writes them onto the item's OWN row only (rrCmdIdSaveValues) — never
  // onto its box, tender or set mates. Ignored, it changes nothing.
  function wizMaster(d) {
    try { if (typeof wizard !== 'undefined' && wizard && wizard.matchedItem) return wizard.matchedItem; } catch (e) {}
    return null;
  }
  function wizProbe(d) {
    d = d || {};
    return { eraPeriod: d.eraPeriod || '', yearMade: d.yearMade || d.manualYear || '', era: d._era || '', _era: d._era || '',
             itemType: d.manualItemType || d.itemType || '', itemNum: d.itemNum || d.manualItemNum || '', inventoryId: '' };
  }
  // A NEW item has no saved ID yet, so only its era decides (what was typed
  // in the boxes a moment ago does not count as "already holds one").
  // The Add steps' maker: the copy's own, else the matched catalog row's, else the era's.
  function wizMakerKey(d) {
    d = d || {};
    var k = makerKeyOf(null, wizMaster(d), [d._manufacturer, d.manufacturer]);
    if (k) return k;
    try { if (typeof _getEraManufacturer === 'function') return makerKeyOf(null, null, [_getEraManufacturer()]); } catch (e) {}
    return '';
  }
  function wizOffered(d) {
    return rrCmdIdPeriod(wizProbe(d), wizMaster(d)) === 'modern';
  }
  function wizInner(d) {
    d = d || {};
    var vals = {};
    rrCmdIdFields().forEach(function (f) { var n = rrCmdIdNorm(d[f.key], f); if (n.ok && n.v) vals[f.key] = n.v; });
    if (d._cmdIdOpen) {
      return cardShell(boxesHtml('wiz-cmdid-', vals, wizMaster(d), wizMakerKey(d)) +
        '<div style="display:flex;justify-content:flex-end;margin-top:0.6rem">' +
        '<button type="button" id="wiz-cmdid-done" onclick="rrCmdIdWizDone()" style="' + BTN + ';border:none;background:var(--accent);color:var(--on-accent)">' + esc(W('done')) + '</button></div>');
    }
    var nums = shownNums(vals);
    if (!nums.length) {
      return '<button type="button" id="wiz-cmdid-add" class="rr-cmdid-add" onclick="rrCmdIdWizOpen()" style="' + BTN + ';border:1.5px dashed var(--accent2);background:transparent;color:var(--accent2)">' + esc(W('addBtn')) + '</button>';
    }
    return cardShell('<div id="wiz-cmdid-show" role="button" tabindex="0" onclick="rrCmdIdWizOpen()" style="cursor:pointer;display:flex;flex-wrap:wrap;gap:0.3rem 1.2rem">' +
      nums.map(function (n) { return '<span><span style="font-size:0.8rem;color:var(--text-mid);margin-right:0.3rem">' + esc(n.short) + '</span><strong style="font-family:var(--font-mono);font-size:1.3rem">' + esc(n.num) + '</strong></span>'; }).join('') +
      '</div><div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">' + esc(W('change')) + '</div>');
  }
  function rrCmdIdWizHtml(d) {
    if (!wizOffered(d)) return '';
    return '<div id="wiz-cmdid" style="margin:0.25rem 0 0.75rem">' + wizInner(d) + '</div>';
  }
  function wizData() { try { return (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data : null; } catch (e) { return null; } }
  function wizPaint() { var d = wizData(), el = document.getElementById('wiz-cmdid'); if (d && el) el.innerHTML = wizInner(d); }
  function rrCmdIdWizOpen() {
    var d = wizData(); if (!d) return;
    d._cmdIdOpen = true; wizPaint();
    focusKey('wiz-cmdid-', '');
  }
  async function rrCmdIdWizDone() {
    var d = wizData(); if (!d) return false;
    var r = readBoxes('wiz-cmdid-');
    if (r.bad) { toast(fill(W('bad'), { label: labelOf(r.bad), n: r.bad.digits || 5 }), 3500, true); return false; }
    Object.keys(r.vals).forEach(function (k) { d[k] = r.vals[k]; });
    var probe = wizProbe(d);
    var ans = await askClashes(rrCmdIdClashes(probe, wizMaster(d), r.vals));
    if (ans !== true) { focusKey('wiz-cmdid-', ans); return false; }
    d._cmdIdOpen = false; wizPaint();
    return true;
  }
  // What an Add save writes onto the item's OWN row: { tmccId: '12', … }.
  // Nothing when the button was never used (or the item is not offered one).
  function rrCmdIdSaveValues(d) {
    var out = {};
    if (!d) return out;
    var any = rrCmdIdFields().some(function (f) { return String(d[f.key] || '').trim(); });
    if (!any || !wizOffered(d)) return out;
    rrCmdIdFields().forEach(function (f) {
      var n = rrCmdIdNorm(d[f.key], f);
      if (n.ok && n.v) out[f.key] = n.v;
    });
    return out;
  }

  // ═══ SEARCH ═══════════════════════════════════════════════════════════════
  // "ID 12" (any system), or a system's own word + the number: "DCS 12",
  // "TMCC 12", "Legacy 12", "DCC 12". A bare "12" is NOT an ID search — it
  // would drown in item numbers. → { keys: [field keys], num } or null.
  function rrCmdIdQuery(q) {
    var m = String(q || '').trim().match(/^([a-z]+)\s*[:#]?\s*(\d{1,6})$/i);
    if (!m) return null;
    var word = m[1].toLowerCase();
    var n = rrCmdIdNorm(m[2], { digits: 6 });
    if (!n.ok || !n.v) return null;
    var fs = rrCmdIdFields();
    var keys;
    if ((W('searchAny') || []).indexOf(word) >= 0) keys = fs.map(function (f) { return f.key; });
    else keys = fs.filter(function (f) { return (f.words || []).indexOf(word) >= 0; }).map(function (f) { return f.key; });
    if (!keys.length) return null;
    return { keys: keys, num: n.v };
  }
  function rrCmdIdMatches(pd, q) {
    if (!pd || !q) return false;
    var v = rrCmdIdValues(pd);
    return q.keys.some(function (k) { return v[k] === q.num; });
  }

  // ═══ THE READY-MADE REPORT ════════════════════════════════════════════════
  // Lists ONLY the items that have a Command ID (a real filter of the report
  // builder — "Has a Command ID" — usable on any report): item number, type,
  // road name, description, the three IDs and where it is kept, sorted by
  // system then number. Edit it and save it as your own like any report.
  function rrCmdIdReportDef() {
    var ids = rrCmdIdFields().map(function (f) { return f.key; });
    var cols = ['itemNum', 'itemType', 'roadName', 'description'].concat(ids).concat(['location', 'locationDetail']);
    var on = {}; cols.forEach(function (k) { on[k] = true; });
    return {
      id: null, name: W('reportName'),
      colOrder: cols, colEnabled: on,
      filters: { hasCmdId: 'Yes' },
      sort: ids.map(function (k) { return { field: k, dir: 'asc' }; }),
    };
  }

  if (typeof window !== 'undefined') {
    window.rrCmdIdFields = rrCmdIdFields;
    window.rrCmdIdNorm = rrCmdIdNorm;
    window.rrCmdIdValues = rrCmdIdValues;
    window.rrCmdIdHas = rrCmdIdHas;
    window.rrCmdIdPeriod = rrCmdIdPeriod;
    window.rrCmdIdOffered = rrCmdIdOffered;
    window.rrCmdIdHint = rrCmdIdHint;
    window.rrCmdIdOnTrack = rrCmdIdOnTrack;
    window.rrCmdIdClashes = rrCmdIdClashes;
    window.rrCmdIdRenderCard = rrCmdIdRenderCard;
    window.rrCmdIdOpen = rrCmdIdOpen;
    window.rrCmdIdPick = rrCmdIdPick;
    window.rrCmdIdNumInput = rrCmdIdNumInput;
    window.rrCmdIdStartKey = rrCmdIdStartKey;
    window.rrCmdIdMakerKey = makerKeyOf;
    window.rrCmdIdCancel = rrCmdIdCancel;
    window.rrCmdIdSave = rrCmdIdSave;
    window.rrCmdIdWizHtml = rrCmdIdWizHtml;
    window.rrCmdIdWizOpen = rrCmdIdWizOpen;
    window.rrCmdIdWizDone = rrCmdIdWizDone;
    window.rrCmdIdSaveValues = rrCmdIdSaveValues;
    window.rrCmdIdQuery = rrCmdIdQuery;
    window.rrCmdIdMatches = rrCmdIdMatches;
    window.rrCmdIdReportDef = rrCmdIdReportDef;
  }
})();
