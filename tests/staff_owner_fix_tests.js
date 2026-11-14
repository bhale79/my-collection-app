#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TRR Pro — STAFF PINs: the Owner locked out (2026-11-13) — fixed at the root
// (real Chromium, the REAL app, the stand-in world of tests/lib/coll-world.js and
//  a stand-in relay with the v5.5 calls — the relay's own rules are proved in
//  relay/relay_v55_tests.js, section 22)
//
// FIX_2026-11-13_STAFF_OWNER_PIN.md. Hand-test T-2026-11-11-01 FAILED: the Owner's
// PIN refused. Cause (measured on the live Vault): the staff_biz tab had no title
// row, the relay skipped the business's row and made a SECOND salt; the Owner's
// device check was made with the first. The app checked the PIN on the device
// only and never asked the relay. [stated] Brad 2026-11-13 07:37 CT "do the staff
// PIN fix", 07:43 CT "yes" to the plan.
//   F  the fault: a device copy whose Owner check no longer fits → online, the
//      relay is asked (staff_who) and the Owner gets in; off line the copy still
//      decides; the relay's "turned off" and "wait" are shown; an older relay
//      ("Unknown action") changes nothing
//   W  "Make me the Owner" says it is working and a second press sends nothing
//   R  an Owner who forgot their PIN: an emailed code, a new PIN, straight in
//   K  the keyboard: digits + Enter typed, tapped then Enter, a field behind
//   S  the smaller things: the greeting names the person working; Preferences
//      is drawn again for them; Staff refused Un-archive hear "ask the owner"
//      and nothing else
//   G  source guards, each PROVED on a planted offender
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  staff_owner_fix_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1200))); cond ? pass++ : fail++; }

