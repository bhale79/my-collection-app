#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ALL COLLECTIONS — the combined view, the export snapshot, the business
// summary — TRR Pro release 8 (real Chromium, the REAL app, tests/lib/coll-world.js)
//
// [stated] Brad 2026-10-28: a live combined view + an export snapshot, not a
// second stored sheet; 2026-10-31 09:39 CT "build all the releases".
//   G  source guards, each PROVED on a planted offender
//   V  the view holds EXACTLY what each collection's own list holds (the one
//      row reader): moved-out rows, header rows, archived collections (unless
//      asked) stay out; full IDs; search, one collection, sort; tapping an
//      item opens it in its own collection; one unreadable collection → the
//      others shown and it says which
//   S  the summary: items, value, labelled / shelved / photo, the total
//   E  the export: a NEW sheet in Collections, stamped "edits do NOT go back",
//      All Items + Summary, no client named; nothing written to any collection
//   X  a regular customer sees none of it
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_all_r8_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1500))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── G · source guards ──────────────────────────────────────────────────────
function ownRowRules(src) {
  const s = stripComments(src);
  return /transferredTo/.test(s) || /_rrHeaderishRow/.test(s) || /rrPersonalRecordFromRow\(/.test(s) || !/rrHeldRecordFromRow\(r, i \+ 3\)/.test(s);
}
function writesToCollections(src) {
  const s = stripComments(src);
  const calls = s.match(/\b(sheetsUpdate|sheetsAppend|sheetsClear|sheetsDeleteRow|rrVerifiedRowUpdate|rrRemoveRowConfirmed)\(\s*([A-Za-z_.]+)/g) || [];
  return calls.filter(c => !/\(\s*sid$/.test(c));
}
function namesClients(src) { const s = stripComments(src); return /rrCollectionClient\s*\(|\.clientId\b|contactsData/.test(s); }
function loaderShares(src) {
  return /if \(!rrPersonalRowHasItem\(r\)\) return;/.test(src) && /if \(rrRecordMovedOut\(_rec\)\) \{/.test(src) &&
    /function rrHeldRecordFromRow\(r, rowNum\) \{[\s\S]{0,200}_rrHeaderishRow\(r\)[\s\S]{0,120}rrPersonalRowHasItem\(r\)[\s\S]{0,120}rrRecordMovedOut\(rec\)/.test(src);
}
function guards() {
  console.log('\n== G · source guards ==');
  const all = read('collections-all.js'), data = read('app-data.js');
  T('G1 the view reads rows ONLY through the one row reader (rrHeldRecordFromRow) — no rule of its own', !ownRowRules(all));
  T('G1b PLANTED: a view that decides "moved out" itself → caught', ownRowRules(all + "\nif (rec.transferredTo) {}"));
  T('G2 the loader and the view share the SAME three row rules (app-data.js)', loaderShares(data));
  T('G2b PLANTED: the loader with its own copy of the number rule → caught', !loaderShares(data.replace('if (!rrPersonalRowHasItem(r)) return;', "if (!r[itemNumCol]) return;")));
  const w = writesToCollections(all);
  T('G3 the screen never writes to a collection — its only writes go to the NEW snapshot sheet', w.length === 0 && /sheetsUpdate\(sid,/.test(all), w);
  T('G3b PLANTED: a write to a collection\'s sheet → caught', writesToCollections(all + '\nsheetsUpdate(c.sheetId, "x", []);').length === 1);
  T('G4 PRIVACY: the view and the snapshot never name a client', !namesClients(all));
  T('G4b PLANTED: the snapshot reading the client → caught', namesClients(all + '\nvar k = c.clientId;'));
  const ix = read('index.html'), sw = read('sw.js');
  const core = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core;
  T('G5 collections-all.js is loaded, offline, CORE', ix.includes('src="./collections-all.js?v=') && sw.includes("'./collections-all.js'") && core.includes('app/collections-all.js'));
  const cfg = read('config.js');
  const block = (cfg.match(/var RR_COLL_ALL = \{[\s\S]*?\n\};/) || [''])[0];
  T('G6 every word in RR_COLL_ALL (config.js); none says "AI"; no typed toast', block.length > 0 && !/\bAI\b/.test(block) && !/toast\('[A-Z]/.test(stripComments(all)));
}

async function steady(pg) {
  await pg.evaluate(() => {
    for (let i = 0; i < 8; i++) history.pushState({ pad: i }, '', '');
    window.__rm = async (id) => { const d = document.getElementById(id); if (d) d.remove(); await new Promise(r => setTimeout(r, 250)); };
  });
}

async function viewRun(browser) {
  console.log('\n== V · the view ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await pg.evaluate(async () => {
    const F = PERSONAL_FIELD_INDEX;
    const S7 = window.__S.S7['My Collection'];
    S7[2][F.userEstWorth] = '250'; S7[3][F.userEstWorth] = '$1,000'; S7[4][F.userEstWorth] = '40';
    S7[3][F.photoItem] = 'https://drive.google.com/drive/folders/F46';
    // Smith: No. 12 moved out (never held), a stray header row in Jones
    window.__S.S8['My Collection'][3][F.transferredTo] = 'To 7 – Hale as 7-49 on 2026-10-30 [m:mvB:12]';
    window.__S.S8['My Collection'][2][F.userEstWorth] = '75';
    window.__S.S9['My Collection'].push(PERSONAL_HEADERS.slice());
    // Jones is archived; Hale has a client (never to be named in the snapshot)
    const L = JSON.parse(window.__files.LIST.content); L.items.c9.status = 'archived'; L.items.c9.archivedAt = Date.now(); L.items.c7.clientId = 'K1';
    window.__files.LIST.content = JSON.stringify(L);
    await rrCollectionsLoad();
    state.contactsData = [{ id: 'K1', name: 'Pat Hale', email: 'pat@example.test' }];
    if (!document.getElementById('main-content')) document.body.appendChild(Object.assign(document.createElement('div'), { id: 'main-content' }));
  });
  const v = await pg.evaluate(async () => {
    const until = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 100 && !fn(); i++) await new Promise(r => setTimeout(r, 100)); return !!fn(); };
    const out = {};
    window.__calls = [];
    rrCollMenuOpen();
    document.querySelector('#rr-coll-list [data-coll-all]').click();   // TAPPED
    out.opened = await until(() => document.querySelectorAll('#rr-all-body [data-all-row]').length > 0);
    const rows = () => [...document.querySelectorAll('#rr-all-body [data-all-row]')].map(b => b.getAttribute('data-all-row'));
    out.rows = rows();
    out.ids = [...document.querySelectorAll('#rr-all-body [data-all-row] span:first-child')].map(s => s.textContent);
    out.count = (document.querySelector('[data-all-count]') || {}).textContent;
    // the same items each collection's OWN list holds
    const read = await rrAllRead({});
    out.own = {};
    for (const k of ['home', 'c7', 'c8']) {
      await rrSwitchCollection(k, { quietMs: 0, repaint: false });
      await _loadPersonalFromSheets(state.personalSheetId, true);   // the list as a fresh read of its own sheet gives it
      out.own[k] = { list: Object.values(state.personalData).map(p => p.inventoryId).sort().join(), view: ((read.per[k] || {}).recs || []).map(r => r.inventoryId).sort().join() };
    }
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    window.__calls = [];   // (opening a collection may write its own headers — not this screen's doing)
    // archived only when asked
    document.getElementById('rr-all-arch').click();
    await until(() => rows().some(r => r.indexOf('c9|') === 0));
    out.withArch = rows();
    document.getElementById('rr-all-arch').click();
    await until(() => !rows().some(r => r.indexOf('c9|') === 0));
    // search, one collection, sort
    const q = document.getElementById('rr-all-q'); q.value = 'garage'; q.dispatchEvent(new Event('input'));
    await until(() => rows().length === 1);
    out.search = rows();
    q.value = ''; q.dispatchEvent(new Event('input'));
    const sel = document.getElementById('rr-all-coll'); sel.value = 'c8'; sel.dispatchEvent(new Event('change'));
    await until(() => rows().length === 1);
    out.oneColl = rows();
    sel.value = ''; sel.dispatchEvent(new Event('change'));
    const so = document.getElementById('rr-all-sort'); so.value = 'value'; so.dispatchEvent(new Event('change'));
    await until(() => rows()[0] === 'c7|46');
    out.byValue = rows().slice(0, 3);
    so.value = 'coll'; so.dispatchEvent(new Event('change'));
    // the summary
    document.querySelector('[data-all-tab="summary"]').click();
    await until(() => !!document.querySelector('[data-all-total]'));
    out.sum = [...document.querySelectorAll('[data-all-sum], [data-all-total]')].map(tr => [...tr.children].map(td => td.textContent));
    document.querySelector('[data-all-tab="items"]').click();
    await until(() => rows().length > 0);
    out.writes = window.__calls.filter(c => (c.kind === 'put' || c.kind === 'append') && ['HOME', 'S7', 'S8', 'S9'].includes(c.sid)).length;
    // tap an item → its own collection opens, and the item with it
    window.__opened = [];
    const realOpen = window._openOwnedByInvId; window._openOwnedByInvId = function (inv) { window.__opened.push(inv); };
    document.querySelector('[data-all-row="c7|47"]').click();
    out.tapped = await until(() => state.personalSheetId === 'S7' && window.__opened.length > 0);
    out.openedInv = window.__opened[0]; out.viewClosed = !document.getElementById('rr-coll-all');
    window._openOwnedByInvId = realOpen;
    return out;
  });
  T('V1 tapping All Collections in the drop-down opens it with every held item: home + Hale + Smith (6)', v.opened && v.rows.length === 6 && /^Showing 6 of 6/.test(v.count || ''), v);
  T('V2 each collection shows EXACTLY what its own list holds (Smith\'s moved-out No. 12 left out)', ['home', 'c7', 'c8'].every(k => v.own[k].list === v.own[k].view) && v.own.c8.view === '45', v.own);
  T('V3 full IDs: 7-45 in Hale, the plain number at home', v.ids.includes('7-45') && v.ids.includes('8-45') && v.ids.includes('3'), v.ids);
  T('V4 an archived collection only when asked (Jones\'s one item, not its stray header row)', !v.rows.some(r => r.indexOf('c9|') === 0) && v.withArch.filter(r => r.indexOf('c9|') === 0).length === 1, v);
  T('V5 search ("garage" → 7-45 only), one collection (Smith → 1), sort by value (7-46 $1,000 first)', JSON.stringify(v.search) === '["c7|45"]' && JSON.stringify(v.oneColl) === '["c8|45"]' && v.byValue[0] === 'c7|46' && v.byValue[1] === 'c7|45', v);
  T('V6 tapping an item opens its own collection and the item there; the view closes', v.tapped && v.openedInv === '47' && v.viewClosed, v);
  const hale = (v.sum || []).find(r => r[0] === '7 – Hale') || [], tot = (v.sum || []).find(r => r[0] === 'All collections') || [];
  T('S1 the summary: Hale 4 items, $1,290, labelled 25%, shelved 25%, with a photo 50%; the to-do line', hale[1] === '4' && /1,290/.test(hale[2]) && hale[3] === '25%' && hale[4] === '25%' && hale[5] === '50%' && /3 to label · 3 to shelve · 2 to photograph/.test(hale[7]), v.sum);
  T('S2 the total row counts the same items as the list (6), $1,365', tot[1] === '6' && /1,365/.test(tot[2]), tot);
  T('V7 the view wrote NOTHING to any collection', v.writes === 0, v.writes);

  console.log('\n== E · the export snapshot ==');
  const e = await pg.evaluate(async () => {
    window.__calls = [];
    const r = await rrAllExport({});
    const S = window.__S[r.sheetId];
    const items = S['All Items'], sum = S['Summary'];
    const f = window.__files[r.sheetId];
    return { ok: r.ok, title: r.title, note: items[0][0], head: items[1], n: items.length - 2, first: items[2], sumRows: sum.length - 2, sumTotal: sum[sum.length - 1],
      inColls: (f.parents || []).includes('COLLS'), url: r.url,
      client: JSON.stringify(S).indexOf('Pat Hale') >= 0,
      writes: window.__calls.filter(c => (c.kind === 'put' || c.kind === 'append') && ['HOME', 'S7', 'S8', 'S9'].includes(c.sid)).length };
  });
  T('E1 a NEW sheet "The Rail Roster – All Collections <date time>", put in The Rail Roster › Collections', e.ok && /^The Rail Roster – All Collections \d{4}-\d{2}-\d{2} \d{4}$/.test(e.title) && e.inColls, e);
  T('E2 stamped: "Edits made here do NOT go back to the app"; headers; one row per held item (6)', /Edits made here do NOT go back to the app/.test(e.note) && e.head.join() === 'ID,Collection,Item,Item number,Maker,Condition,Value,Location,Label' && e.n === 6 && e.first[0] === '3', e);
  T('E3 a Summary tab with each collection (3) and the total', e.sumRows === 4 && e.sumTotal[0] === 'All collections' && String(e.sumTotal[1]) === '6', e);
  T('E4 PRIVACY: the snapshot never names the client; nothing written to any collection', !e.client && e.writes === 0, e);

  // one collection that cannot be read
  const f = await pg.evaluate(async () => {
    window.__fail.push({ re: /spreadsheets\/S8\/values/, method: 'GET', times: 1 });
    const r = await rrAllRead({ force: true });
    rrCollMenuOpen(); document.querySelector('#rr-coll-list [data-coll-all]').click();
    for (let i = 0; i < 60 && !document.querySelector('#rr-all-body [data-all-row]'); i++) await new Promise(x => setTimeout(x, 100));
    return { failed: r.failed, n: r.rows.length };
  });
  T('V8 one collection that cannot be read → the others are shown and it says which', JSON.stringify(f.failed) === '["8 – Smith"]' && f.n === 5, f);
  T('V9 no script error', errs.length === 0, errs);
  await pg.close();

  console.log('\n== X · a regular customer ==');
  const x = await boot(browser, { off: true });
  const o = await x.pg.evaluate(() => { rrAllOpen(); return { open: !!document.getElementById('rr-coll-all') }; });
  T('X1 switched off (a regular customer): no All Collections', !o.open, o);
  await x.pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try { await viewRun(browser); } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
