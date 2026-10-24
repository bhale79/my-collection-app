#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM COLUMNS: ON THE ITEM PAGE, RENAMED FROM THE HEADING, NEVER TWICE
//                                                   v0.9.2018 (real Chromium)
//
// [stated] Brad, 2026-10-23:
//   "on custom column header names, you should be able to click them when you
//    are in the edit screen to rename them. I know you can do this in the
//    preferences, but it would be handy here too"
//   "if i add a custom column, have it automatically show in the item detail
//    page. right now you have to go to the item detail page and then turn it on"
//   (and his screenshot: "CUSTOMER NAME" twice — two columns, one name) → "go".
// Every way a column is named goes through rrFieldClaimCustom (config.js):
// it now refuses a name another column has (rrCustomNameTaken) and a newly
// named column joins the item page's saved field list (rrDetailFieldsJoin).
// The default item page shows a NAMED column even while it is blank.
// Column edit: table-columns.js rrTableRename, per table spec.renamable.
//
//   D1  a saved item-page choice: naming a column (the REAL "+ Custom column"
//       flow) puts it on the item page, with a dash until filled
//   D2  no saved choice: the named column shows too, with a dash
//   D3  a column he later unticks on the item page stays off after a rename
//   R1  column edit: a named custom heading is clickable; built-ins are not;
//       click → type → Rename → the heading and the item page both change
//   R2  the same name as another column (any case, spaces) → refused, with
//       a message; the name stays; also a built-in name ("Description")
//   R3  Preferences rename and the "+ Custom column" flow refuse it too
//   R4  the import naming from a sheet's own headers is unchanged (auto)
//   X*  PLANTED: no guard (R2), no join (D1), blank hidden (D2), no clickable heading (R1)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  custom_column_names_2018_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