// ── the stand-in relay: v5.1's rules in miniature + the v5.5 calls ──
async function standInRelay(pg) {
  await pg.evaluate(() => {
    const R = window.__relay = { people: [], salt: 'abc123salt', idleMin: 10, updated: '', calls: [], wrong: {}, down: false, delay: 0, version: 'v5.5', mail: [], code: null, codeTries: 0 };
    const hex40 = async t => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
    const answer = async (msg, extra) => Object.assign({ status: 200, message: msg || 'OK', enabled: R.people.length > 0, salt: R.salt, idleMin: R.idleMin, updated: R.updated,
      people: await Promise.all(R.people.map(async p => ({ id: p.id, name: p.name, role: p.role, on: p.on, check: await hex40('rrpin|' + R.salt + '|' + p.id + '|' + p.pin) }))) }, extra || {});
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
      if (R.delay) await new Promise(z => setTimeout(z, R.delay));
      const bump = () => { R.updated = new Date(Date.now() + (++n)).toISOString(); };
      const v55 = R.version === 'v5.5';
      if (p.action === 'staff_list') return answer();
      if (p.action === 'staff_check') { const g = actor(p); if (g.status) return g; return { status: 200, message: 'OK', id: g.a.id, name: g.a.name, role: g.a.role }; }
      if (p.action === 'staff_who') {
        if (!v55) return deny(400, 'Unknown action');
        if (R.whoAnswer) return R.whoAnswer;
        const a = R.people.find(x => x.pin === String(p.pin));
        if (!a) return deny(403, 'wrong_pin');
        if (!a.on) return deny(403, 'not_allowed');
        return answer('OK', { id: a.id, name: a.name, role: a.role });
      }
      if (p.action === 'staff_reset_code') {
        if (!v55) return deny(400, 'Unknown action');
        if (!R.people.some(x => x.role === 'owner')) return deny(409, 'no_staff_yet');
        if (R.resetAnswer) return R.resetAnswer;   // relay v5.6: too_many_today / mail_full / mail_failed
        R.code = '482913'; R.codeTries = 0; R.mail.push('to the business account'); return { status: 200, message: 'sent', to: 'sh•••@example.test' };
      }
      if (p.action === 'staff_reset_pin') {
        if (!v55) return deny(400, 'Unknown action');
        if (!R.code) return deny(410, 'code_gone');
        if (String(p.code) !== R.code) { if (++R.codeTries >= 5) R.code = null; return deny(403, 'wrong_code'); }
        const t = R.people.find(x => x.id === p.id);
        if (!t) return deny(404, 'no_such_person');
        if (t.role !== 'owner') return deny(403, 'not_allowed');
        if (R.people.some(x => x.pin === String(p.pin) && x !== t)) return deny(409, 'pin_taken');
        t.pin = String(p.pin); t.on = true; R.code = null; bump();
        return answer('reset', { id: t.id, name: t.name, role: t.role });
      }
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
      return { status: 200, message: 'OK' };
    };
  });
}
// A fresh world. `plant` = a planted copy of staff.js, run over the real one before boot.
async function world(browser, plant) {
  const b = await boot({ newPage: () => browser.newPage({ viewport: { width: 1200, height: 900 } }) }, {});
  await standInRelay(b.pg);
  if (plant) await b.pg.evaluate(src => { (0, eval)(src); }, plant);
  await b.pg.evaluate(() => { try { localStorage.removeItem(RR_STAFF.cacheKey); localStorage.removeItem(RR_STAFF.whoKey); } catch (e) {} });
  return b;
}
const pinMsg = pg => pg.evaluate(() => { const d = document.getElementById('rr-staff-pin'); return d ? (document.getElementById('rr-staff-msg') || {}).textContent || 'shown' : ''; });
const whoName = pg => pg.evaluate(() => (rrStaffNow() || {}).name || '');
async function typePin(pg, pin) {
  for (const d of String(pin)) await pg.click('#rr-staff-pin [data-pin-key="' + d + '"]');
  await pg.click('#rr-staff-pin [data-pin-key="enter"]');
  await pg.waitForTimeout(300);
}
// The Owner (Brad 4826), Sue (Staff 6204), Mike (Manager 7391) — the hand-test's business.
async function setUp(pg) {
  await pg.evaluate(() => rrStaffBoot()); await pg.waitForTimeout(150);
  await pg.evaluate(() => rrStaffAdminOpen()); await pg.waitForTimeout(150);
  await pg.fill('#rr-staff-f-name', 'Brad'); await pg.fill('#rr-staff-f-pin', '4826');
  await pg.click('#rr-staff-f-go'); await pg.waitForTimeout(400);
  for (const [nm, role, pin] of [['Sue', 'staff', '6204'], ['Mike', 'manager', '7391']]) {
    await pg.fill('#rr-staff-a-name', nm); await pg.selectOption('#rr-staff-a-role', role); await pg.fill('#rr-staff-a-pin', pin);
    await pg.click('#rr-staff-a-go'); await pg.waitForTimeout(350);
  }
  await pg.evaluate(() => { const d = document.getElementById('rr-staff-admin'); if (d) d.remove(); });
}
// The 2026-11-13 fault on this device: the Owner's check made with another salt.
const breakOwnerCheck = pg => pg.evaluate(() => {
  const L = _rrStaffState().list; const o = L.people.find(p => p.role === 'owner');
  o.check = '955c91ad204f82382e9e74c1eff5e71a1573620b';      // the live Owner check (salt A) — fits nothing under the salt in use
  localStorage.setItem(RR_STAFF.cacheKey, JSON.stringify(L));
});

async function fault(browser, plant) {
  const { pg, errs } = await world(browser, plant);
  await setUp(pg);
  await breakOwnerCheck(pg);
  await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(150);
  const before = await pg.evaluate(() => window.__relay.calls.length);
  await typePin(pg, '4826');
  const r = { name: await whoName(pg), msg: await pinMsg(pg), asked: await pg.evaluate(b => window.__relay.calls.slice(b), before) };
  await pg.close();
  return { r, errs };
}

