#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LOOK SYNC — v0.9.1867   (real Chromium, the REAL app, no stubs but Drive)
//
// Brad, 2026-10-02, after his gold became orange on the desktop: would it reach
// the phone? It would not. look-sync.js (v1230) checked `window.driveCache`
// for readiness; driveCache is a `const` in drive.js and never lands on window
// — so from the day it shipped it never pushed and never pulled, no look file
// was ever written, and every "it travels by look-sync" claim since (colours,
// custom columns v1585, switches v1814, layouts v1862/v1864) was false. No
// test had ever run a push: this suite does, against the REAL driveCache by
// its bare name, with Drive's two calls stubbed and everything else real.
//
// THE DESIGN he said "yes, that way" to: the small look settings (colours,
// theme, saved looks, custom column names + switches, column layouts, the
// auto-offer roster) are ACCOUNT settings — written through _prefSet, read
// through _prefGet, carried by the account prefs file newest-PER-SETTING, so
// re-ordering a column on the phone can never drag the desktop's colours back.
// The look file keeps only the big pictures (brand marks, logo cards), with
// the readiness check fixed, every change sent, and the newest device's copy
// on Drive.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  look_sync_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

async function open(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    localStorage.clear();
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t) => ({ itemNum: n, variation: v, itemType: t, _era: 'pw', _tab: PW, yearProd: '1950', description: t + ' ' + n, roadName: '' });
    state.masterData = [mk('6457', '3', 'Caboose'), mk('6464', '1', 'Boxcar')];
    _rebuildMasterIndex();
    state.personalData = {
      a: { owned: true, itemNum: '6457', variation: '3', era: 'pw', manufacturer: 'Lionel', inventoryId: '1', row: 2, custom2: 'Dad' },
      b: { owned: true, itemNum: '6464', variation: '1', era: 'pw', manufacturer: 'Lionel', inventoryId: '2', row: 3 },
    };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

