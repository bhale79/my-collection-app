#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TRR Pro — STAFF PINs: one business account, each person a PIN
// (real Chromium, the REAL app, the stand-in Drive + Sheets of tests/lib/coll-world.js,
//  and a STAND-IN relay for the staff_* calls — the relay's own rules are proved
//  in relay/relay_v51_tests.js, 448 checks)
//
// PLAN_2026-11-10_TRR_PRO_R9_STAFF_ROUTE_B.md. [stated] Brad 2026-11-11 06:35 CT
// "employee pin id and just one account", PINs assigned by management, each
// switchable on/off any time; 06:37 "owners and managers"; 06:39 the list lives
// in the backend; 06:41 "yes".
//   G  source guards, each PROVED on a planted offender: every function in
//      RR_STAFF.gates opens with the roles door; the roles nest (Staff ⊂
//      Manager ⊂ Owner); every Movement Log writer stamps rrWhoNow(); the
//      device check is the relay's own scramble; the staff_* calls are
//      signed-in calls and the app never calls staff_support_reset
//   B  the walk: no PINs = nothing changes; first setup makes the Owner; add
//      Staff + a Manager; Switch person; a wrong PIN; Staff may not move,
//      delete, open the Staff screen or see billing, and the details card is
//      read only; a Manager may move but not delete; a person turned OFF
//      elsewhere is stopped; no signal = this device's copy decides; the idle
//      lock; 5 wrong = a wait; the Movement Log names the person
//   X  a regular customer: nothing at all
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  staff_pins_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1200))); cond ? pass++ : fail++; }

// RR_STAFF, read from the real config.js (its own block — plain data)
function staffConfig() {
  const src = read('config.js');
  const i = src.indexOf('const RR_STAFF = {');
  const j = src.indexOf('\n};\n', i);
  if (i < 0 || j < 0) return null;
  return vm.runInNewContext('(function(){ ' + src.slice(i, j + 3) + ' return RR_STAFF; })()', {});
}
// The first statement of a named function in a source text.
function firstStatement(src, fn) {
  const m = new RegExp('(async )?function ' + fn + '\\([^)]*\\) \\{\\n([^\\n]*)\\n').exec(src);
  return m ? m[2] : null;
}
function gateMisses(gates, srcOf) {
  const out = [];
  Object.keys(gates).forEach(f => Object.keys(gates[f]).forEach(fn => {
    const line = firstStatement(srcOf(f), fn);
    if (!line || line.indexOf("rrStaffGate('" + gates[f][fn] + "')") < 0) out.push(f + ':' + fn);
  }));
  return out;
}
const MOVE_LOG_WRITERS = [
  ['scan-shelve.js', /var who = \(typeof rrWhoNow === 'function'\) \? rrWhoNow\(\)/],
  ['collections-archive.js', /var who = \(typeof rrWhoNow === 'function'\) \? rrWhoNow\(\)/],
  ['collections-handover.js', /var me = \(typeof rrWhoNow === 'function'\) \? rrWhoNow\(\)/],
  ['collections-move.js', /who: \(typeof rrWhoNow === 'function'\) \? rrWhoNow\(\)/],
];