async function run(browser) {
  console.log('\n== F · the fault ==');
  {
    const { r, errs } = await fault(browser);
    T('F1 the Owner\'s device check no longer fits (the live fault) → online, the relay is asked and the Owner gets in', r.name === 'Brad' && r.asked.indexOf('staff_who') >= 0 && !r.msg, r);
    T('F1 …no page errors', errs.length === 0, errs);
  }
  {
    const { pg } = await world(browser);
    await setUp(pg); await breakOwnerCheck(pg);
    await pg.evaluate(() => { rrStaffLock('locked'); window.__relay.down = true; });
    await pg.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); });
    await typePin(pg, '4826');
    const off = { name: await whoName(pg), msg: await pinMsg(pg), calls: await pg.evaluate(() => window.__relay.calls.filter(c => c === 'staff_who').length) };
    T('F2 no signal: this device\'s copy still decides (and the relay is not asked)', off.name === '' && /isn’t right/.test(off.msg) && off.calls === 0, off);
    await pg.evaluate(() => { delete navigator.onLine; window.__relay.down = false; });
    await typePin(pg, '6204');
    T('F2 …Sue\'s PIN (her check fits) works from the copy, no relay needed for her', (await whoName(pg)) === 'Sue');
    await pg.close();
  }
  {
    const { pg } = await world(browser);
    await setUp(pg); await breakOwnerCheck(pg);
    await pg.evaluate(() => { rrStaffLock('locked'); window.__relay.whoAnswer = { status: 403, message: 'not_allowed' }; });
    await typePin(pg, '4826');
    T('F3 the relay says the PIN is turned off → "turned off", nobody let in', /turned off/.test(await pinMsg(pg)) && !(await whoName(pg)));
    await pg.evaluate(() => { window.__relay.whoAnswer = { status: 429, message: 'wait' }; });
    await typePin(pg, '4826');
    T('F3 the relay says wait → "wait a minute"', /wait a minute/.test(await pinMsg(pg)) && !(await whoName(pg)));
    await pg.evaluate(() => { window.__relay.whoAnswer = null; window.__relay.version = 'v5.4'; _rrStaffState().wrong.n = 0; });
    await typePin(pg, '4826');
    T('F4 an older relay ("Unknown action") → as before: the copy decides, "isn’t right", no crash', /isn’t right/.test(await pinMsg(pg)) && !(await whoName(pg)));
    await pg.evaluate(() => { window.__relay.version = 'v5.5'; _rrStaffState().wrong.n = 0; });
    // F6: the device copy says 6204 is Sue's, but it was given to Bob since
    await pg.evaluate(() => { const R = window.__relay; const sue = R.people.find(p => p.name === 'Sue'); sue.pin = '3816'; R.people.push({ id: 'pBob', name: 'Bob', role: 'staff', pin: '6204', on: true }); });
    await typePin(pg, '6204');
    T('F6 the device copy names the wrong person (a PIN given to Bob since) → the relay says whose it is now: Bob is in', (await whoName(pg)) === 'Bob', await pinMsg(pg));
    await pg.evaluate(() => { rrStaffLock('locked'); _rrStaffState().wrong.n = 0; });
    await typePin(pg, '9999');
    T('F5 a PIN nobody has: the relay says wrong → "isn’t right", nobody let in', /isn’t right/.test(await pinMsg(pg)) && !(await whoName(pg)));
    await pg.close();
  }

  console.log('\n== W · "Make me the Owner" ==');
  {
    const { pg, errs } = await world(browser);
    await pg.evaluate(() => rrStaffBoot()); await pg.waitForTimeout(150);
    await pg.evaluate(() => { rrStaffAdminOpen(); window.__relay.delay = 1500; });
    await pg.waitForTimeout(150);
    await pg.fill('#rr-staff-f-name', 'Brad'); await pg.fill('#rr-staff-f-pin', '4826');
    await pg.click('#rr-staff-f-go');
    await pg.waitForTimeout(200);
    const mid = await pg.evaluate(() => { const b = document.getElementById('rr-staff-f-go'); return b ? { text: b.textContent, disabled: b.disabled } : null; });
    T('W1 while the backend is slow the button says "Working…" and cannot be pressed', mid && mid.text === 'Working…' && mid.disabled === true, mid);
    await pg.evaluate(() => { const b = document.getElementById('rr-staff-f-go'); if (b) { b.disabled = false; b.click(); } });   // even forced, a second press while the first runs sends nothing
    await pg.waitForTimeout(1800);
    const saves = await pg.evaluate(() => window.__relay.calls.filter(c => c === 'staff_save').length);
    T('W2 a second press while the first runs sends nothing — ONE save', saves === 1, saves);
    T('W3 …and the Owner is made and working', (await whoName(pg)) === 'Brad' && (await pg.evaluate(() => window.__relay.people.length)) === 1);
    await pg.evaluate(() => { window.__relay.delay = 0; window.__relay.down = true; });
    await pg.fill('#rr-staff-a-name', 'Sue'); await pg.fill('#rr-staff-a-pin', '6204');
    await pg.click('#rr-staff-a-go'); await pg.waitForTimeout(300);
    const after = await pg.evaluate(() => { const b = document.getElementById('rr-staff-a-go'); return { text: b.textContent, disabled: b.disabled }; });
    T('W4 a failed call gives the button back (its own words, pressable)', after.text === 'Add person' && after.disabled === false, after);
    T('W5 no page errors', errs.length === 0, errs);
    await pg.close();
  }

  console.log('\n== R · an Owner who forgot their PIN ==');
  {
    const { pg, errs } = await world(browser);
    await setUp(pg);
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(150);
    T('R1 the PIN screen offers "Owner forgot their PIN?"', await pg.evaluate(() => !!document.getElementById('rr-staff-forgot') && document.getElementById('rr-staff-forgot').textContent === RR_STAFF.words.forgot));
    await pg.click('#rr-staff-forgot'); await pg.waitForTimeout(200);
    const s1 = await pg.evaluate(() => (document.getElementById('rr-staff-reset') || {}).textContent || '');
    T('R2 it says where the code goes before sending anything', /business’s Google account/.test(s1) && (await pg.evaluate(() => window.__relay.mail.length)) === 0, s1);
    await pg.click('#rr-staff-r-send'); await pg.waitForTimeout(300);
    const s2 = await pg.evaluate(() => ({ t: document.getElementById('rr-staff-reset').textContent, who: document.getElementById('rr-staff-r-who').value, opts: document.querySelectorAll('#rr-staff-r-who option').length }));
    T('R3 code sent: it says where (masked), for the only Owner, Brad', /sh•••@example.test/.test(s2.t) && /New PIN for Brad/.test(s2.t) && s2.opts === 0, s2);
    await pg.click('#rr-staff-r-code'); await pg.keyboard.type('000000');
    await pg.click('#rr-staff-r-pin'); await pg.keyboard.type('5937');
    const typed = await pg.evaluate(() => ({ c: document.getElementById('rr-staff-r-code').value, p: document.getElementById('rr-staff-r-pin').value, dots: _rrStaffState().who }));
    T('R4 typing in the reset box goes into the box (the PIN screen behind does not swallow the keys)', typed.c === '000000' && typed.p === '5937', typed);
    await pg.click('#rr-staff-r-go'); await pg.waitForTimeout(300);
    T('R5 a wrong code → "That code isn’t right", nothing changed', await pg.evaluate(() => window.__toasts.slice(-1)[0] === RR_STAFF.words.errors.wrong_code && window.__relay.people[0].pin === '4826'));
    await pg.fill('#rr-staff-r-code', '482913');
    await pg.fill('#rr-staff-r-pin', '1234');
    await pg.click('#rr-staff-r-go'); await pg.waitForTimeout(300);
    T('R6 an easy new PIN is refused before anything is sent', await pg.evaluate(() => window.__toasts.slice(-1)[0] === RR_STAFF.words.errors.pin_easy && window.__relay.calls.filter(c => c === 'staff_reset_pin').length === 1));
    await pg.fill('#rr-staff-r-pin', '5937');
    await pg.click('#rr-staff-r-go'); await pg.waitForTimeout(400);
    const done = await pg.evaluate(() => ({ who: (rrStaffNow() || {}).name, reset: !!document.getElementById('rr-staff-reset'), pin: !!document.getElementById('rr-staff-pin'), toast: window.__toasts.slice(-1)[0], relayPin: window.__relay.people[0].pin }));
    T('R7 the right code + a good PIN → the new PIN is set and the Owner is straight in', done.who === 'Brad' && !done.reset && !done.pin && done.relayPin === '5937' && /new PIN is 5937/.test(done.toast), done);
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(150);
    await typePin(pg, '5937');
    T('R8 later, the new PIN works from this device\'s copy', (await whoName(pg)) === 'Brad');
    await pg.evaluate(() => { rrStaffLock('locked'); window.__relay.people.push({ id: 'p9', name: 'Ann', role: 'owner', pin: '3816', on: true }); });
    await pg.evaluate(() => rrStaffRefresh()); await pg.waitForTimeout(200);
    await pg.click('#rr-staff-forgot'); await pg.click('#rr-staff-r-send'); await pg.waitForTimeout(300);
    const two = await pg.evaluate(() => Array.from(document.querySelectorAll('#rr-staff-r-who option')).map(o => o.textContent));
    T('R9 with two Owners it asks which — and offers Owners only (never Staff or a Manager)', JSON.stringify(two) === JSON.stringify(['Brad', 'Ann']), two);
    T('R10 no page errors', errs.length === 0, errs);
    await pg.close();
  }

  console.log('\n== L · relay v5.6: the reset email refused (5 a day, the email allowance low, the send failed) ==');
  {
    const { pg, errs } = await world(browser);
    await setUp(pg);
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(150);
    const sendWord = await pg.evaluate(() => RR_STAFF.words.forgotSend);
    const tryOne = async (status, message) => {
      await pg.evaluate(([s, m]) => { window.__relay.resetAnswer = { status: s, message: m }; }, [status, message]);
      if (!(await pg.$('#rr-staff-reset'))) { await pg.click('#rr-staff-forgot'); await pg.waitForTimeout(200); }
      await pg.click('#rr-staff-r-send'); await pg.waitForTimeout(300);
      return pg.evaluate((m) => { const b = document.getElementById('rr-staff-r-send');
        return { toast: window.__toasts.slice(-1)[0], want: (RR_STAFF.words.errors || {})[m], btn: b ? { text: b.textContent, disabled: b.disabled } : null,
                 stillAsking: !!document.getElementById('rr-staff-reset') && !document.getElementById('rr-staff-r-code') }; }, message);
    };
    const a = await tryOne(429, 'too_many_today');
    T('L1 5 a day reached → its own words (try tomorrow), not the plain failure words', !!a.want && a.toast === a.want && /tomorrow/.test(a.toast), a);
    T('L2 …the box stays on "Email me a code" and the button is given back', a.stillAsking && !!a.btn && a.btn.disabled === false && a.btn.text === sendWord, { a, sendWord });
    const b = await tryOne(429, 'mail_full');
    T('L3 the email allowance low → its own words (paused for today)', !!b.want && b.toast === b.want && /tomorrow/.test(b.toast), b);
    const c = await tryOne(503, 'mail_failed');
    T('L4 the send failed → its own words (try again in a moment), the button given back', !!c.want && c.toast === c.want && !!c.btn && c.btn.disabled === false, c);
    await pg.evaluate(() => { delete window.__relay.resetAnswer; });
    await pg.click('#rr-staff-r-send'); await pg.waitForTimeout(300);
    T('L5 asked again once the relay sends → the code step opens as before', await pg.evaluate(() => !!document.getElementById('rr-staff-r-code')));
    // PLANTED: the words line removed → the plain failure words come back
    await pg.evaluate(() => { delete RR_STAFF.words.errors.too_many_today; window.__relay.resetAnswer = null; });
    await pg.evaluate(() => { const x = document.getElementById('rr-staff-reset'); if (x && x.parentNode) x.parentNode.removeChild(x); rrStaffLock('locked'); }); await pg.waitForTimeout(150);
    const gone = await tryOne(429, 'too_many_today');
    const plain = await pg.evaluate(() => RR_STAFF.words.failed);
    T('L6 PLANTED: the too_many_today words removed → the plain failure words come back — caught (L1 expects its own words)', !!plain && gone.toast === plain && gone.toast !== a.want && !gone.want, { gone, plain });
    T('L7 no page errors', errs.length === 0, errs);
    await pg.close();
  }

  console.log('\n== K · the keyboard on the PIN screen ==');
  {
    const { pg } = await world(browser);
    await setUp(pg);
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(150);
    await pg.keyboard.type('4826'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
    T('K1 digits and Enter typed on the keyboard', (await whoName(pg)) === 'Brad');
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(150);
    for (const d of '6204') await pg.click('#rr-staff-pin [data-pin-key="' + d + '"]');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
    T('K2 digits tapped, then the keyboard\'s Enter', (await whoName(pg)) === 'Sue');
    await pg.evaluate(() => { const i = document.createElement('input'); i.id = 'behind'; document.body.appendChild(i); i.focus(); rrStaffLock('locked'); });
    await pg.waitForTimeout(150);
    await pg.keyboard.type('7391'); await pg.keyboard.press('NumpadEnter'); await pg.waitForTimeout(300);
    T('K3 a field left focused behind the PIN screen takes nothing; the number pad\'s Enter works', (await whoName(pg)) === 'Mike' && (await pg.evaluate(() => document.getElementById('behind').value)) === '');
    await pg.close();
  }

  console.log('\n== S · the smaller things ==');
  {
    const { pg, errs } = await world(browser);
    await setUp(pg);
    await pg.evaluate(() => { try { buildDashboard(); } catch (e) {} showPage('dashboard'); });
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(100);
    await typePin(pg, '6204');
    const g = await pg.evaluate(() => (document.getElementById('dash-greeting') || {}).textContent || '');
    T('S1 the greeting names the person working (Sue), not the account', /, Sue$/.test(g.trim()), g);
    const sheet = await pg.evaluate(() => ({ greet: rrGreetName(), title: (typeof rrCollectionTitle === 'function') ? rrCollectionTitle() : '', file: (typeof _getPersonalSheetName === 'function') ? _getPersonalSheetName() : '' }));
    T('S1b …but the business\'s SHEET keeps the account\'s name (never "Sue\'s Collection") — the independent review\'s finding', !/Sue/.test(JSON.stringify(sheet)) && /Biz/.test(sheet.greet), sheet);
    const planted = await pg.evaluate(() => {
      const keep = window.rrGreetName;
      window.rrGreetName = function () { var w = rrStaffNow(); return w ? w.name : keep(); };   // the first build's change
      const t = (typeof _getPersonalSheetName === 'function') ? _getPersonalSheetName() : '';
      window.rrGreetName = keep; return t;
    });
    T('S1c PLANTED: the staff name put into rrGreetName → the sheet name becomes Sue\'s — caught by S1b\'s check', /Sue/.test(planted), planted);
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(100);
    await typePin(pg, '4826');
    await pg.evaluate(() => { showPage('prefs'); buildPrefsPage(); });
    await pg.waitForTimeout(200);
    const ownerSees = await pg.evaluate(() => !!document.getElementById('rr-staff-prefs-row'));
    await pg.evaluate(() => rrStaffLock('locked')); await pg.waitForTimeout(100);
    await typePin(pg, '6204');
    const sueSees = await pg.evaluate(() => ({ staffRow: !!document.getElementById('rr-staff-prefs-row'), inv: /data-inv-own|own invoices/i.test(document.getElementById('prefs-content').innerHTML) }));
    T('S2 Preferences is drawn again when Sue takes over: the Owner\'s Business tools are gone', ownerSees && !sueSees.staffRow && !sueSees.inv, { ownerSees, sueSees });
    await pg.evaluate(() => { window.__toasts = []; });
    await pg.evaluate(() => rrUnarchiveGo('S7', null));
    await pg.waitForTimeout(300);
    const t = await pg.evaluate(() => window.__toasts.slice());
    T('S3 Sue presses Un-archive: "Sue can’t do that — ask a manager" and NOT "check your connection"', t.length === 1 && /Sue can’t do that/.test(t[0]), t);
    T('S4 no page errors', errs.length === 0, errs);
    await pg.close();
  }
}