// Drive, stubbed at its two doors: driveRequest (a function declaration, so
// assigning window.driveRequest rebinds the bare name every caller uses) and
// fetch (the uploads). Everything else — the real look-sync, the real
// driveCache const, the real localStorage — is the real thing.
const STUB = (findJs, downloadJs, uploadTime) => `
  window.__calls = [];
  driveCache.vaultId = 'vault1';
  localStorage.setItem('lv_token', 'test-token');
  window.driveRequest = async function (m, p) {
    window.__calls.push({ m, p });
    if (/\\/files\\?q=/.test(p)) return ${findJs};
    if (/alt=media/.test(p)) return ${downloadJs};
    return {};
  };
  window.fetch = async function (url, init) {
    const body = init && init.body; let text = '';
    if (body && typeof body.text === 'function') text = await body.text();
    else if (body && typeof body.get === 'function') { const f = body.get('file'); text = f ? await f.text() : ''; }
    window.__calls.push({ url: String(url), method: init && init.method, body: text });
    return { ok: true, json: async () => ({ id: 'f1', modifiedTime: '${uploadTime || '2026-10-02T20:00:00.000Z'}' }) };
  };
  var uploads = function () { return window.__calls.filter(function (c) { return c.url && /googleapis\\.com\\/upload\\/drive/.test(c.url); }); };   // Drive uploads only (the vault heartbeat posts too)
  var finds = function () { return window.__calls.filter(function (c) { return c.p && /\\/files\\?q=/.test(c.p); }); };
  var downloads = function () { return window.__calls.filter(function (c) { return c.p && /alt=media/.test(c.p); }); };
`;

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: ready for real, and a push writes the big pictures only ───────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async (STUB) => {
      const out = {};
      out.beforeVault = await rrLookPush({ loud: false });                      // no vault yet → honestly not ready
      eval(STUB);
      out.onWindow = typeof window.driveCache;                                   // still undefined — the const never lands there
      localStorage.setItem('rr_skin_brand', JSON.stringify({ watermark: null, sidebar: null, header: null, title: { text: 'The Short Line' } }));
      localStorage.setItem('rr_logo_cards', '[]');
      localStorage.setItem('lv_skin_custom', '{"--accent":"#db5407"}');         // an ACCOUNT setting now — must not ride the look file
      localStorage.setItem('lv_coll_columns_v1', '["type"]');
      rrLookTouch();
      out.res = await rrLookPush({ loud: false });
      const up = uploads();
      out.upload = { n: up.length, method: up[0] && up[0].method, multipart: /uploadType=multipart/.test(up[0] && up[0].url), keys: Object.keys(JSON.parse(up[0].body).keys).sort(), stamp: JSON.parse(up[0].body).stamp };
      out.synced = JSON.parse(localStorage.getItem('rr_look_synced'));
      out.stamp = localStorage.getItem('rr_look_stamp');
      out.lookKeys = RR_LOOK_KEYS.slice();
      return out;
    }, STUB('{ files: [] }', 'null'));
    T('A: no page errors', errs.join(' | '), '');
    T('A: with no vault id, a push says so', r.beforeVault, { ok: false, why: 'drive' });
    T('A: driveCache is a const — never on window; the bare name is what works', r.onWindow, 'undefined');
    T('A: with the REAL driveCache\'s vault id set, a push WRITES the look file (one multipart create — the v1230 bug is gone)', [r.res, r.upload.n, r.upload.method, r.upload.multipart], [{ ok: true }, 1, 'POST', true]);
    T('A: the file carries the big pictures only — never the colours or a layout (those follow the account)', r.upload.keys, ['rr_logo_cards', 'rr_skin_brand']);
    T('A: the file is dated with this device\'s stamp, and the device remembers the file it wrote', [String(r.upload.stamp) === r.stamp, r.synced.fileId, r.synced.modifiedTime, String(r.synced.localStamp) === r.stamp], [true, 'f1', '2026-10-02T20:00:00.000Z', true]);
    T('A: LOOK_KEYS is exactly the two big pictures', r.lookKeys, ['rr_skin_brand', 'rr_logo_cards']);
    await pg.close();
  }

  // ── PLANTED A: the readiness check as it was from v1230 to v1866 ──────────
  {
    const src = rd('look-sync.js');
    const anchor = "           typeof driveCache !== 'undefined' &&\n           !!(driveCache && driveCache.vaultId);";
    T('PLANTED A: the readiness check reads the bare driveCache, once', src.split(anchor).length - 1, 1);
    const old = src.replace(anchor, "           typeof window.driveCache !== 'undefined' &&\n           !!(window.driveCache && window.driveCache.vaultId);");
    const { pg } = await open(browser, { 'look-sync.js': old });
    const r = await pg.evaluate(async (STUB) => { eval(STUB); localStorage.setItem('rr_skin_brand', '{"title":{"text":"x"}}'); rrLookTouch(); return await rrLookPush({ loud: false }); }, STUB('{ files: [] }', 'null'));
    T('PLANTED A: the old check never becomes ready — nothing is ever sent (the bug, reproduced)', r, { ok: false, why: 'drive' });
    await pg.close();
  }

  // ── B: pull — newer wins, older is sent back, no file is seeded ───────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async (STUB) => {
      const out = {};
      eval(STUB);
      // B1: the file is newer than this device, and (as an old file might) carries a key that left this file
      const remoteNewer = { v: 1, stamp: 5000, keys: { rr_skin_brand: '{"title":{"text":"From the phone"}}', lv_skin_custom: '{"--accent":"#f2b428"}' } };
      window.driveRequest = async function (m, p) { window.__calls.push({ m, p }); if (/\/files\?q=/.test(p)) return { files: [{ id: 'f1', modifiedTime: 'T1' }] }; if (/alt=media/.test(p)) return remoteNewer; return {}; };
      localStorage.setItem('rr_look_stamp', '1000');
      localStorage.setItem('lv_skin_custom', '{"--accent":"#db5407"}');
      out.b1 = Object.assign(await rrLookPull({ loud: false }), { brand: localStorage.getItem('rr_skin_brand'), skin: localStorage.getItem('lv_skin_custom'), stamp: localStorage.getItem('rr_look_stamp'), synced: JSON.parse(localStorage.getItem('rr_look_synced')), toast: (document.getElementById('toast') || {}).textContent || '' });
      // B5: nothing changed since — one field read, no download
      window.__calls = [];
      out.b5 = Object.assign(await rrLookPull({ loud: false }), { downloads: downloads().length, finds: finds().length });
      // B2: this device is newer than the file → it is SENT, not overwritten
      window.__calls = [];
      window.driveRequest = async function (m, p) { window.__calls.push({ m, p }); if (/\/files\?q=/.test(p)) return { files: [{ id: 'f1', modifiedTime: 'T2' }] }; if (/alt=media/.test(p)) return { v: 1, stamp: 2000, keys: { rr_skin_brand: '{"title":{"text":"older"}}' } }; return {}; };
      localStorage.setItem('rr_skin_brand', '{"title":{"text":"mine, newer"}}');
      localStorage.setItem('rr_look_stamp', '9000');
      out.b2 = Object.assign(await rrLookPull({ loud: false }), { brandKept: localStorage.getItem('rr_skin_brand'), sentBody: (uploads()[0] || {}).body, sentMethod: (uploads()[0] || {}).method });
      // B3: no file on Drive, this device wears something → seeded
      window.__calls = [];
      localStorage.removeItem('rr_look_synced');
      window.driveRequest = async function (m, p) { window.__calls.push({ m, p }); if (/\/files\?q=/.test(p)) return { files: [] }; return {}; };
      out.b3 = Object.assign(await rrLookPull({ loud: false }), { created: uploads().length, multipart: /multipart/.test((uploads()[0] || {}).url || '') });
      // B4: no file, nothing to seed
      window.__calls = [];
      localStorage.removeItem('rr_look_synced'); localStorage.removeItem('rr_look_stamp'); localStorage.removeItem('rr_skin_brand'); localStorage.removeItem('rr_logo_cards');
      out.b4 = Object.assign(await rrLookPull({ loud: false }), { uploads: uploads().length });
      return out;
    }, STUB('{ files: [] }', 'null'));
    T('B: no page errors', errs.join(' | '), '');
    T('B1: a newer file lands — the brand is applied and dated, a key that left this file is IGNORED, the device remembers the file, and it says so',
      [r.b1.ok, r.b1.changed, r.b1.brand, r.b1.skin, r.b1.stamp, r.b1.synced.modifiedTime, r.b1.toast],
      [true, true, '{"title":{"text":"From the phone"}}', '{"--accent":"#db5407"}', '5000', 'T1', 'Your look has been brought over from your other device']);
    T('B5: unchanged since last time — one field read, no download', [r.b5.ok, r.b5.changed, r.b5.finds, r.b5.downloads], [true, false, 1, 0]);
    T('B2: this device\'s look is newer than the file → kept here AND sent to Drive (the file is the newest device\'s)',
      [r.b2.why, r.b2.pushed, r.b2.brandKept, r.b2.sentMethod, JSON.parse(r.b2.sentBody).keys.rr_skin_brand, JSON.parse(r.b2.sentBody).stamp],
      ['mine-is-newer', true, '{"title":{"text":"mine, newer"}}', 'PATCH', '{"title":{"text":"mine, newer"}}', 9000]);
    T('B3: no file on Drive yet and this device wears a look → the file is created from it', [r.b3.why, r.b3.ok, r.b3.created, r.b3.multipart], ['seeded', true, 1, true]);
    T('B4: no file and nothing to seed → nothing sent', [r.b4.why, r.b4.uploads], ['none', 0]);
    await pg.close();
  }

  // ── C: a change is SENT, not just dated ───────────────────────────────────
  // (The real start-up poller is running underneath — _buildAppShell calls
  // rrLookCheckLater at load — so the file on "Drive" is set up as already
  // seen: the poller then reads one field and does nothing.)
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async (STUB) => {
      eval(STUB);
      localStorage.setItem('rr_look_synced', JSON.stringify({ fileId: 'f1', modifiedTime: 'T0', localStamp: 1 }));
      localStorage.setItem('rr_skin_brand', '{"title":{"text":"x"}}');
      rrLookTouch();                                            // what every brand / logo-cards writer calls
      const atOnce = uploads().length;
      await new Promise(res => setTimeout(res, 2200));
      return { atOnce, later: uploads().length, method: (uploads()[0] || {}).method, synced: JSON.parse(localStorage.getItem('rr_look_synced')).localStamp === parseInt(localStorage.getItem('rr_look_stamp'), 10) };
    }, STUB("{ files: [{ id: 'f1', modifiedTime: 'T0' }] }", 'null', 'T0'));
    T('C: no page errors', errs.join(' | '), '');
    T('C: rrLookTouch() alone leads to a push (debounced) — no Appearance → Apply needed', r, { atOnce: 0, later: 1, method: 'PATCH', synced: true });
    await pg.close();
  }
  // ── PLANTED C: a touch that only dates the look ───────────────────────────
  {
    const src = rd('look-sync.js');
    const anchor = "    _touchTimer = setTimeout(function () { _touchTimer = null; rrLookPush({ loud: false }); }, 1500);\n";
    T('PLANTED C: the touch schedules the push, once', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'look-sync.js': src.replace(anchor, '') });
    const r = await pg.evaluate(async (STUB) => { eval(STUB); localStorage.setItem('rr_look_synced', JSON.stringify({ fileId: 'f1', modifiedTime: 'T0', localStamp: 1 })); localStorage.setItem('rr_skin_brand', '{"title":{"text":"x"}}'); rrLookTouch(); await new Promise(res => setTimeout(res, 2200)); return uploads().length; }, STUB("{ files: [{ id: 'f1', modifiedTime: 'T0' }] }", 'null', 'T0'));
    T('PLANTED C: a touch that only stamps sends nothing (caught)', r, 0);
    await pg.close();
  }

  // ── D: the start-up check waits for Drive instead of giving up ────────────
  // The REAL poller, started by _buildAppShell at load: its first look is at
  // 4 s, then every 2 s for a minute. Drive is made ready only AFTER that
  // first look, which is exactly the case that used to lose the whole session.
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async (STUB) => {
      eval(STUB);
      driveCache.vaultId = null;                                // Drive not ready yet
      await new Promise(res => setTimeout(res, 4600));          // …past the first look
      const early = finds().length;
      driveCache.vaultId = 'vault1';                            // …now it is
      await new Promise(res => setTimeout(res, 2600));          // …within one retry
      return { early, later: finds().length };
    }, STUB('{ files: [] }', 'null'));
    T('D: no page errors', errs.join(' | '), '');
    T('D: not ready at the first look → no call; ready a moment later → the pull runs (it used to give up for the whole session)', [r.early, r.later >= 1], [0, true]);
    await pg.close();
  }
  // ── PLANTED D: the once-only check ────────────────────────────────────────
  {
    const src = rd('look-sync.js');
    const anchor = "      if (--left > 0) setTimeout(tick, again);\n";
    T('PLANTED D: the retry line is there once', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'look-sync.js': src.replace(anchor, '') });
    const r = await pg.evaluate(async (STUB) => { eval(STUB); driveCache.vaultId = null; await new Promise(res => setTimeout(res, 4600)); driveCache.vaultId = 'vault1'; await new Promise(res => setTimeout(res, 2600)); return finds().length; }, STUB('{ files: [] }', 'null'));
    T('PLANTED D: a check that gives up never pulls once Drive is ready (caught)', r, 0);
    await pg.close();
  }

  // ── E: the small settings follow the ACCOUNT — every real writer stamps ───
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async () => {
      const out = {};
      const at = k => localStorage.getItem(k + '__at');
      const stamped = k => !!at(k) && at(k) !== '0';
      // layouts
      rrTableSave('collection', ['type', 'desc']);
      out.layout = { v: localStorage.getItem('lv_coll_columns_v1'), stamped: stamped('lv_coll_columns_v1'), look: localStorage.getItem('rr_look_stamp') };
      rrTableReset('collection');
      out.reset = { v: localStorage.getItem('lv_coll_columns_v1'), stamped: stamped('lv_coll_columns_v1'), visible: rrTableVisible('collection').join(',') === rrTable('collection').defaults.join(',') };
      // switches and names, through their real doors
      _ufToggle('shipper', true, { quiet: true });
      out.shipper = { v: localStorage.getItem('lv_shipper_enabled'), stamped: stamped('lv_shipper_enabled') };
      _ufRename('custom1', 'Owner');
      out.rename = { label: localStorage.getItem('lv_label_custom1'), on: localStorage.getItem('lv_custom1_enabled'), stampedL: stamped('lv_label_custom1'), stampedE: stamped('lv_custom1_enabled'), shown: rrFieldLabel(RR_USER_FIELDS.filter(f => f.key === 'custom1')[0]) };
      _ufRename('custom1', '');
      out.unname = { label: localStorage.getItem('lv_label_custom1'), shown: rrFieldLabel(RR_USER_FIELDS.filter(f => f.key === 'custom1')[0]), stillOn: localStorage.getItem('lv_custom1_enabled') };
      out.claim = { ret: rrTagClaimCustom('custom3', 'Lot'), label: localStorage.getItem('lv_label_custom3'), on: localStorage.getItem('lv_custom3_enabled'), stamped: stamped('lv_label_custom3') && stamped('lv_custom3_enabled'), free: rrTagCustomIsFree('custom3') };
      out.imp = { ret: _impAutoEnableFields({ Items: { 'Bought at': 'custom4' } }), label: localStorage.getItem('lv_label_custom4'), on: localStorage.getItem('lv_custom4_enabled'), stamped: stamped('lv_label_custom4') && stamped('lv_custom4_enabled'), name: _impCustomNameOf('custom4') };
      // the auto-offer roster
      localStorage.removeItem('lv_coll_columns_seen_v1'); localStorage.removeItem('lv_coll_columns_seen_v1__at');
      _collVisibleCols();                                        // shipper + custom3 + custom4 are enabled → offered → remembered
      out.seen = { v: JSON.parse(localStorage.getItem('lv_coll_columns_seen_v1') || '[]').sort(), stamped: stamped('lv_coll_columns_seen_v1') };
      // the Appearance editor's Apply — colours, theme and the saved look
      window._subState = { sub: 'beta' };
      out.editorOn = rrAppearanceOn();
      window.openAppearance();
      await new Promise(res => setTimeout(res, 300));
      window._rrapRoleColor('--accent', '#db5407');
      window._rrapPreview();
      await new Promise(res => setTimeout(res, 200));
      window._rrapApply();
      await new Promise(res => setTimeout(res, 400));
      const nm = document.getElementById('rrap-save-name'); if (nm) nm.value = 'Alaska orange';
      const okb = document.getElementById('rrap-save-ok'); if (okb) okb.click();
      await new Promise(res => setTimeout(res, 500));
      out.apply = { theme: localStorage.getItem('lv_theme'), accent: JSON.parse(localStorage.getItem('lv_skin_custom') || '{}')['--accent'], presets: Object.keys(JSON.parse(localStorage.getItem('rr_skin_presets') || '{}')), stamped: stamped('lv_theme') && stamped('lv_skin_custom') && stamped('rr_skin_presets'), root: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() };
      // the heal: a value from before this release is dated 0 on its first read through the one reader
      localStorage.setItem('lv_label_custom5', 'Old name'); localStorage.removeItem('lv_label_custom5__at');
      localStorage.setItem('lv_fs_columns_v1', '["paid"]'); localStorage.removeItem('lv_fs_columns_v1__at');
      rrFieldLabel(RR_USER_FIELDS.filter(f => f.key === 'custom5')[0]); rrTableVisible('forsale');
      out.heal = { label: at('lv_label_custom5'), layout: at('lv_fs_columns_v1') };
      // the merge, per key: a newer layout from the other device never drags older colours along
      const m = rrPrefsMerge({ lv_skin_custom: 'orange', lv_coll_columns_v1: '["a"]' }, { lv_skin_custom: '10', lv_coll_columns_v1: '10' },
                             { lv_skin_custom: { v: 'gold', t: 5 }, lv_coll_columns_v1: { v: '["b"]', t: 20 } }, 100);
      out.merge = { apply: Object.keys(m.apply).filter(k => !/__at$/.test(k)), applied: m.apply.lv_coll_columns_v1, push: Object.keys(m.push), pushed: m.push.lv_skin_custom && m.push.lv_skin_custom.v };
      return out;
    });
    T('E: no page errors', errs.join(' | '), '');
    T('E: a saved layout is stamped for the account, and the look clock is left alone', [r.layout.v, r.layout.stamped, r.layout.look], ['["type","desc"]', true, null]);
    T('E: Reset writes \'\' (a removal cannot travel; an empty value can) — stamped, and read as the default layout', [r.reset.v, r.reset.stamped, r.reset.visible], ['', true, true]);
    T('E: an Extra Columns switch is stamped', r.shipper, { v: 'true', stamped: true });
    T('E: naming a custom column (Preferences) stamps the name AND its switch; the label shows', r.rename, { label: 'Owner', on: 'true', stampedL: true, stampedE: true, shown: 'Owner' });
    T('E: blanking the name un-names it (\'\'), the switch is left alone', r.unname, { label: '', shown: 'Custom 1', stillOn: 'true' });
    T('E: the Fill-a-column door claims a slot through the same writer', r.claim, { ret: 'Lot', label: 'Lot', on: 'true', stamped: true, free: false });
    T('E: the import\'s door claims a slot through the same writer', r.imp, { ret: { fields: ['custom4'], location: false }, label: 'Bought at', on: 'true', stamped: true, name: 'Bought at' });
    T('E: the auto-offer roster is stamped (custom1 is still switched on, only un-named)', r.seen, { v: ['custom1', 'custom3', 'custom4', 'shipper'], stamped: true });
    T('E: Appearance → Apply stamps the theme, the colours and the saved look; the app repaints', [r.editorOn, r.apply], [true, { theme: 'custom', accent: '#db5407', presets: ['Alaska orange'], stamped: true, root: '#db5407' }]);
    T('E: a value from before this release is dated 0 on its first read (so the account\'s copy wins, or this one seeds it)', r.heal, { label: '0', layout: '0' });
    T('E: the account merge is per setting — the other device\'s newer layout lands, this device\'s newer colours are sent, neither drags the other', r.merge, { apply: ['lv_coll_columns_v1'], applied: '["b"]', push: ['lv_skin_custom'], pushed: 'orange' });
    await pg.close();
  }
  // ── PLANTED E: a layout written raw again ─────────────────────────────────
  {
    const src = rd('table-columns.js');
    const anchor = "  _rrTableWrite(t.storageKey, JSON.stringify(clean));\n";
    T('PLANTED E: the layout writer goes through the account door, once', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'table-columns.js': src.replace(anchor, "  try { localStorage.setItem(t.storageKey, JSON.stringify(clean)); } catch (e) {}\n") });
    const r = await pg.evaluate(() => { rrTableSave('collection', ['type']); return { v: localStorage.getItem('lv_coll_columns_v1'), at: localStorage.getItem('lv_coll_columns_v1__at') }; });
    T('PLANTED E: a raw layout write is saved but never dated — it would never reach the account (caught)', r, { v: '["type"]', at: null });
    await pg.close();
  }

  // ── SRC: one route per key, the lists hold the line ──────────────────────
  {
    const look = code(rd('look-sync.js'));
    const all = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'tests-onboarding.js').map(f => [f, code(rd(f))]);
    const moved = ['lv_theme', 'lv_skin_custom', 'rr_skin_presets', 'lv_label_custom1', 'lv_label_custom2', 'lv_label_custom3', 'lv_label_custom4', 'lv_label_custom5',
      'lv_custom1_enabled', 'lv_custom2_enabled', 'lv_custom3_enabled', 'lv_custom4_enabled', 'lv_custom5_enabled', 'lv_shipper_enabled', 'lv_subcoll_enabled',
      'lv_coll_columns_v1', 'lv_fs_columns_v1', 'lv_coll_columns_seen_v1'];
    const listed = (look.match(/var MOVED_TO_PREFS = \[([\s\S]*?)\];/) || [, ''])[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
    const lookBlk = look.slice(look.indexOf('var LOOK_KEYS'), look.indexOf('var MOVED_TO_PREFS'));
    T('SRC: the keys that left the look file are named in look-sync.js, and none of them is in LOOK_KEYS', [listed.sort(), moved.filter(k => lookBlk.indexOf("'" + k + "'") >= 0)], [moved.slice().sort(), []]);
    const rawByName = all.filter(([f, s]) => moved.some(k => new RegExp("localStorage\\.setItem\\(\\s*'" + k + "'").test(s))).map(([f]) => f);
    const rawByShape = all.filter(([f, s]) => /localStorage\.setItem\(\s*('lv_label_' \+|'lv_' \+ key \+ '_enabled'|t\.storageKey|_COLL_COLS_SEEN|USER_PRESETS_KEY|\(window\.A11Y|f\.pref|def\.pref|_d\.pref|rrTable\(id\)\.storageKey)/.test(s)).map(([f]) => f);
    T('SRC: no file writes one of those keys raw — by name or by the shapes that used to', [rawByName, rawByShape], [[], []]);
    T('SRC: no file touches the look clock for a small setting any more (only the brand and the card library do)', all.filter(([f, s]) => /rrLookTouch\(\)/.test(s)).map(([f]) => f).sort(), ['appearance.js', 'logo-cards.js', 'look-sync.js']);
    T('SRC: naming a custom column has ONE writer (config.js) and every door calls it', [(rd('config.js').match(/window\.rrFieldClaimCustom = function/g) || []).length, (code(rd('import-ui.js')).match(/rrFieldClaimCustom\(/g) || []).length, /return rrFieldClaimCustom\(key, label\)/.test(rd('bulk-tag.js')), /rrFieldClaimCustom\(key, v\)/.test(rd('prefs.js'))], [1, 4, true, true]);
    T('SRC: the start-up check is still made once the shell exists', /rrLookCheckLater === 'function'\) window\.rrLookCheckLater\(\)/.test(rd('app-setup.js')), true);
    T('SRC: applyTheme reads the theme and the colours through the one reader', /_prefGet\(themeCfg\.storageKey \|\| 'lv_theme'/.test(rd('app.js')) && /_prefGet\(themeCfg\.customStorageKey \|\| 'lv_skin_custom'/.test(rd('app.js')), true);
  }

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