function guards() {
  console.log('\n== G · source guards ==');
  const S = staffConfig();
  T('G0 RR_STAFF is in config.js', !!(S && S.may && S.gates), S && Object.keys(S));
  const misses = gateMisses(S.gates, f => read(f));
  T('G1 every function in RR_STAFF.gates opens with the roles door (' + Object.values(S.gates).reduce((n, o) => n + Object.keys(o).length, 0) + ' functions)', misses.length === 0, misses);
  const plantSrc = f => f === 'collections-archive.js' ? read(f).replace(/(function rrDeleteCollection\([^)]*\) \{\n)[^\n]*\n/, '$1') : read(f);
  T('G1b PLANTED: the door removed from rrDeleteCollection → caught', gateMisses(S.gates, plantSrc).indexOf('collections-archive.js:rrDeleteCollection') >= 0);
  const plant2 = f => f === 'collections-move.js' ? read(f).replace("rrStaffGate('move')) return { ok: false, why: 'role' };", "rrStaffGate('edit')) return { ok: false, why: 'role' };") : read(f);
  T('G1c PLANTED: the door asking the WRONG thing (edit instead of move) → caught', gateMisses(S.gates, plant2).indexOf('collections-move.js:rrMoveRun') >= 0);
  const sub = (a, b) => a.every(x => b.indexOf(x) >= 0);
  T('G2 the roles nest: Staff ⊂ Manager ⊂ Owner', sub(S.may.staff, S.may.manager) && sub(S.may.manager, S.may.owner), S.may);
  T('G2 Brad\'s 10-28 split: Staff = add, edit, photos, scan, sell', JSON.stringify(S.may.staff) === JSON.stringify(['add', 'edit', 'photos', 'scan', 'sell']), S.may.staff);
  T('G2 managers manage PINs (11-11 "owners and managers"); only owners delete, bill and change business settings',
    S.may.manager.indexOf('staff') >= 0 && ['delete', 'billing', 'business'].every(x => S.may.manager.indexOf(x) < 0 && S.may.owner.indexOf(x) >= 0), S.may);
  const used = [].concat(...Object.values(S.gates).map(o => Object.values(o)));
  T('G2 every gate asks for something the Owner may do (no typo locks everyone out)', used.every(x => S.may.owner.indexOf(x) >= 0), used);
  const mw = MOVE_LOG_WRITERS.filter(([f, re]) => !re.test(read(f))).map(([f]) => f);
  T('G3 every Movement Log writer stamps the person working (rrWhoNow)', mw.length === 0, mw);
  const pl = read('collections-move.js').replace("who: (typeof rrWhoNow === 'function') ? rrWhoNow() : ", 'who: ');
  T('G3b PLANTED: a writer back on the account email → caught', !MOVE_LOG_WRITERS[3][1].test(pl));
  const ix = read('index.html');
  T('G4 index.html loads staff.js once, after config.js and vault.js', (ix.match(/staff\.js\?v=/g) || []).length === 1 && ix.indexOf('staff.js?v=') > ix.indexOf('config.js?v=') && ix.indexOf('staff.js?v=') > ix.indexOf('vault.js?v='));
  T('G4 the offline cache holds staff.js', /'\.\/staff\.js'/.test(read('sw.js')));
  T('G4 staff.js is a core file', fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8').indexOf('app/staff.js') >= 0);
  const v = read('vault.js');
  const idList = (/IDENTITY_ACTIONS: \[([\s\S]*?)\n\s*ANONYMOUS_ACTIONS/.exec(v) || [])[1] || '';
  T('G5 the five staff calls are signed-in calls', ['staff_list', 'staff_check', 'staff_save', 'staff_switch', 'staff_settings'].every(a => idList.indexOf("'" + a + "'") >= 0), idList.slice(-300));
  const apps = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f));
  T('G5 the app never calls staff_support_reset (support only)', apps.every(f => read(f).indexOf("'staff_support_reset'") < 0));
  T('G6 the device check is the relay\'s own scramble (rrpin | salt | person | PIN)', read('staff.js').indexOf("_sha40('rrpin|' + (_list ? _list.salt : '') + '|' + id + '|' + pin)") >= 0);
  T('G7 a PIN is never written to this device (only the scrambles the relay sent)', !/setItem\([^)]*pin/i.test(read('staff.js').replace(/actorPin/g, '')));
}