function guards(planted) {
  console.log('\n== G · source guards ==');
  const st = read('staff.js');
  T('G1 every new relay call is a signed-in call', ['staff_who', 'staff_reset_code', 'staff_reset_pin'].every(a => /IDENTITY_ACTIONS: \[[\s\S]*?\]/.exec(read('vault.js'))[0].indexOf("'" + a + "'") >= 0));
  T('G2 the three new calls are written out in staff.js (relay_proof_tests reads them)', ["vaultPost({ action: 'staff_who', pin: body.pin })", "vaultPost({ action: 'staff_reset_code' })", "vaultPost({ action: 'staff_reset_pin', code: body.code, id: body.id, pin: body.pin })"].every(x => st.indexOf(x) >= 0));
  T('G3 the app still never calls staff_support_reset', fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f)).every(f => read(f).indexOf("'staff_support_reset'") < 0));
  // every caller of a gated action that reports a failure first lets the roles door speak
  const WRAPPERS = { 'collections-archive.js': ['rrArchiveGo', 'rrArchiveReturnGo', 'rrUnarchiveGo', 'rrDeleteGo', 'rrRestoreGo'],
                     'collections-handover.js': ['rrHandOverSend', 'rrHandOverCancelGo', 'rrHandOverKeepGo', 'rrHandOverRemoveGo'],
                     'collections-invoice.js': ['rrInvMake', 'rrInvPaidGo', 'rrInvVoidGo'], 'collections-move.js': ['rrMoveFinish'] };
  const body = (src, fn) => { const i = src.indexOf('function ' + fn + '('); if (i < 0) return null; const j = src.indexOf('\n  function ', i + 10); return src.slice(i, j < 0 ? undefined : j); };
  const misses = (srcOf) => [].concat(...Object.keys(WRAPPERS).map(f => WRAPPERS[f].filter(fn => { const b = body(srcOf(f), fn); return !b || b.indexOf('rrStaffRefused(r)') < 0; }).map(fn => f + ':' + fn)));
  T('G4 every caller that shows "try again" first lets the roles door speak (' + Object.values(WRAPPERS).reduce((n, a) => n + a.length, 0) + ' callers)', misses(read).length === 0, misses(read));
  const plant = f => f === 'collections-archive.js' ? read(f).replace("      if (typeof rrStaffRefused === 'function' && rrStaffRefused(r)) return r;   // the roles door already said who to ask (2026-11-13)\n      if (!r.ok) { toast(W('unarchiveFailed')", "      if (!r.ok) { toast(W('unarchiveFailed')") : read(f);
  T('G4b PLANTED: the check removed from rrUnarchiveGo → caught', misses(plant).indexOf('collections-archive.js:rrUnarchiveGo') >= 0);
  T('G5 PLANTED: the relay NOT asked when the copy knows no one → the live fault comes back (F1 goes red)', planted.name !== 'Brad' && /isn’t right/.test(planted.msg), planted);
  T('G6 the new words live in RR_STAFF.words (config.js)', ['working', 'forgot', 'forgotTitle', 'forgotHelp', 'forgotSend', 'forgotSent', 'forgotCode', 'forgotNewPin', 'forgotGo', 'forgotDone'].every(k => new RegExp('\\n    ' + k + ': ').test(read('config.js'))));
  T('G8 relay v5.6 words live in RR_STAFF.words.errors (config.js)', ['too_many_today', 'mail_full', 'mail_failed'].every(k => new RegExp('\\n      ' + k + ': ').test(read('config.js'))));
  T('G7 no "AI" in the new words', !/\bAI\b/.test(read('config.js').slice(read('config.js').indexOf('const RR_STAFF = {'), read('config.js').indexOf('window.RR_STAFF = RR_STAFF'))));
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let planted = { name: '?', msg: '' };
  try {
    await run(browser);
    const src = read('staff.js');
    const cut = src.replace("      if (!p && !_offline()) {\n        var w = await _post({ action: 'staff_who', pin: pin });", "      if (false) {\n        var w = await _post({ action: 'staff_who', pin: pin });");
    if (cut === src) planted = { name: 'the planted copy did not change anything', msg: '' };
    else planted = (await fault(browser, cut)).r;
  } catch (e) { T('the run itself', false, e && e.stack); }
  await browser.close();
  guards(planted);
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  staff_owner_fix_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
