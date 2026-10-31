#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COLLECTIONS YOU CAN SEE — v0.9.2071 (TRR Pro release 5; real Chromium, the REAL app)
//
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Step 3,
// Sections 1, 2, 4); [stated] Brad 2026-10-30 17:42 CT "yes" to building it.
//   G  source guards, each PROVED on a planted offender: the settings file
//      always names the HOME sheet; only home renames to the personal name;
//      showPage asks about a switched-off list BEFORE it reveals a page; the
//      client's details never reach anything shared outward; the shareable For
//      Sale sheet is per collection and named by number only
//   F  switched off (a regular customer): no button, the list file never read
//   C  + New collection: a number from the list file, its own folder + Photos +
//      Sold Photos under The Rail Roster › Collections, its own sheet moved
//      there with every tab, the key + number inside both, opened at once;
//      two devices at once → two different numbers; a failure part way is
//      FINISHED later, never made twice
//   L  the list switches: hidden everywhere, the door redirects, home has all
//   H  the client header (name, Call, Email, fields, notes; folds); the
//      details card (rename = folder + sheet renamed; lists; your own fields)
//   A  "Adding to 1 – Hale" on the Add screen; nothing at home
//   B  at start the device opens the collection it last had open
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_ui_2071_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── G · source guards ──────────────────────────────────────────────────────
function configWritesHome(files) { return files.filter(([f, s]) => /personalSheetId:\s*state\.personalSheetId\b/.test(stripComments(s))).map(([f]) => f); }
function showPageAsksFirst(appjs) {
  const i = appjs.indexOf('function showPage(name, clickedEl) {');
  const body = appjs.slice(i, i + 4000);
  const ask = body.indexOf('rrPageAllowed(name)'), reveal = body.indexOf("getElementById('page-' + name).classList.add('active')");
  return ask > 0 && reveal > 0 && ask < reveal;
}
const OUTWARD = ['sell.js', 'share.js', 'report-export.js', 'dispatch-board.js', 'vault.js', 'error-report.js'];
function clientLeaks(files) {
  return files.filter(([f, s]) => /rrCollectionClient\s*\(|\.clientId\b/.test(stripComments(s))).map(([f]) => f);
}
function guards() {
  console.log('\n== G · source guards ==');
  const all = fs.readdirSync(APP).filter(f => f.endsWith('.js')).map(f => [f, read(f)]);
  const cw = configWritesHome(all);
  T('G1 the settings file (driveWriteConfig) always names the HOME sheet — never the open collection\'s', cw.length === 0, cw);
  T('G1b PLANTED: a config write of state.personalSheetId → caught', configWritesHome([['app-data.js', read('app-data.js') + '\ndriveWriteConfig({ personalSheetId: state.personalSheetId });']]).length === 1);
  const appjs = read('app.js');
  T('G2 only the HOME sheet is renamed to the personal sheet\'s name', /async function _maybeRenamePersonalSheet\(\) \{[\s\S]{0,300}if \(typeof rrIsHome === 'function' && !rrIsHome\(\)\) return;/.test(appjs));
  T('G3 showPage asks "is this list on here?" BEFORE it reveals a page', showPageAsksFirst(appjs));
  T('G3b PLANTED: the question moved below the reveal → caught', !showPageAsksFirst(appjs.replace("if (typeof rrPageAllowed === 'function' && !rrPageAllowed(name)) {", "if (false) {") ));
  const out = all.filter(([f]) => OUTWARD.includes(f));
  const leaks = clientLeaks(out);
  T('G4 PRIVACY: nothing shared outward (' + OUTWARD.join(', ') + ') reads the client\'s details', out.length === OUTWARD.length && leaks.length === 0, { leaks, found: out.map(x => x[0]) });
  T('G4b PLANTED: sell.js reading rrCollectionClient → caught', clientLeaks([['sell.js', read('sell.js') + '\nvar x = rrCollectionClient(rrCurrentCollection());']]).length === 1);
  const ui = read('collections-ui.js');
  T('G4c the client\'s details are read in ONE place (rrCollectionClient, collections-ui.js)', (stripComments(ui).match(/state\.contactsData/g) || []).length === 2 && /function rrCollectionClient\(c\)/.test(ui));
  const sell = read('sell.js');
  T('G5 the shareable For Sale sheet: its id per collection (rrCollKey), its name by NUMBER only', /rrCollKey\('rr_sell_sheet_id'\)/.test(sell) && /' - collection ' \+ c\.number/.test(sell) && !/c\.name/.test((sell.match(/function _sellSheetName\(\) \{[\s\S]*?\n\}/) || [''])[0]) && !/localStorage\.(get|set)Item\('rr_sell_sheet_id'/.test(stripComments(sell)));
  const ix = read('index.html');
  T('G6 collections-ui.js is loaded, in the offline copy, and a CORE file', /src="\.\/collections-ui\.js\?v=/.test(ix) && /'\.\/collections-ui\.js'/.test(read('sw.js')) && JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core.includes('app/collections-ui.js'));
  const cfg = read('config.js');
  const block = (cfg.match(/var RR_COLL_UI = \{[\s\S]*?\n\};/) || [''])[0];
  T('G7 every word in RR_COLL_UI (config.js); none says "AI"', block.length > 500 && !/\bAI\b/.test(block) && !/showToast\('[A-Z]/.test(stripComments(ui)));
  T('G8 a save on these screens is a one-tap save (rrOnce)', (ui.match(/rrOnce\('rr-coll-/g) || []).length >= 3);
  const wz = read('wizard.js'), ws = read('wizard-save.js'), ap = read('app-pages.js');
  T('G9 every ADD ends at one door: the wizard\'s step painter asks rrAddAllowed FIRST', addDoorFirst(wz));
  T('G9b PLANTED: the question removed from renderWizardStep → caught', !addDoorFirst(wz.replace("typeof rrAddAllowed === 'function' && !rrAddAllowed(wizard.tab)", 'false')));
  T('G9c openWizard asks BEFORE it loads anything (nothing can open late)', (() => { const i = wz.indexOf('async function openWizard(tab) {'); const b = stripComments(wz.slice(i, i + 3000)); const a = b.indexOf('!rrAddAllowed(tab)) return;'), l = b.indexOf('loadAllErasMode()'); return i > 0 && a > 0 && l > 0 && a < l; })());
  T('G10 backstops: saveWizardItem and the Upgrade picker ask it too', /async function saveWizardItem\(\) \{[\s\S]{0,900}!rrAddAllowed\(wizard\.tab\)\) return;/.test(ws) && /function pickItemForUpgrade\(\) \{\s*\n\s*if \(typeof rrAddAllowed === 'function' && !rrAddAllowed\('want'\)\) return;/.test(ap));
}
function addDoorFirst(wz) {
  const i = wz.indexOf('function renderWizardStep() {');
  const body = stripComments(wz.slice(i, i + 900));
  // the ring hook stays first (user_fields_parity pins it); the door is next —
  // before anything on the step is touched.
  const ask = body.indexOf('!rrAddAllowed(wizard.tab)'), first = body.indexOf('_wizFieldFocusClose');
  return i > 0 && ask > 0 && first > 0 && ask < first;
}

// ── the stand-in world: Drive (folders, files, the list file) + Sheets ────
async function boot(browser, opts) {
  opts = opts || {};
  const pg = await browser.newPage({ viewport: opts.phone ? { width: 390, height: 800 } : { width: 1300, height: 900 }, hasTouch: !!opts.phone });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(); if (!u.startsWith('file://')) return r.abort(); return r.continue(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate((o) => {
    window.accessToken = 'tok'; accessToken = 'tok';
    window.showToast = function (m) { (window.__toasts = window.__toasts || []).push(String(m)); };
    state.user = { name: 'Biz', email: 'shop@example.test' };
    window._subState = { sub: true, features: o.off ? [] : ['collections'] };
    const F = PERSONAL_FIELD_INDEX, N = PERSONAL_SCHEMA.length;
    const item = (num, inv) => { const r = new Array(N).fill(''); r[F.itemNum] = num; r[F.manufacturer] = 'Lionel'; r[F.inventoryId] = String(inv); return r; };
    window.__S = { HOME: { 'My Collection': [item('2343', 44)], 'Sold': [], 'For Sale': [], 'Want-Upgrade List': [], 'Contacts': [['C-1', 'Dave Hale', 'Hale Trains', '555-0101', 'dave@example.test', '', '', '', '', '', '12 Main St']] } };
    window.__files = {};       // id -> {name, parents, appProperties, content, mime}
    window.__calls = [];
    window.__sheetCreateFails = 0;
    let n = 0; const nid = p => p + (++n);
    const add = f => { window.__files[f.id] = f; return f; };
    add({ id: 'VAULT', name: 'The Rail Roster', parents: ['root'], mime: 'folder' });
    add({ id: 'HOME-ROOT', name: 'My Collection Photos', parents: ['VAULT'], mime: 'folder' });
    add({ id: 'HOME', name: 'The Rail Roster – Biz', parents: ['VAULT'], mime: 'sheet' });
    const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    const bad = (s, b) => ({ ok: false, status: s, json: async () => b, text: async () => JSON.stringify(b) });
    window.fetch = async function (url, opts) {
      const u = decodeURIComponent(String(url)); const method = (opts && opts.method) || 'GET';
      if (u.includes('googleapis.com/upload/drive/v3/files')) {
        const m = /files\/([^?]+)\?uploadType=media/.exec(u);
        if (m && method === 'PATCH') {
          const f = window.__files[m[1]]; if (!f) return bad(404, {});
          let body = opts.body; if (body && typeof body.text === 'function') body = await body.text();
          if (window.__beforeListWrite) { const hook = window.__beforeListWrite; window.__beforeListWrite = null; hook(); }
          f.content = String(body); window.__calls.push({ kind: 'listWrite' });
          if (window.__afterListWrite) { const hook2 = window.__afterListWrite; window.__afterListWrite = null; hook2(f); }
          return ok({ id: f.id });
        }
        if (/uploadType=multipart/.test(u) && method === 'POST') {
          const meta = JSON.parse(await opts.body.get('metadata').text());
          const content = await opts.body.get('file').text();
          const f = add({ id: nid('FILE'), name: meta.name, parents: meta.parents || [], content, mime: 'json' });
          window.__calls.push({ kind: 'listCreate' });
          return ok({ id: f.id });
        }
        return ok({});
      }
      if (u.includes('googleapis.com/drive/v3/files')) {
        const fm = /\/files\/([^?/]+)(\?|$)/.exec(u);
        if (method === 'GET' && /files\?q=/.test(u)) {
          const nm = (/name='([^']+)'/.exec(u) || [])[1];
          const parents = [...u.matchAll(/'([^']+)' in parents/g)].map(m => m[1]);
          const hits = Object.values(window.__files).filter(f => !f.trashed && (!nm || f.name === nm) && (!parents.length || (f.parents || []).some(p => parents.includes(p))));
          window.__calls.push({ kind: 'driveFind', name: nm });
          return ok({ files: hits.map(f => ({ id: f.id, name: f.name, parents: f.parents })) });
        }
        if (method === 'GET' && fm && /alt=media/.test(u)) {
          const f = window.__files[fm[1]]; window.__calls.push({ kind: 'listRead' });
          return f ? ok(JSON.parse(f.content || '{}')) : bad(404, {});
        }
        if (method === 'GET' && fm) { const f = window.__files[fm[1]]; return ok(f ? { id: f.id, parents: f.parents, trashed: false } : { id: fm[1], trashed: false }); }
        if (method === 'POST' && /\/files(\?|$)/.test(u)) {
          const b = JSON.parse(opts.body || '{}');
          const f = add({ id: nid('FOLDER'), name: b.name, parents: b.parents || [], mime: b.mimeType && /folder/.test(b.mimeType) ? 'folder' : 'file' });
          window.__calls.push({ kind: 'folderMade', name: b.name, parent: (b.parents || [])[0] });
          return ok({ id: f.id });
        }
        if (method === 'PATCH' && fm) {
          const f = window.__files[fm[1]] || add({ id: fm[1], name: '', parents: [] });
          const b = opts.body ? JSON.parse(opts.body) : {};
          if (b.name) f.name = b.name;
          if (b.appProperties) f.appProperties = Object.assign({}, f.appProperties || {}, b.appProperties);
          const ap = /addParents=([^&]+)/.exec(u), rp = /removeParents=([^&]+)/.exec(u);
          if (ap) { f.parents = (f.parents || []).filter(p => !(rp && rp[1].split(',').includes(p))).concat([ap[1]]); }
          window.__calls.push({ kind: 'drivePatch', id: f.id, name: b.name, move: ap ? ap[1] : '' });
          return ok({ id: f.id });
        }
        return ok({});
      }
      // Sheets
      if (/sheets\.googleapis\.com\/v4\/spreadsheets$/.test(u) && method === 'POST') {
        if (window.__sheetCreateFails > 0) { window.__sheetCreateFails--; return bad(503, { error: { message: 'busy' } }); }
        const b = JSON.parse(opts.body);
        const f = add({ id: nid('SHEET'), name: b.properties.title, parents: ['root'], mime: 'sheet' });
        window.__S[f.id] = { 'My Collection': [] };
        window.__calls.push({ kind: 'sheetMade', title: b.properties.title });
        return ok({ spreadsheetId: f.id });
      }
      const sm = /spreadsheets\/([^/?:]+)/.exec(u); const sid = sm ? sm[1] : '';
      if (/\?fields=sheets\.properties/.test(u)) return ok({ sheets: Object.keys(window.__S[sid] || {}).map(t => ({ properties: { title: t } })) });
      if (/:batchUpdate/.test(u) && method === 'POST') {
        const b = JSON.parse(opts.body || '{}');
        (b.requests || []).forEach(r => { if (r.addSheet) { window.__S[sid] = window.__S[sid] || {}; window.__S[sid][r.addSheet.properties.title] = []; } });
        return ok({ replies: [] });
      }
      if (/values:batchGet/.test(u)) { const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => m[1]); return ok({ valueRanges: ranges.map(r => ({ range: r, values: [] })) }); }
      const vm = /\/values\/([^?:]+)/.exec(u);
      if (vm && method === 'GET') {
        if (window.__initFails > 0 && /^My Collection!A1$/.test(vm[1]) && sid !== 'HOME') { window.__initFails--; throw new TypeError('Failed to fetch'); }
        const tab = vm[1].split('!')[0].replace(/^'|'$/g, '');
        const t = (window.__S[sid] || {})[tab];
        if (!t) return ok({ error: { message: 'Unable to parse range: ' + vm[1] } });
        return ok({ range: vm[1], values: tab === 'Contacts' ? t : t.slice() });
      }
      return ok({ updatedCells: 1, updates: { updatedRange: 'My Collection!A3:B3' } });
    };
    driveCache.vaultId = 'VAULT'; driveCache.photosId = 'HOME-ROOT'; driveCache.soldPhotosId = 'HOME-SOLD'; driveCache._validated = true;
    rrSetHomeSheet('HOME', 'test'); localStorage.setItem('lv_personal_id', 'HOME');
    state.contactsData = [{ id: 'C-1', name: 'Dave Hale', business: 'Hale Trains', phone: '555-0101', email: 'dave@example.test', address: '12 Main St' }];
    window._offlineMode = false;
  }, opts);
  return { pg, errs };
}

async function offRun(browser) {
  console.log('\n== F · switched off (a regular customer) ==');
  const { pg, errs } = await boot(browser, { off: true });
  const r = await pg.evaluate(async () => {
    const before = window.__calls.length;
    await rrCollectionsBoot();
    return { slot: (document.getElementById('rr-coll-slot') || {}).innerHTML, reads: window.__calls.slice(before).filter(c => c.kind === 'listRead' || c.kind === 'driveFind').length,
      header: !!document.getElementById('rr-coll-header'), adding: rrAddingToHtml(), on: rrCollUiOn() };
  });
  T('F0 no script error', errs.length === 0, errs);
  T('F1 no button beside the logo, no header, nothing read from Drive', r.on === false && r.slot === '' && !r.header && r.reads === 0, r);
  T('F2 the Add screen says nothing extra at home', r.adding === '', r);
  await pg.close();
}

async function mainRun(browser) {
  console.log('\n== C · + New collection ==');
  const { pg, errs } = await boot(browser);
  const c = await pg.evaluate(async () => {
    await rrCollectionsBoot();
    const out = { btn0: (document.getElementById('rr-coll-btn') || {}).textContent };
    rrCollMenuOpen();
    out.menu = (document.getElementById('rr-coll-list') || {}).textContent || '';
    rrCollNewOpen();
    document.getElementById('rr-coll-new-name').value = 'Hale';
    document.querySelector('input[name="rr-coll-start"][value="auction"]').checked = true;
    document.getElementById('rr-coll-new-client').value = 'C-1';
    document.getElementById('rr-coll-new-notes').value = 'Spring auction';
    const go = document.getElementById('rr-coll-new-go');
    const p1 = rrCollNewGo(go); const p2 = rrCollNewGo(go);   // a double tap
    await p1; await p2; await new Promise(r => setTimeout(r, 2500));
    const listFile = Object.values(window.__files).find(f => f.name === 'rail-roster-collections.json');
    const list = JSON.parse(listFile.content);
    const e = Object.values(list.items)[0];
    const folder = window.__files[e.folderId], sheet = window.__files[e.sheetId];
    const collFolder = Object.values(window.__files).find(f => f.name === 'Collections');
    Object.assign(out, {
      count: Object.keys(list.items).length, num: e.number, status: e.status, lists: e.lists, clientId: e.clientId, notes: e.notes,
      listParent: listFile.parents, collParent: collFolder && collFolder.parents, folderName: folder && folder.name, folderParent: folder && folder.parents,
      photos: window.__files[e.photoRootId] && [window.__files[e.photoRootId].name, window.__files[e.photoRootId].parents[0] === e.folderId],
      sold: window.__files[e.soldPhotoRootId] && [window.__files[e.soldPhotoRootId].name, window.__files[e.soldPhotoRootId].parents[0] === e.folderId],
      sheetName: sheet && sheet.name, sheetParents: sheet && sheet.parents, sheetProps: sheet && sheet.appProperties, folderProps: folder && folder.appProperties,
      tabs: Object.keys(window.__S[e.sheetId] || {}), sheetsMade: window.__calls.filter(x => x.kind === 'sheetMade').length,
      live: state.personalSheetId, sheetId: e.sheetId, btn: (document.getElementById('rr-coll-btn') || {}).textContent,
      key: e.key, remembered: localStorage.getItem('lv_current_collection'),
    });
    return out;
  });
  T('C0 no script error', errs.length === 0, errs);
  T('C1 the button beside the logo says My Collection; the drop-down lists All Collections (later), My Collection, + New collection', /My Collection/.test(c.btn0) && /All Collections/.test(c.menu) && /\+ New collection/.test(c.menu), c);
  T('C2 a double tap makes ONE collection, number 1, Active, started as Auction (For Sale + Sold on, Want + Parts off), client + notes kept', c.count === 1 && c.num === 1 && c.status === 'active' && c.lists.forSale === true && c.lists.sold === true && c.lists.want === false && c.lists.parts === false && c.clientId === 'C-1' && c.notes === 'Spring auction' && c.sheetsMade === 1, c);
  T('C3 the list file sits in The Rail Roster folder; Collections inside it; "1 – Hale" inside Collections with Photos + Sold Photos', JSON.stringify(c.listParent) === '["VAULT"]' && JSON.stringify(c.collParent) === '["VAULT"]' && c.folderName === '1 – Hale' && c.photos && c.photos[0] === 'Photos' && c.photos[1] && c.sold && c.sold[0] === 'Sold Photos' && c.sold[1], c);
  T('C4 its own sheet "The Rail Roster – 1 Hale", moved into its folder, every list tab made', c.sheetName === 'The Rail Roster – 1 Hale' && JSON.stringify(c.sheetParents) === JSON.stringify([c.folderParent && c.sheetParents && c.sheetParents[0]]) && ['Sold', 'For Sale', 'Want-Upgrade List'].every(t => c.tabs.includes(t)), c);
  T('C4b …the sheet\'s parent IS the collection folder', c.sheetParents && c.sheetParents.length === 1 && c.sheetParents[0] !== 'root', c);
  T('C5 the sheet and the folder carry the collection\'s key + number inside themselves', c.sheetProps && c.sheetProps.rrCollectionNumber === '1' && c.sheetProps.rrCollectionKey === c.key && c.folderProps && c.folderProps.rrCollectionNumber === '1', c);
  T('C6 it opens at once: the app is on its sheet, the button says "1 – Hale", the device remembers it', c.live === c.sheetId && /1 – Hale/.test(c.btn) && c.remembered === c.key, c);

  // H · the client header
  console.log('\n== H · the client header + the details card ==');
  const h = await pg.evaluate(() => {
    const el = document.getElementById('rr-coll-header');
    const links = el ? [...el.querySelectorAll('a')].map(a => a.getAttribute('href')) : [];
    return { text: el ? el.textContent : '', links, first: el && el.parentNode && el.parentNode.firstChild === el };
  });
  T('H1 the client header: "1 – Hale", the client\'s name, Call (tel:) and Email (mailto:), the notes', /1 – Hale/.test(h.text) && /Dave Hale/.test(h.text) && h.links.includes('tel:5550101') && h.links.includes('mailto:dave@example.test') && /Spring auction/.test(h.text) && /12 Main St/.test(h.text), h);

  // L · the list switches (auction: Want + Parts off)
  console.log('\n== L · the list switches ==');
  const l = await pg.evaluate(() => {
    const vis = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
    const out = {
      want: vis(".sidebar [onclick*=\"showPage('upgrade'\"]"), parts: vis(".sidebar [onclick*=\"showPage('parts'\"]"),
      sale: vis(".sidebar [onclick*=\"showPage('forsale'\"]"), sold: vis(".sidebar [onclick*=\"showPage('sold'\"]"),
    };
    // the Add buttons too (dashboard row, phone grid, the Add menu)
    out.addWant = [...document.querySelectorAll("[onclick*=\"startWizardFor('want'\"], [onclick*=\"pickItemForUpgrade(\"]")].filter(e => getComputedStyle(e).display !== 'none').length;
    out.addWantAll = document.querySelectorAll("[onclick*=\"startWizardFor('want'\"]").length;
    out.addSale = [...document.querySelectorAll("[onclick*=\"startWizardFor('forsale'\"]")].filter(e => getComputedStyle(e).display !== 'none').length;
    window.__toasts = [];
    showPage('parts', null);
    out.page = window._rrLastPage; out.toast = window.__toasts.slice(-1)[0] || '';
    return out;
  });
  const lw = await pg.evaluate(async () => {
    window.__toasts = [];
    await openWizard('want'); await new Promise(r => setTimeout(r, 200));
    const m = document.getElementById('wizard-modal');
    const wantOpen = !!(m && m.classList.contains('open'));
    const wantToast = window.__toasts.slice(-1)[0] || '';
    await openWizard('collection'); await new Promise(r => setTimeout(r, 200));
    const m2 = document.getElementById('wizard-modal');
    const collOpen = !!(m2 && m2.classList.contains('open'));
    try { _doCloseWizard(); } catch (e) {}
    try { document.activeElement.blur(); } catch (e) {}   // a typing box counts as busy (the switch waits)
    window.__toasts = [];
    pickItemForUpgrade();
    return { wantOpen, wantToast, collOpen, upg: !!document.getElementById('upgrade-pick-modal'), upgToast: window.__toasts.slice(-1)[0] || '' };
  });
  T('L1 Want + Parts hidden from the menu; For Sale + Sold shown', !l.want && !l.parts && l.sale && l.sold, l);
  T('L2 asking for Parts anyway (any door) opens My Collection and says why', l.page === 'browse' && /Parts Needed is switched off/.test(l.toast), l);
  T('L4 the "Add to Want List" / "Add Upgrade" buttons are hidden too; "Add to For Sale List" shows', l.addWantAll >= 2 && l.addWant === 0 && l.addSale >= 1, l);
  const bz = await pg.evaluate(() => {
    const im = document.getElementById('identify-modal');
    const hiddenBusy = _rrBusyNow();
    let openBusy = null;
    if (im) { im.classList.add('open'); openBusy = _rrBusyNow(); im.classList.remove('open'); }
    return { built: !!im, hiddenBusy, openBusy };
  });
  T('L6 after an Add screen has opened once, its hidden photo-identify screen no longer counts as "busy" (switching + updates were held all session); OPEN it still does', bz.built && bz.hiddenBusy === false && bz.openBusy === true, bz);
  T('L5 ADDING to a list that is off (any door) never opens the Add screen and says why; My Collection still opens', !lw.wantOpen && /Want \/ Upgrade is switched off in this collection\.$/.test(lw.wantToast) && lw.collOpen && !lw.upg && /switched off/.test(lw.upgToast), lw);

  // D · details: rename, lists, your own fields
  const d = await pg.evaluate(async (key) => {
    rrCollDetailsOpen(key);
    document.getElementById('rr-coll-d-name').value = 'Smith';
    document.querySelector('[data-coll-list="parts"]').checked = true;
    rrCollFieldAdd();
    document.querySelector('#rr-coll-d-fields [data-fname="0"]').value = 'Commission';
    rrCollFieldType(0, 'percent');
    document.querySelector('#rr-coll-d-fields [data-fval]').value = '10';
    await rrCollDetailsSave(key, document.getElementById('rr-coll-d-save'));
    await new Promise(r => setTimeout(r, 300));
    const c2 = rrCollectionByKey(key);
    const fieldsPref = JSON.parse(localStorage.getItem('lv_coll_fields') || '[]');
    const renames = window.__calls.filter(x => x.kind === 'drivePatch' && x.name).map(x => x.name);
    const head = (document.getElementById('rr-coll-header') || {}).textContent || '';
    const partsShown = getComputedStyle(document.querySelector(".sidebar [onclick*=\"showPage('parts'\"]")).display !== 'none';
    return { name: c2.name, lists: c2.lists, fieldsPref, vals: c2.fields, renames, head, partsShown, stamped: !!localStorage.getItem('lv_coll_fields__at') };
  }, c.key);
  T('D1 a rename renames the folder ("1 – Smith") and the sheet ("The Rail Roster – 1 Smith"); the number never changes', d.name === 'Smith' && d.renames.includes('1 – Smith') && d.renames.includes('The Rail Roster – 1 Smith'), d);
  T('D2 a list switched back on shows again', d.lists.parts === true && d.partsShown, d);
  T('D3 your own field: named once (an ACCOUNT setting), filled per collection, shown in the header as 10%', d.fieldsPref.length === 1 && d.fieldsPref[0].name === 'Commission' && d.fieldsPref[0].type === 'percent' && d.stamped && d.vals[d.fieldsPref[0].id] === '10' && /Commission: 10%/.test(d.head), d);

  // A · the Add screen
  const a = await pg.evaluate(() => {
    let host = document.getElementById('wizard-adding-banner');
    if (!host) { host = document.createElement('div'); host.id = 'wizard-adding-banner'; document.body.appendChild(host); }
    try { wizard.data = {}; wizard.tab = 'collection'; } catch (e) {}
    _renderAddingBanner();
    return (document.getElementById('wizard-coll-banner') || {}).textContent || '';
  });
  T('A1 the Add screen says "Adding to 1 – Smith"', a === 'Adding to 1 – Smith', a);

  // S · the shareable For Sale sheet is this collection's, named by number only
  const s = await pg.evaluate(() => ({ key: _sellSheetKey(), name: _sellSheetName() }));
  T('S1 the shareable For Sale sheet: its own id per collection and a name with the NUMBER only (no client name)', /^rr_sell_sheet_id@c/.test(s.key) && /collection 1$/.test(s.name) && !/Smith|Hale/.test(s.name), s);

  // B · at start: the collection this device had open
  const b = await pg.evaluate(async (key) => {
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    localStorage.setItem('lv_current_collection', key);
    _rrCollectionsReset(); _rrCollUiReset();
    rrSetHomeSheet('HOME', 'test');
    await rrCollectionsBoot();
    await new Promise(r => setTimeout(r, 500));
    return { live: state.personalSheetId, cur: rrCurrentCollection().key, btn: (document.getElementById('rr-coll-btn') || {}).textContent };
  }, c.key);
  T('B1 at start the device opens the collection it last had open', b.cur === c.key && b.live === c.sheetId && /1 – Smith/.test(b.btn), b);

  // home again: every list, no header
  const hm = await pg.evaluate(async () => {
    await rrCollChoose('home'); await new Promise(r => setTimeout(r, 300));
    const vis = sel => getComputedStyle(document.querySelector(sel)).display !== 'none';
    return { header: !!document.getElementById('rr-coll-header'), want: vis(".sidebar [onclick*=\"showPage('upgrade'\"]"), live: state.personalSheetId, adding: rrAddingToHtml() };
  });
  T('L3 back home: every list shows, no client header, the Add screen says nothing extra', !hm.header && hm.want && hm.live === 'HOME' && hm.adding === '', hm);
  await pg.close();
}

async function twoDevices(browser) {
  console.log('\n== C · two devices at once, a failure part way ==');
  const { pg, errs } = await boot(browser);
  const r = await pg.evaluate(async () => {
    await rrCollectionsBoot();
    // the list file exists already (an earlier write)
    await rrCollectionsFileUpdate(function (d) { d.next = 1; });
    // the moment OUR reserve lands, another device's reserve of the SAME number
    // (made a moment earlier — an earlier createdAt) lands too
    window.__afterListWrite = function (f) {
      const d = JSON.parse(f.content);
      const mine = Object.values(d.items).find(e => e.name === 'Hale');
      d.items.cOTHER = { key: 'cOTHER', number: mine ? mine.number : 1, name: 'Jones', status: 'creating', createdAt: 1, at: 1, lists: {} };
      f.content = JSON.stringify(d);
    };
    window.__initFails = 1;   // the sheet IS made, but setting up its tabs fails the first time
    const first = await rrCreateCollection({ name: 'Hale', startId: 'client' });
    const list1 = JSON.parse(Object.values(window.__files).find(x => x.name === 'rail-roster-collections.json').content);
    const mine1 = Object.values(list1.items).find(e => e.name === 'Hale');
    const fin = await rrFinishCollection(first.key);
    const list2 = JSON.parse(Object.values(window.__files).find(x => x.name === 'rail-roster-collections.json').content);
    const mine2 = list2.items[first.key];
    const folders = Object.values(window.__files).filter(f => /– Hale$/.test(f.name));
    return { first, fin: fin.ok, num1: mine1 && mine1.number, status1: mine1 && mine1.status, hadFolder: !!(mine1 && mine1.folderId), hadSheet: !!(mine1 && mine1.sheetId), num2: mine2.number, status2: mine2.status,
      folders: folders.length, sheets: window.__calls.filter(x => x.kind === 'sheetMade').length, lists: mine2.lists, other: list2.items.cOTHER && list2.items.cOTHER.number };
  });
  T('X0 no script error', errs.length === 0, errs);
  T('X1 another device took number 1 first → ours is 2 (exactly one of the two moved)', r.other === 1 && r.num1 === 2 && r.num2 === 2, r);
  T('X2 its tabs could not be set up → the collection is kept "not finished", its folder AND sheet already saved, the person told how to finish', r.first.ok === false && r.status1 === 'creating' && r.hadFolder && r.hadSheet && /Finish setting up/.test(r.first.msg), r);
  T('X3 Finish setting up completes it — ONE folder, ONE sheet, never made twice', r.fin && r.status2 === 'active' && r.folders === 1 && r.sheets === 1, r);
  T('X4 started as Client collection: every list off', ['want', 'parts', 'forSale', 'sold'].every(k => r.lists[k] === false), r.lists);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await offRun(browser);
    await mainRun(browser);
    await twoDevices(browser);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