async function run(browser, savedChoice, files) {
  const pg = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async savedChoice => {
    const wait = ms => new Promise(z => setTimeout(z, ms));
    state.user = { email: 'support@therailroster.com', name: 'Brad' };
    state.masterData = [{ itemNum: '2343', roadName: 'Santa Fe', itemType: 'Diesel', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = { '101': { inventoryId: '101', itemNum: '2343', variation: '', owned: true, condition: 8, row: 2 } };
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    window.__toasts = []; const _t = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { _t.apply(this, arguments); } catch (e) {} };
    // his account today: Customer Name named; the detail card choice (or none)
    rrPrefWrite('lv_label_custom1', 'Customer Name'); rrPrefWrite('lv_custom1_enabled', 'true');
    _rrDetailFieldsWrite(savedChoice ? ['condition', 'uf_custom1'] : []);
    rrTableSave('collection', ['var', 'type', 'desc', 'custom1']);
    const r = {};
    const cardLabels = async () => {
      showItemDetailPage(0, '101'); await wait(500);
      const txt = [...document.querySelectorAll('#page-itemdetail div')].map(d => d.textContent).join('|');
      const owner = /Owner/.test(txt), buyer = /Buyer/.test(txt);
      const cfg = _rrDetailFieldCfg();
      return { owner, buyer, cfg };
    };
    // D: the REAL "+ Custom column" flow names the next spare column "Owner"
    goToMyCollection(); await wait(300);
    rrTagOpen('__new'); await wait(200);
    const sel = document.getElementById('rr-tag-field'); if (sel) sel.value = '__new';
    const nn = document.getElementById('rr-tag-newname'); if (nn) nn.value = 'Owner';
    const val = document.getElementById('rr-tag-value'); if (val) val.value = 'Bob';
    rrTagNext(); await wait(200);
    r.claimed = { label2: rrPrefRead('lv_label_custom2'), field: (typeof rrTagField === 'function') ? rrTagField() : '' };
    try { rrTagDone && rrTagDone(); } catch (e) {}
    r.D = await cardLabels();
    // D3: untick Owner on the item page, then rename it → stays off
    if (savedChoice) {
      _rrDetailFieldsWrite(_rrDetailFieldCfg().filter(x => x !== 'uf_custom2'));
      rrFieldClaimCustom('custom2', 'Owner Name');
      r.D3 = _rrDetailFieldCfg();
      rrFieldClaimCustom('custom2', 'Owner');
    }
    // R1: column edit
    goToMyCollection(); await wait(300);
    rrTableEdit('collection', true); await wait(300);
    const heads = [...document.querySelectorAll('th[data-col]')];
    r.R1heads = heads.map(th => ({ col: th.dataset.col, rename: !!th.querySelector('.rr-th-rename') }));
    const span = document.querySelector('th[data-col="custom1"] .rr-th-rename');
    if (span) {
      span.click(); await wait(300);
      const inp = document.getElementById('_ap-input');
      r.R1prompt = !!inp && inp.value;
      if (inp) { inp.value = 'Buyer'; document.getElementById('_ap-ok').click(); }
      await wait(400);
    }
    r.R1 = { label: rrPrefRead('lv_label_custom1'), head: ((document.querySelector('th[data-col="custom1"]') || {}).textContent || '').trim() };
    r.R1card = await cardLabels();
    // R2: the same name as another column → refused
    window.__toasts = [];
    goToMyCollection(); await wait(300); rrTableEdit('collection', true); await wait(300);
    const span2 = document.querySelector('th[data-col="custom1"] .rr-th-rename');
    if (span2) { span2.click(); await wait(300); const i2 = document.getElementById('_ap-input'); if (i2) { i2.value = '  owner '; document.getElementById('_ap-ok').click(); } await wait(400); }
    r.R2 = { label: rrPrefRead('lv_label_custom1'), toasts: window.__toasts.slice() };
    r.R2b = { ok: rrFieldClaimCustom('custom1', 'Description'), label: rrPrefRead('lv_label_custom1') };
    // R3: Preferences rename + the "+ Custom column" flow
    r.R3pref = (function () { _ufRename('custom1', 'Owner'); return rrPrefRead('lv_label_custom1'); })();
    rrTagOpen('__new'); await wait(200);
    const s3 = document.getElementById('rr-tag-field'); if (s3) s3.value = '__new';
    const n3 = document.getElementById('rr-tag-newname'); if (n3) n3.value = 'buyer';
    const v3 = document.getElementById('rr-tag-value'); if (v3) v3.value = 'x';
    rrTagNext(); await wait(200);
    r.R3tag = { label3: rrPrefRead('lv_label_custom3') || '', active: (typeof rrTagActive === 'function') ? rrTagActive() : null };
    try { const o = document.getElementById('rr-tag-overlay') || document.querySelector('[id^="rr-tag"]'); } catch (e) {}
    // R4: the import's automatic naming is unchanged
    r.R4 = rrFieldClaimCustom('custom4', 'Buyer', { auto: true });
    return r;
  }, savedChoice);
  await pg.close();
  return Object.assign(out, { errs });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== D · a new column shows on the item page ==');
  const A = await run(browser, true);
  T('D1 the "+ Custom column" flow named the spare column "Owner"', A.claimed.label2 === 'Owner' && A.claimed.field === 'custom2', A.claimed);
  T('D1 saved item-page choice: "Owner" joined it and shows on the item page', A.D.owner && A.D.cfg && A.D.cfg.indexOf('uf_custom2') >= 0, A.D);
  T('D3 unticked on the item page later → a rename does not put it back', A.D3 && A.D3.indexOf('uf_custom2') < 0, A.D3);
  const B = await run(browser, false);
  T('D2 no saved choice: "Owner" shows on the item page (a dash until filled)', B.D.owner && B.D.cfg === null, B.D);

  console.log('== R · rename from the heading ==');
  T('R1 column edit: the named custom heading is clickable, the built-ins are not', A.R1heads.some(h => h.col === 'custom1' && h.rename) && A.R1heads.filter(h => ['var', 'type', 'desc'].indexOf(h.col) >= 0).every(h => !h.rename), A.R1heads);
  T('R1 click → the box opens with the current name', A.R1prompt === 'Customer Name', A.R1prompt);
  T('R1 Rename → "Buyer" in the heading, the account setting, and on the item page', A.R1.label === 'Buyer' && /Buyer/.test(A.R1.head) && A.R1card.buyer, { R1: A.R1, card: A.R1card });
  T('R2 the same name as another column ("  owner ") → refused with a message; Buyer stays', A.R2.label === 'Buyer' && A.R2.toasts.some(t => /already have a column called “Owner”/.test(t)), A.R2);
  T('R2 a built-in name ("Description") is refused too', A.R2b.ok === '' && A.R2b.label === 'Buyer', A.R2b);
  T('R3 Preferences rename to "Owner" → refused, Buyer stays', A.R3pref === 'Buyer', A.R3pref);
  T('R3 "+ Custom column" named "buyer" → refused, no third column named', A.R3tag.label3 === '', A.R3tag);
  T('R4 the import naming from a sheet\'s own headers is unchanged', A.R4 === 'Buyer', A.R4);
  T('page errors', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs));

  console.log('== X · planted ==');
  const CFG = rd('config.js');
  let x = await run(browser, true, { 'config.js': planted(CFG, '    var taken = rrCustomNameTaken(v, key);', '    var taken = \'\';', 'guard') });
  T('X-R2 PLANTED: no same-name guard → the second "Owner" goes through (caught)', /owner/i.test(x.R2.label || ''), x.R2);
  x = await run(browser, true, { 'config.js': planted(CFG, "  if (v && !was && typeof rrDetailFieldsJoin === 'function') { try { rrDetailFieldsJoin('uf_' + key); } catch (e) {} }\n", '', 'join') });
  T('X-D1 PLANTED: no item-page join → "Owner" missing from a saved item page (caught)', !x.D.owner, x.D);
  x = await run(browser, false, { 'app-collection.js': planted(rd('app-collection.js'), 'return d.val || _rrDetailNamedCustom(d.id);', 'return d.val;', 'default card') });
  T('X-D2 PLANTED: the default item page hides a blank named column → "Owner" missing (caught)', !x.D.owner, x.D);
  x = await run(browser, true, { 'table-columns.js': planted(rd('table-columns.js'), '        (rrTableRenamable(id, col)', '        (false', 'clickable') });
  T('X-R1 PLANTED: no clickable heading → nothing to click (caught)', !x.R1heads.some(h => h.rename), x.R1heads);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