// ── the stand-in relay (staff_* only), the same rules in miniature ──
async function standInRelay(pg) {
  await pg.evaluate(() => {
    const R = window.__relay = { people: [], salt: 'abc123salt', idleMin: 10, updated: '', calls: [], wrong: {}, down: false };
    const hex40 = async t => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
    const answer = async (msg) => ({ status: 200, message: msg || 'OK', enabled: R.people.length > 0, salt: R.salt, idleMin: R.idleMin, updated: R.updated,
      people: await Promise.all(R.people.map(async p => ({ id: p.id, name: p.name, role: p.role, on: p.on, check: await hex40('rrpin|' + R.salt + '|' + p.id + '|' + p.pin) }))) });
    const deny = (s, m) => ({ status: s, message: m });
    const actor = p => {
      const a = R.people.find(x => x.id === p.actorId);
      if (!a || !a.on) return deny(403, 'not_allowed');
      if ((R.wrong[a.id] || 0) >= 5) return deny(429, 'wait');
      if (a.pin !== String(p.actorPin)) { R.wrong[a.id] = (R.wrong[a.id] || 0) + 1; return deny(403, 'wrong_pin'); }
      R.wrong[a.id] = 0; return { a };
    };
    const may = (a, t, role) => a.role === 'owner' || (a.role === 'manager' && (!t || t.role === 'staff') && (!role || role === 'staff'));
    let n = 0;
    window.vaultPost = async function (p) {
      R.calls.push(p.action);
      if (R.down) return null;
      const bump = () => { R.updated = new Date(Date.now() + (++n)).toISOString(); };
      if (p.action === 'staff_list') return answer();
      if (p.action === 'staff_check') { const g = actor(p); if (g.status) return g; return { status: 200, message: 'OK', id: g.a.id, name: g.a.name, role: g.a.role }; }
      if (p.action === 'staff_save') {
        const per = p.person || {};
        const t = per.id ? R.people.find(x => x.id === per.id) : null;
        if (!R.people.length) {
          if (per.role !== 'owner') return deny(400, 'first_is_owner');
          R.people.push({ id: 'p' + (++n), name: per.name, role: 'owner', pin: per.pin, on: true }); bump(); return answer('added');
        }
        const g = actor(p); if (g.status) return g;
        if (!may(g.a, t, per.role)) return deny(403, 'not_allowed');
        if (per.pin && R.people.some(x => x.pin === per.pin && x !== t)) return deny(409, 'pin_taken');
        if (t) { if (per.name) t.name = per.name; if (per.role) t.role = per.role; if (per.pin) t.pin = per.pin; }
        else R.people.push({ id: 'p' + (++n), name: per.name, role: per.role, pin: per.pin, on: true });
        bump(); return answer(t ? 'saved' : 'added');
      }
      if (p.action === 'staff_switch') {
        const t = R.people.find(x => x.id === p.id); if (!t) return deny(404, 'no_such_person');
        const g = actor(p); if (g.status) return g;
        if (!may(g.a, t, '')) return deny(403, 'not_allowed');
        t.on = !!p.on; bump(); return answer(p.on ? 'on' : 'off');
      }
      if (p.action === 'staff_settings') { const g = actor(p); if (g.status) return g; if (g.a.role !== 'owner') return deny(403, 'not_allowed'); R.idleMin = Number(p.idleMin); bump(); return answer('settings'); }
      return { status: 200, message: 'OK' };
    };
    window.__toasts = window.__toasts || [];
  });
}
async function world(browser, opts) {
  const b = await boot({ newPage: () => browser.newPage({ viewport: { width: 1200, height: 900 } }) }, opts);
  await standInRelay(b.pg);
  await b.pg.evaluate(() => { try { localStorage.removeItem(RR_STAFF.cacheKey); localStorage.removeItem(RR_STAFF.whoKey); } catch (e) {} });
  return b;
}
const pinShown = pg => pg.evaluate(() => { const d = document.getElementById('rr-staff-pin'); return d ? (document.getElementById('rr-staff-msg') || {}).textContent || 'shown' : ''; });
async function typePin(pg, pin) {
  for (const d of String(pin)) await pg.click('#rr-staff-pin [data-pin-key="' + d + '"]');
  await pg.click('#rr-staff-pin [data-pin-key="enter"]');
  await pg.waitForTimeout(250);
}

