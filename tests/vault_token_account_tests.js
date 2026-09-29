// ════════════════════════════════════════════════════════════════════════
// vault_token_account_tests.js — v0.9.1836
//
// ONE TICKET PER ACCOUNT, NOT PER DEVICE.
//
// [stated] Brad: "the phone says 18 photo ides left today and the pc says 20"
// → "its one shared count not per device".
//
// The relay counts daily photo-ID reads — and Collector's Market contributors
// — by the vault token, and every device used to make up its own. So two
// devices were two daily allowances and two contributors. Now the token and
// the Market opt-in travel through the account settings file like every
// other setting: the first device to sync seeds the account, every other
// device adopts (and tells the relay to drop its old ticket's rows), and both
// show one count. A made-up ticket is SEEDED (stamp 0 — the account may
// overrule it); a rotation after opt-out is SET (stamp now — every device
// must follow). These tests run the REAL functions, lifted from app.js,
// vault.js and drive.js; section G plants the old shapes and requires red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
const VAULT = fs.readFileSync(path.join(__dirname, '..', 'app', 'vault.js'), 'utf8');
const DRIVE = fs.readFileSync(path.join(__dirname, '..', 'app', 'drive.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
// a localStorage that is a plain object
function store(init) {
  const o = Object.assign({}, init || {});
  return {
    o,
    getItem: k => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null,
    setItem: (k, v) => { o[k] = String(v); },
    removeItem: k => { delete o[k]; },
    key: i => Object.keys(o)[i],
    get length() { return Object.keys(o).length; },
  };
}

// The doors (REAL, from app.js) + the token helpers (REAL, from vault.js) in one sandbox.
function build(opts) {
  opts = opts || {};
  const ls = store(opts.store);
  const pushes = [], posts = [];
  const sb = {
    console: { log() {}, warn() {}, error() {} },
    localStorage: ls,
    Date: { now: () => 5000000 },
    crypto: { getRandomValues: (a) => { sb.rnd = (sb.rnd || 0) + 1; for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11 * sb.rnd) % 256; return a; } },
    window: { rrPrefsQueuePush: k => pushes.push(k) },
    VAULT: { KEY_TOKEN: 'lv_vault_token', KEY_OPTIN: 'lv_vault_optin', KEY_LAST_SUB: 'lv_vault_last_sub', KEY_NF_SIG: 'lv_vault_nf_sig' },
    vaultPost: async (p) => { posts.push(p); return { status: 200 }; },
    rrAiQuotaRefresh: () => { sb.quotaRefreshed = (sb.quotaRefreshed || 0) + 1; },
  };
  sb.Array = Array;
  vm.createContext(sb);
  vm.runInContext('var _prefSeen = {};\n' + grab(APP, 'function _prefGet(key, def)') + '\n' + grab(APP, 'function _prefSet(key, val)') + '\n' + grab(APP, 'function _prefSeed(key, val)'), sb);
  const vsrc = opts.vaultSource || VAULT;
  vm.runInContext(grab(vsrc, 'function _vaultNewToken()') + '\n' + grab(vsrc, 'function vaultGetToken()') + '\n' + grab(vsrc, 'function vaultRotateToken()') + '\n'
    + grab(vsrc, 'function vaultIsOptedIn()') + '\n' + grab(vsrc, 'function vaultSetOptIn(value)') + '\n'
    + vsrc.slice(vsrc.indexOf('window.rrVaultTokenChanged = async function'), vsrc.indexOf('};', vsrc.indexOf('window.rrVaultTokenChanged = async function')) + 2)
    + '\nthis.get = vaultGetToken; this.rotate = vaultRotateToken; this.optedIn = vaultIsOptedIn; this.setOptIn = vaultSetOptIn; this.changed = window.rrVaultTokenChanged;', sb);
  sb.ls = ls; sb.pushes = pushes; sb.posts = posts;
  return sb;
}
// the REAL merge
const merge = new Function('PREF_AT_SUFFIX', grab(DRIVE, 'function rrPrefsMerge(local, stamps, remote, now)') + '\nreturn rrPrefsMerge;')('__at');

(async () => {
  section('A. The ticket goes through the doors');
  {
    const sb = build({ store: { lv_vault_token: 'abc123abc123', lv_vault_token__at: '4000' } });
    ok('a stored ticket is returned as is', sb.get() === 'abc123abc123');
    ok('…and nothing is written or pushed for it', sb.pushes.length === 0 && sb.ls.o.lv_vault_token__at === '4000');
    const legacy = build({ store: { lv_vault_token: 'legacy000000' } });
    legacy.get();
    ok('a LEGACY ticket (never synced) is stamped 0 by the reader and queued — the account\'s ticket, if any, will win', legacy.ls.o.lv_vault_token__at === '0' && legacy.pushes.indexOf('lv_vault_token') >= 0, JSON.stringify(legacy.ls.o));
    const fresh = build({});
    const t = fresh.get();
    ok('with no ticket at all one is made up: 12 characters', typeof t === 'string' && t.length === 12, t);
    ok('…SEEDED, not set: stored, stamped 0, pushed — the account may overrule it', fresh.ls.o.lv_vault_token === t && fresh.ls.o.lv_vault_token__at === '0' && fresh.pushes.indexOf('lv_vault_token') >= 0, JSON.stringify(fresh.ls.o));
    ok('…and the same ticket comes back on the next ask', fresh.get() === t);
    const r = fresh.rotate();
    ok('a ROTATION is set, not seeded: a new ticket stamped now, pushed — every device must follow', r !== t && r.length === 12 && fresh.ls.o.lv_vault_token === r && fresh.ls.o.lv_vault_token__at === '5000000', JSON.stringify(fresh.ls.o));
  }

  section('B. The merge (the REAL rrPrefsMerge): who wins');
  {
    // a brand-new device made up a ticket (stamp 0); the account already has one
    let m = merge({ lv_vault_token: 'newdevice000' }, { lv_vault_token: '0' }, { lv_vault_token: { v: 'account00000', t: 4000 } }, 5000000);
    ok('a fresh device\'s made-up ticket LOSES to the account\'s', m.apply.lv_vault_token === 'account00000' && !m.push.lv_vault_token, JSON.stringify(m));
    // a legacy device (stamped 0 by the reader) vs the account
    m = merge({ lv_vault_token: 'legacy000000' }, { lv_vault_token: '0' }, { lv_vault_token: { v: 'account00000', t: 4000 } }, 5000000);
    ok('a legacy device\'s ticket loses to the account\'s too', m.apply.lv_vault_token === 'account00000');
    // the very first device: the account has none
    m = merge({ lv_vault_token: 'first0000000' }, { lv_vault_token: '0' }, {}, 5000000);
    ok('the first device to sync SEEDS the account, dated then', m.push.lv_vault_token && m.push.lv_vault_token.v === 'first0000000' && m.push.lv_vault_token.t === 5000000, JSON.stringify(m.push));
    // a rotation (stamp now) beats the account's older ticket
    m = merge({ lv_vault_token: 'rotated00000' }, { lv_vault_token: '5000000' }, { lv_vault_token: { v: 'account00000', t: 4000 } }, 5000001);
    ok('a rotation after opt-out is pushed over the account\'s older ticket', m.push.lv_vault_token && m.push.lv_vault_token.v === 'rotated00000' && !m.apply.lv_vault_token, JSON.stringify(m));
    // the second device then follows the rotation
    m = merge({ lv_vault_token: 'account00000' }, { lv_vault_token: '4000' }, { lv_vault_token: { v: 'rotated00000', t: 5000000 } }, 5000002);
    ok('…and every other device follows it', m.apply.lv_vault_token === 'rotated00000');
    // a device signed out and back in: no local ticket, the account has one
    m = merge({}, {}, { lv_vault_token: { v: 'account00000', t: 4000 } }, 5000000);
    ok('a device with no ticket (signed out and back in) takes the account\'s', m.apply.lv_vault_token === 'account00000');
  }

  section('C. Adopting the account\'s ticket: the old one\'s rows go, the label follows');
  {
    const sb = build({ store: { lv_vault_last_sub: '123', lv_vault_nf_sig: 'sig' } });
    await sb.changed('olddevice000', 'account00000');
    ok('the relay is told to drop the OLD ticket\'s Market rows (one contributor, not two)', sb.posts.length === 1 && sb.posts[0].action === 'delete_token' && sb.posts[0].token === 'olddevice000', JSON.stringify(sb.posts));
    ok('the collection is due again under the shared ticket (last-submission and fingerprint cleared)', !('lv_vault_last_sub' in sb.ls.o) && !('lv_vault_nf_sig' in sb.ls.o), JSON.stringify(sb.ls.o));
    ok('the reads label is refreshed from the relay', sb.quotaRefreshed === 1);
    const sb2 = build({});
    await sb2.changed('same00000000', 'same00000000');
    await sb2.changed('', 'account00000');
    await sb2.changed('olddevice000', '');
    ok('nothing happens for the same ticket, an empty old one, or an empty new one', sb2.posts.length === 0 && !sb2.quotaRefreshed);
    const sb3 = build({ store: { lv_vault_last_sub: '123' } });
    sb3.vaultPost = async () => { throw new Error('offline'); };
    await sb3.changed('olddevice000', 'account00000');
    ok('a relay that cannot be reached does not stop the rest (fail-soft)', !('lv_vault_last_sub' in sb3.ls.o) && sb3.quotaRefreshed === 1);
  }

  section('D. The sync tells vault.js when the ticket changed');
  {
    const sync = DRIVE.slice(DRIVE.indexOf('window.rrPrefsSync = async function'), DRIVE.indexOf('window.rrPrefsQueuePush'));
    ok('the ticket is read BEFORE the merge is applied and compared AFTER', sync.indexOf("tokenBefore = localStorage.getItem('lv_vault_token')") > 0 && sync.indexOf("tokenBefore = localStorage.getItem('lv_vault_token')") < sync.indexOf('const touched = _prefsApply(m.apply);') && sync.indexOf('const touched = _prefsApply(m.apply);') < sync.indexOf("const tokenAfter = localStorage.getItem('lv_vault_token')"));
    ok('…and vault.js is told only when it really changed', /if \(tokenBefore && tokenAfter && tokenAfter !== tokenBefore && typeof window\.rrVaultTokenChanged === 'function'\) \{\n\s*window\.rrVaultTokenChanged\(tokenBefore, tokenAfter\);/.test(sync));
    // run the real sync with a stubbed file: local legacy ticket, account has another
    const ls = store({ lv_vault_token: 'legacy000000', lv_vault_token__at: '0', lv_dash_ticker: '1', lv_dash_ticker__at: '10' });
    const told = [];
    const sb = {
      console: { log() {}, warn() {} }, localStorage: ls, accessToken: 't',
      Date: { now: () => 5000000 }, Object, Array, JSON,
      window: { rrVaultTokenChanged: (a, b) => told.push([a, b]) },
      _prefsRead: async () => ({ ok: true, prefs: { lv_vault_token: { v: 'account00000', t: 4000 }, lv_dash_ticker: { v: '1', t: 10 } } }),
      _prefsRetire: () => false,
      _prefsWrite: async (p) => { sb.written = p; },
      PREF_AT_SUFFIX: '__at',
    };
    vm.createContext(sb);
    vm.runInContext(grab(DRIVE, 'function rrPrefsMerge(local, stamps, remote, now)') + '\n' + grab(DRIVE, 'function _prefsLocalState()') + '\n' + grab(DRIVE, 'function _prefsApply(apply)') + '\n' + sync, sb);
    await sb.window.rrPrefsSync();
    ok('a real sync: the device adopts the account\'s ticket', ls.o.lv_vault_token === 'account00000' && ls.o.lv_vault_token__at === '4000', JSON.stringify(ls.o));
    ok('…and vault.js is told old → new', told.length === 1 && told[0][0] === 'legacy000000' && told[0][1] === 'account00000', JSON.stringify(told));
    ok('…with nothing pushed (the account already had the answer)', !sb.written);
    const ls2 = store({ lv_vault_token: 'account00000', lv_vault_token__at: '4000' });
    sb.localStorage = ls2; told.length = 0;
    vm.runInContext('localStorage = this.localStorage;', sb);
    await sb.window.rrPrefsSync();
    ok('a device already on the account\'s ticket is not told anything', told.length === 0 && ls2.o.lv_vault_token === 'account00000');
  }

  section('E. The opt-in follows the account; the opt-out rotates for everyone');
  {
    const sb = build({});
    sb.setOptIn(true);
    ok('opting in is SET through the door (stamped now, pushed)', sb.ls.o.lv_vault_optin === 'true' && sb.ls.o.lv_vault_optin__at === '5000000' && sb.pushes.indexOf('lv_vault_optin') >= 0, JSON.stringify(sb.ls.o));
    ok('…and read through the door', sb.optedIn() === true);
    sb.setOptIn(false);
    ok('opting out is set the same way', sb.ls.o.lv_vault_optin === 'false' && sb.optedIn() === false);
    const out = grab(VAULT, 'async function vaultConfirmOptOut()');
    ok('the opt-out deletes the shared ticket\'s rows, then ROTATES through the door (every device follows)', /await vaultPost\(\{ action: 'delete_token', token \}\);/.test(out) && /vaultRotateToken\(\);/.test(out) && !/localStorage\.removeItem\(VAULT\.KEY_TOKEN\)/.test(out));
    ok('no raw localStorage write of the ticket or the opt-in is left in vault.js', !/localStorage\.setItem\(VAULT\.KEY_TOKEN/.test(VAULT) && !/localStorage\.setItem\(VAULT\.KEY_OPTIN/.test(VAULT) && !/localStorage\.getItem\(VAULT\.KEY_TOKEN/.test(VAULT) && !/localStorage\.getItem\(VAULT\.KEY_OPTIN/.test(VAULT));
    ok('the third door exists once, in app.js, and stamps 0', (APP.match(/function _prefSeed\(key, val\)/g) || []).length === 1 && /function _prefSeed\(key, val\) \{\n  localStorage\.setItem\(key, val\);\n  try \{ localStorage\.setItem\(key \+ '__at', '0'\); \}/.test(APP));
    ok('…and the ticket is the only thing seeded (a value the user chose is never seeded)', (fs.readdirSync(path.join(__dirname, '..', 'app')).filter(f => /\.js$/.test(f)).map(f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8')).join('\n').match(/_prefSeed\(/g) || []).length === 2);   // the definition + the one use
  }

  section('F. Sign-out still clears the ticket and the opt-in (they come back from the account)');
  {
    const sec = fs.readFileSync(path.join(__dirname, 'photo-inbox-tests.js'), 'utf8');
    ok('the sign-out never-keep list still names the opt-in as consent', /'lv_vault_optin', 'rr_ai_optout', 'lv_ai_consent',/.test(sec));
  }

  section('G. THE OFFENDERS, require red');
  {
    // 1. the ticket SET instead of SEEDED → a fresh device beats the account
    const o1 = VAULT.replace('_prefSeed(VAULT.KEY_TOKEN, token);', '_prefSet(VAULT.KEY_TOKEN, token);');
    ok('offender 1 changed the source', o1 !== VAULT);
    const sb1 = build({ vaultSource: o1 });
    const t1 = sb1.get();
    const m1 = merge({ lv_vault_token: t1 }, { lv_vault_token: sb1.ls.o.lv_vault_token__at }, { lv_vault_token: { v: 'account00000', t: 4000 } }, 5000001);
    ok('OFFENDER 1: stamped now, the newcomer\'s made-up ticket overrules the account\'s → B red', m1.push.lv_vault_token && m1.push.lv_vault_token.v === t1 && !m1.apply.lv_vault_token, JSON.stringify(m1));
    // 2. the sync hook removed → nobody is told
    const o2 = DRIVE.replace("window.rrVaultTokenChanged(tokenBefore, tokenAfter);", '');
    ok('offender 2 changed the source', o2 !== DRIVE);
    const sync2 = o2.slice(o2.indexOf('window.rrPrefsSync = async function'), o2.indexOf('window.rrPrefsQueuePush'));
    ok('OFFENDER 2: the old ticket\'s rows would stay → D red', !/window\.rrVaultTokenChanged\(tokenBefore, tokenAfter\)/.test(sync2));
    // 3. the ticket back to a raw write → per device again
    const o3 = VAULT.replace('_prefSeed(VAULT.KEY_TOKEN, token);', 'localStorage.setItem(VAULT.KEY_TOKEN, token);');
    ok('OFFENDER 3: a raw write of the ticket → E red', /localStorage\.setItem\(VAULT\.KEY_TOKEN/.test(o3));
    // 4. the adoption no longer deletes the old ticket
    const o4 = VAULT.replace("try { await vaultPost({ action: 'delete_token', token: oldToken }); } catch (e) {}", '');
    ok('offender 4 changed the source', o4 !== VAULT);
    const sb4 = build({ vaultSource: o4 });
    await sb4.changed('olddevice000', 'account00000');
    ok('OFFENDER 4: two contributors again → C red', sb4.posts.length === 0);
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