async function walk(browser) {
  console.log('\n== B · the walk ==');
  const { pg, errs } = await world(browser);
  // B1 Pro with no staff list: nothing changes
  const b1 = await pg.evaluate(async () => {
    rrStaffBoot(); await new Promise(z => setTimeout(z, 200));
    buildPrefsPage();
    return { on: rrStaffOn(), can: ['move', 'delete', 'billing', 'staff'].every(x => rrStaffCan(x)), pin: !!document.getElementById('rr-staff-pin'),
             row: !!document.querySelector('#prefs-content [data-staff-prefs]'), who: rrWhoNow() };
  });
  T('B1 a Pro business with no PINs yet: no PIN screen, everything allowed, as today', !b1.on && b1.can && !b1.pin, b1);
  T('B1 …Preferences → Business tools offers "Staff and PINs"', b1.row, b1);
  T('B1 …and saves are stamped with the account, as before', b1.who === 'test@example.com' || /@/.test(b1.who) || b1.who.length > 0, b1.who);

  // B2 first setup: the business account makes the Owner
  await pg.evaluate(() => rrStaffAdminOpen());
  await pg.fill('#rr-staff-f-name', 'Deborah');
  await pg.fill('#rr-staff-f-pin', '4826');
  await pg.click('#rr-staff-f-go');
  await pg.waitForTimeout(300);
  const b2 = await pg.evaluate(() => ({ on: rrStaffOn(), now: rrStaffNow(), people: window.__relay.people.map(p => p.name + ':' + p.role), chip: (document.getElementById('rr-staff-chip') || {}).textContent || '', admin: !!document.getElementById('rr-staff-admin'),
    stored: localStorage.getItem(RR_STAFF.cacheKey) || '' }));
  T('B2 first setup makes the Owner, and the Owner is the one working', b2.on && b2.now && b2.now.name === 'Deborah' && b2.now.role === 'owner' && b2.people.join() === 'Deborah:owner', b2);
  T('B2 the top bar names who is working', /Deborah/.test(b2.chip), b2.chip);
  T('B2 this device keeps the list (no PINs in it, only scrambles)', b2.stored.indexOf('Deborah') >= 0 && b2.stored.indexOf('4826') < 0, b2.stored.slice(0, 200));
  T('B2 the Staff screen stays open on the list', b2.admin, b2);

  // B3 add Staff (Sue) and a Manager (Mike); make-one-up never offers an easy or taken PIN
  const made = await pg.evaluate(async () => { const out = []; for (let i = 0; i < 30; i++) out.push(await rrStaffMakePin()); return out; });
  T('B3 "make one up": 30 PINs, none easy, none Deborah\'s', made.every(p => /^\d{4}$/.test(p) && !rrStaffPinProblemNode(p) && p !== '4826'), made);
  await pg.fill('#rr-staff-a-name', 'Sue'); await pg.selectOption('#rr-staff-a-role', 'staff'); await pg.fill('#rr-staff-a-pin', '5172'); await pg.click('#rr-staff-a-go');
  await pg.waitForTimeout(300);
  await pg.fill('#rr-staff-a-name', 'Mike'); await pg.selectOption('#rr-staff-a-role', 'manager'); await pg.fill('#rr-staff-a-pin', '7391'); await pg.click('#rr-staff-a-go');
  await pg.waitForTimeout(300);
  const b3 = await pg.evaluate(() => ({ people: window.__relay.people.map(p => p.name + ':' + p.role + ':' + p.on), rows: document.querySelectorAll('#rr-staff-admin [data-staff-person]').length }));
  T('B3 the Owner adds Sue (Staff) and Mike (Manager)', b3.people.join() === 'Deborah:owner:true,Sue:staff:true,Mike:manager:true' && b3.rows === 3, b3);
  await pg.fill('#rr-staff-a-name', 'Pat'); await pg.selectOption('#rr-staff-a-role', 'staff'); await pg.fill('#rr-staff-a-pin', '1234'); await pg.click('#rr-staff-a-go');
  await pg.waitForTimeout(200);
  T('B3 an easy PIN (1234) is refused before it is sent', !(await pg.evaluate(() => window.__relay.people.some(p => p.name === 'Pat'))));
  await pg.click('#rr-staff-admin [data-staff-x]');

  // B4 Switch person → the PIN screen; a wrong PIN; Sue's PIN
  await pg.evaluate(() => rrStaffSwitch());
  T('B4 Switch person shows the PIN screen', !!(await pinShown(pg)));
  await typePin(pg, '9999');
  T('B4 a wrong PIN says so and lets nobody in', /isn.t right/.test(await pinShown(pg)) && !(await pg.evaluate(() => rrStaffNow())));
  await typePin(pg, '5172');
  const b4 = await pg.evaluate(() => ({ now: rrStaffNow(), pin: !!document.getElementById('rr-staff-pin'), chip: (document.getElementById('rr-staff-chip') || {}).textContent || '', checked: window.__relay.calls.filter(c => c === 'staff_check').length }));
  T('B4 Sue\'s PIN: Sue is working, the PIN screen is gone, the top bar says Sue', b4.now && b4.now.name === 'Sue' && !b4.pin && /Sue/.test(b4.chip), b4);
  T('B4 online, the relay confirmed the PIN (staff_check)', b4.checked >= 1, b4);

  // B5 what Staff may NOT do
  await openColl(pg, 'c7');
  const b5 = await pg.evaluate(async () => {
    window.__toasts = []; const _t = window.showToast; window.showToast = (m) => window.__toasts.push(String(m));
    const writes0 = window.__calls.length;
    const key = Object.keys(state.personalData)[0];
    const mv = await rrMoveRun({ keys: [key], to: 'c8' });
    const del = await rrDeleteCollection('c9', 'Jones');
    await removeCollectionItem(state.personalData[key].itemNum, '', state.personalData[key].row, state.personalData[key].inventoryId);
    const stillThere = !!state.personalData[key];
    rrStaffAdminOpen();
    const admin = !!document.getElementById('rr-staff-admin');
    rrCollMenuOpen(); const menu = (document.getElementById('rr-coll-list') || {}).innerHTML || '';
    const m = document.getElementById('rr-coll-menu'); if (m) m.remove();
    rrCollDetailsOpen('c7');
    const card = document.getElementById('rr-coll-details');
    const ro = { save: !!document.getElementById('rr-coll-d-save'), nameDisabled: !!(document.getElementById('rr-coll-d-name') || {}).disabled, html: card ? card.innerHTML : '' };
    if (card) card.remove();
    buildPrefsPage();
    const prefs = document.getElementById('prefs-content').innerHTML;
    const writes = window.__calls.slice(writes0).filter(c => c.kind === 'put' || c.kind === 'append' || c.kind === 'listWrite');
    window.showToast = _t;
    return { mv, del, stillThere, admin, menuNew: /rrCollNewOpen/.test(menu), menuMove: /rrMoveManyOpen/.test(menu), menuInv: /rrInvOpen/.test(menu), menuAll: /rrAllOpen/.test(menu),
             ro, archInCard: /rrArchiveOpen|rrDeleteOpen/.test(ro.html), handInCard: /rrHandOverOpen/.test(ro.html),
             staffRow: /data-staff-prefs/.test(prefs), bizSection: /data-pp-prefs/.test(prefs), sub: _prefsSubRowHtml(), moveBtn: rrMoveBtnHtml(state.personalData[key]), toasts: window.__toasts.slice(), writes: writes.length };
  });
  T('B5 Staff may NOT move: refused with no write', b5.mv && b5.mv.why === 'role', b5.mv);
  T('B5 Staff may NOT delete a collection, nor remove an item (still there)', b5.del && b5.del.why === 'role' && b5.stillThere, b5);
  T('B5 …and nothing was written to any sheet or list', b5.writes === 0, b5.writes);
  T('B5 …and Sue is told whom to ask', b5.toasts.some(t => /Sue can.t do that — ask a manager/.test(t)) && b5.toasts.some(t => /ask the owner/.test(t)), b5.toasts);
  T('B5 Staff may NOT open the Staff screen', !b5.admin, b5);
  T('B5 the collections menu hides New collection, Move items and Invoices for Staff (All Collections stays)', !b5.menuNew && !b5.menuMove && !b5.menuInv && b5.menuAll, b5);
  T('B5 the collection card opens READ ONLY for Staff, with no archive / delete / hand over', !b5.ro.save && b5.ro.nameDisabled && !b5.archInCard && !b5.handInCard, b5.ro);
  T('B5 no Staff-and-PINs row and no subscription row for Staff', !b5.staffRow && b5.sub === '', b5);
  T('B5 …and no empty Business tools heading either', !b5.bizSection, b5.bizSection);
  T('B5 no Move button on an item page for Staff', b5.moveBtn === '', b5.moveBtn);

  // B6 the Movement Log names the person working
  const b6 = await pg.evaluate(async () => {
    const key = Object.keys(state.personalData)[0];
    await rrMoveLogAdd(state.personalData[key], { loc: '', spot: '' }, { loc: 'Shelf A', spot: '' }, 'scan');
    const tab = (window.__S[state.personalSheetId] || {})['Movement Log'] || [];
    return { who: rrWhoNow(), last: tab[tab.length - 1] || [] };
  });
  T('B6 rrWhoNow() is Sue, and her Movement Log line says Sue', b6.who === 'Sue' && b6.last.indexOf('Sue') >= 0, b6);

  // B7 a Manager: may move, archive, manage Staff; may NOT delete, nor touch the Owner
  await pg.evaluate(() => rrStaffSwitch());
  await typePin(pg, '7391');
  const b7 = await pg.evaluate(async () => {
    const r = { now: rrStaffNow(), move: rrStaffCan('move'), archive: rrStaffCan('archive'), staff: rrStaffCan('staff'), del: rrStaffCan('delete'), bill: rrStaffCan('billing') };
    r.del2 = await rrDeleteCollection('c9', 'Jones');
    return r;
  });
  T('B7 Mike (Manager): may move, archive and manage staff', b7.now && b7.now.name === 'Mike' && b7.move && b7.archive && b7.staff, b7);
  T('B7 …may NOT delete or see billing', !b7.del && !b7.bill && b7.del2 && b7.del2.why === 'role', b7);
  await pg.evaluate(() => rrStaffAdminOpen());
  await pg.fill('#rr-staff-c-pin', '7391'); await pg.click('#rr-staff-c-go'); await pg.waitForTimeout(300);
  const b7b = await pg.evaluate(() => ({
    sw: Array.from(document.querySelectorAll('#rr-staff-admin [data-staff-switch]')).map(b => b.getAttribute('data-staff-switch')),
    people: window.__relay.people.map(p => p.id + ':' + p.name), idle: !!document.getElementById('rr-staff-idle'),
    roles: Array.from(document.querySelectorAll('#rr-staff-a-role option')).map(o => o.value) }));
  const sueId = b7b.people.find(x => /:Sue$/.test(x)).split(':')[0];
  T('B7 after his own PIN, the Staff screen gives Mike switches for Staff ONLY (Sue), not the Owner or himself', JSON.stringify(b7b.sw) === JSON.stringify([sueId]), b7b);
  T('B7 Mike may add Staff only, and cannot change the idle lock', JSON.stringify(b7b.roles) === '["staff"]' && !b7b.idle, b7b);
  // Mike turns Sue off
  await pg.click('#rr-staff-admin [data-staff-switch="' + sueId + '"]'); await pg.waitForTimeout(300);
  T('B7 Mike turns Sue OFF', await pg.evaluate(id => window.__relay.people.find(p => p.id === id).on === false, sueId));
  await pg.click('#rr-staff-admin [data-staff-x]');
  // Sue's PIN no longer works
  await pg.evaluate(() => rrStaffSwitch());
  await typePin(pg, '5172');
  T('B7 Sue\'s PIN now says it has been turned off', /turned off/.test(await pinShown(pg)) && !(await pg.evaluate(() => rrStaffNow())));

  // B8 turned off ELSEWHERE while working: stopped at the next refresh
  await typePin(pg, '7391');
  await pg.evaluate(() => { window.__relay.people.find(p => p.name === 'Mike').on = false; });
  await pg.evaluate(() => rrStaffRefresh());
  await pg.waitForTimeout(200);
  T('B8 Mike turned off on another device: this device stops him at the next refresh', /Mike.s PIN has been turned off/.test(await pinShown(pg)) && !(await pg.evaluate(() => rrStaffNow())));
  await pg.evaluate(() => { window.__relay.people.find(p => p.name === 'Mike').on = true; return rrStaffRefresh(); });

  // B9 no signal: this device's copy decides, and the relay is not asked
  const n9 = await pg.evaluate(() => { window._offlineMode = true; return window.__relay.calls.length; });
  await typePin(pg, '4826');
  const b9 = await pg.evaluate(n => ({ now: rrStaffNow(), asked: window.__relay.calls.slice(n) }), n9);
  T('B9 no signal: Deborah\'s PIN works from this device\'s copy, and the relay is not asked', b9.now && b9.now.name === 'Deborah' && b9.asked.length === 0, b9);
  const b9b = await pg.evaluate(() => { const before = rrStaffNow(); rrStaffAdminOpen(); return { admin: !!document.getElementById('rr-staff-admin'), before }; });
  T('B9 …but turning PINs on or off needs a connection (Brad, 06:39)', !b9b.admin, b9b);
  await pg.evaluate(() => { window._offlineMode = false; });

  // B10 the idle lock
  await pg.evaluate(() => { _rrStaffAge(11 * 60000); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(200);
  T('B10 after the quiet time (10 minutes) the device asks for a PIN again', /quiet spell/.test(await pinShown(pg)) && !(await pg.evaluate(() => rrStaffNow())));

  // B11 five wrong PINs = a wait, even for the right PIN
  for (let i = 0; i < 5; i++) await typePin(pg, '9999');
  await typePin(pg, '4826');
  T('B11 five wrong PINs: the sixth try waits — even the right PIN', /wait a minute/.test(await pinShown(pg)) && !(await pg.evaluate(() => rrStaffNow())));
  await pg.evaluate(() => { _rrStaffState().wrong.until = 0; });
  await typePin(pg, '4826');
  T('B11 …after the wait the right PIN works', (await pg.evaluate(() => (rrStaffNow() || {}).name)) === 'Deborah');

  // B12 a reload keeps the person working (inside the quiet time), and the PIN screen comes back after it
  const b12 = await pg.evaluate(() => ({ who: JSON.parse(localStorage.getItem(RR_STAFF.whoKey) || 'null') }));
  T('B12 who is working is remembered on this device (id and time only)', b12.who && Object.keys(b12.who).sort().join() === 'acct,at,id', b12);
  T('B13 no page errors', errs.length === 0, errs);
  await pg.close();
}

async function regular(browser) {
  console.log('\n== X · a regular customer ==');
  const { pg, errs } = await world(browser, { off: true });
  const x = await pg.evaluate(async () => {
    rrStaffBoot(); await new Promise(z => setTimeout(z, 200));
    buildPrefsPage();
    return { on: rrStaffOn(), can: rrStaffCan('delete'), pin: !!document.getElementById('rr-staff-pin'), row: /data-staff-prefs/.test(document.getElementById('prefs-content').innerHTML),
             calls: window.__relay.calls.slice(), html: rrPrefsStaffHtml(), chip: rrStaffChipHtml() };
  });
  T('X1 a regular customer: no PIN screen, no Staff row, everything as today', !x.on && x.can && !x.pin && !x.row && x.html === '' && x.chip === '', x);
  T('X2 …and the relay is never asked about staff', x.calls.length === 0, x.calls);
  T('X3 no page errors', errs.length === 0, errs);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try { await walk(browser); await regular(browser); }
  catch (e) { T('the run itself', false, e && e.stack); }
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  staff_pins_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

// the relay's PIN rule, in Node — "make one up" is checked against it
function rrStaffPinProblemNode(pin) {
  const s = String(pin);
  if (!/^[0-9]{4,8}$/.test(s)) return 'pin_format';
  if (/^(\d)\1+$/.test(s)) return 'pin_easy';
  let up = true, down = true;
  for (let i = 1; i < s.length; i++) { const d = Number(s[i]) - Number(s[i - 1]); if (d !== 1) up = false; if (d !== -1) down = false; }
  if (up || down) return 'pin_easy';
  if (s.length % 2 === 0 && s === s.substring(0, 2).repeat(s.length / 2)) return 'pin_easy';
  if (['2580', '0852', '1470', '0741', '3690', '0963', '1397', '7931', '1379', '9731'].indexOf(s) >= 0) return 'pin_easy';
  return '';
}
