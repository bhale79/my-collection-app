// ══ tests/feature_rings_tests.js ═══════════════════════════════════════════
// v0.9.1891 (launch build, release 1). Brad, 2026-10-06: "beta a gets certain
// things beta b doesn't" — beta levels are TEST RINGS: a feature goes to
// Beta A, then Beta B, then everyone. WHO gets WHAT is the `features` tab of
// the Vault sheet; relay v4.1 hands each person their list in sub_check.
//
// What this suite pins:
//   1. rrFeatureOn (config.js) is the ONE reader — owner yes, recording mode
//      no, the backend's list, and this account's remembered list before the
//      answer arrives (never another account's).
//   2. Maintenance is gated on rrFeatureOn('maintenance') — no typed tester
//      email anywhere in the code (it was browntailflyer, hardcoded).
//   3. The Workbench boot waits for the backend's answer instead of giving up
//      on the first look, and follows a later answer (rr:substate).
//   4. subCheck remembers the list and announces the answer.
//   5. Preferences "My Subscription" says the right thing for every state,
//      links to Stripe with the email filled in, and never types the price.
// Every source check is proven able to fail on a planted offender (§6).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), maint = rd('maintenance.js'), vault = rd('vault.js'), prefs = rd('prefs.js');

// slice "function NAME(" … up to the next top-level "\nfunction " / "\nif (typeof window"
function sliceFn(src, name) {
  const a = src.indexOf('function ' + name + '(');
  if (a < 0) return '';
  const rest = src.slice(a + 10);
  const m = rest.search(/\n(function |if \(typeof window|const |let |var |\/\/ ──)/);
  return src.slice(a, a + 10 + (m < 0 ? rest.length : m));
}

// ── 1. rrFeatureOn ────────────────────────────────────────────────────────
console.log('1. rrFeatureOn — the one reader');
function cfgEnv(email, subState, store, recording) {
  const ls = Object.assign({}, store || {});
  const ctx = {
    window: {}, JSON, String, Array, Date,
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
  };
  ctx.window.state = { user: email ? { email } : null };
  ctx.window._subState = subState || null;
  vm.createContext(ctx);
  const code = [
    "const RR_OWNER_EMAILS = ['bhale@ipd-llc.com', 'support@therailroster.com'];",
    'function rrRecordingMode() { return ' + (recording ? 'true' : 'false') + '; }',
    sliceFn(cfg, 'rrIsRealOwner'),
    cfg.slice(cfg.indexOf('const RR_FEATURES_CACHE_KEY'), cfg.indexOf('// ── PRICE WORDING')),
  ].join('\n');
  vm.runInContext(code, ctx);
  return { on: n => ctx.window.rrFeatureOn(n), remember: r => ctx.window.rrFeaturesRemember(r), ls };
}
ok('config.js defines rrFeatureOn, rrFeatureList, rrFeaturesRemember and puts them on window',
  /function rrFeatureOn\(/.test(cfg) && /window\.rrFeatureOn = rrFeatureOn/.test(cfg)
  && /window\.rrFeaturesRemember = rrFeaturesRemember/.test(cfg));
ok('owner always sees a feature, even with no backend answer', cfgEnv('BHALE@ipd-llc.com', null).on('maintenance') === true);
ok('second owner address too', cfgEnv('support@therailroster.com', null).on('anything') === true);
ok('recording mode hides it even from the owner', cfgEnv('bhale@ipd-llc.com', null, null, true).on('maintenance') === false);
ok('Beta A (backend list has it) → on', cfgEnv('browntailflyer@gmail.com', { sub: 'beta', level: 'A', features: ['maintenance'] }).on('maintenance') === true);
ok('Beta B (backend list empty) → off', cfgEnv('benjamin.hale@gmail.com', { sub: 'beta', level: 'B', features: [] }).on('maintenance') === false);
ok('a stranger with no answer and no memory → off', cfgEnv('x@y.com', null).on('maintenance') === false);
ok('signed out → off', cfgEnv('', null).on('maintenance') === false);
{
  const e = cfgEnv('browntailflyer@gmail.com', null);
  e.remember({ features: ['maintenance'] });
  ok('rrFeaturesRemember stores the list WITH the email', /"email":"browntailflyer@gmail.com"/.test(e.ls.rr_features_v1 || ''), e.ls);
  ok('…and before the next answer arrives, that same account gets it from memory',
    cfgEnv('browntailflyer@gmail.com', null, e.ls).on('maintenance') === true);
  ok('…but a DIFFERENT person on the same browser never inherits it',
    cfgEnv('someone.else@gmail.com', null, e.ls).on('maintenance') === false);
  ok('…and a fresh backend answer always beats the memory (moved out of the ring)',
    cfgEnv('browntailflyer@gmail.com', { sub: 'beta', features: [] }, e.ls).on('maintenance') === false);
}
ok('a corrupt memory does not throw', cfgEnv('a@b.com', null, { rr_features_v1: '{oops' }).on('maintenance') === false);

// ── 2. Maintenance gate ───────────────────────────────────────────────────
console.log('2. Maintenance follows the features tab');
const isOwnerSrc = maint.slice(maint.indexOf('function _isOwner()'), maint.indexOf('window._maintIsOwner = _isOwner;'));
const noTypedTesters = s0 => { const s = s0.replace(/\/\/.*$/gm, ''); return !/BETA_EMAILS\s*:/.test(s) && !/BETA_EMAILS\.indexOf/.test(s) && !/'[a-z0-9._-]+@gmail\.com'/i.test(s); };   // code only — comments may name the old list
ok('maintenance.js has no typed tester list (no BETA_EMAILS, no @gmail.com address in code)', noTypedTesters(maint));
ok('_isOwner asks rrFeatureOn(\'maintenance\')', /rrFeatureOn\('maintenance'\)/.test(isOwnerSrc));
ok('_isOwner still vetoes recording mode BEFORE anything else', /rrRecordingMode\(\)\) return false;[\s\S]*OWNER_EMAILS\.indexOf[\s\S]*rrFeatureOn/.test(isOwnerSrc));
{
  // run the real _isOwner
  const run = (email, featureOn) => {
    const ctx = { window: { rrRecordingMode: () => false, rrFeatureOn: n => featureOn && n === 'maintenance' }, String };
    ctx.window.state = { user: email ? { email } : null }; ctx.state = ctx.window.state;
    vm.createContext(ctx);
    vm.runInContext("var MAINT = { OWNER_EMAILS: ['bhale@ipd-llc.com','support@therailroster.com'] };\n" + isOwnerSrc + '\nwindow.f = _isOwner;', ctx);
    return ctx.window.f();
  };
  ok('RUN: owner → yes', run('bhale@ipd-llc.com', false) === true);
  ok('RUN: tester in the maintenance ring → yes', run('browntailflyer@gmail.com', true) === true);
  ok('RUN: tester not in the ring → no', run('browntailflyer@gmail.com', false) === false);
  ok('RUN: signed out → no', run('', true) === false);
}
ok('the Workbench boot waits for the answer (stands down only once _subState is in)',
  /if \(!_isOwner\(\)\) \{ if \(window\._subState\) clearInterval\(t\); return; \}/.test(maint));
ok('…and follows a later answer (rr:substate adds or removes the Workbench button)',
  /addEventListener\('rr:substate'[\s\S]{0,200}_wbInjectUI\(\)[\s\S]{0,200}nav-workbench-btn/.test(maint));

// ── 3. subCheck ───────────────────────────────────────────────────────────
console.log('3. subCheck remembers and announces');
const sc = vault.slice(vault.indexOf('async function subCheck()'), vault.indexOf('function _subApply('));
ok('subCheck remembers the feature list after setting _subState', /window\._subState = r;[\s\S]{0,300}rrFeaturesRemember\(r\)/.test(sc));
ok('subCheck announces rr:substate after applying', /_subApply\(r\);[\s\S]{0,200}dispatchEvent\(new CustomEvent\('rr:substate'/.test(sc));
ok('v0.9.1904: a bad answer goes to the grace period (_subNoAnswer) and returns before any of it', /if \(!r \|\| r\.status !== 200 \|\| !r\.sub\) \{ _subNoAnswer\(\); return; \}/.test(sc));

// ── 4. Preferences "My Subscription" ──────────────────────────────────────
console.log('4. Preferences — My Subscription');
const rowSrc = sliceFn(prefs, '_prefsSubRowHtml');
function row(s) {
  const ctx = { window: { _subState: s }, state: { user: { email: 'Pat.Doe@gmail.com' } }, String, encodeURIComponent,
                RR_PRICE_TEXT: '$75/year plus tax', _formatDate: iso => 'D(' + iso + ')', _formatDateLong: iso => 'D(' + iso + ')' };
  vm.createContext(ctx);
  vm.runInContext(rowSrc + '\nwindow.f = _prefsSubRowHtml;', ctx);
  return ctx.window.f();
}
const PORTAL = 'https://billing.stripe.com/p/login/xyz';
ok('nothing until the answer arrives', row(null) === '');
ok('never-subscribed shows nothing here', row({ sub: 'none', portalLink: PORTAL }) === '');
{
  const h = row({ sub: 'beta', freeUntil: '2027-10-31', portalLink: PORTAL });
  ok('beta: free-until date, and NO Manage button', /Beta tester — free until D\(2027-10-31\)/.test(h) && !/Manage/.test(h), h);
}
{
  const h = row({ sub: 'trial', trialEnds: '2026-10-28', portalLink: PORTAL });
  ok('trial: end date and the price', /Free trial — ends D\(2026-10-28\)\. Then \$75\/year plus tax\./.test(h), h);
  ok('trial: Manage links to Stripe with the email filled in', h.indexOf(PORTAL + '?prefilled_email=Pat.Doe%40gmail.com') >= 0, h);
}
ok('trial cancelled: says they will not be charged', /will not be charged/.test(row({ sub: 'trial', trialEnds: '2026-10-28', cancelAtPeriodEnd: true, portalLink: PORTAL })));
ok('paid: renews date and price', /Renews D\(2027-10-06\) — \$75\/year plus tax\./.test(row({ sub: 'active', paidThrough: '2027-10-06', portalLink: PORTAL })));
ok('paid but cancelled: paid through, will not renew', /Paid through D\(2027-10-06\)\. You cancelled, so it will not renew\./.test(row({ sub: 'active', paidThrough: '2027-10-06', cancelAtPeriodEnd: true, portalLink: PORTAL })));
ok('ended: says so, still offers Manage', /has ended/.test(row({ sub: 'expired', portalLink: PORTAL })) && /Manage/.test(row({ sub: 'expired', portalLink: PORTAL })));
ok('no portal link from the backend → no button, no broken link', !/Manage/.test(row({ sub: 'active', paidThrough: '2027-10-06' })));
ok('HTML in a value is escaped', !/<script>/.test(row({ sub: 'active', paidThrough: '<script>', portalLink: PORTAL })));
ok('the row sits in the Account section and fills in when the answer arrives',
  /id="pref-sub-row"/.test(prefs) && /addEventListener\('rr:substate'[\s\S]{0,200}pref-sub-row/.test(prefs));
const priceTyped = s => /\$75|\$60/.test(s);
ok('prefs.js never types the price (RR_PRICE_TEXT in config.js is the one place)', !priceTyped(prefs));
ok('config.js holds the price wording', /const RR_PRICE_TEXT\s*=\s*'\$75\/year plus tax'/.test(cfg) && /const RR_SHOW_PRICE_TEXT\s*=\s*'\$60 first year plus tax'/.test(cfg));

// ── 5. the remembered list is account data — cleared at sign-out ─────────
console.log('5. sign-out');
ok('rr_features_v1 is NOT on the sign-out keep list (it is account data)', !/'rr_features_v1'/.test(cfg.slice(cfg.indexOf('const SIGNOUT_KEEP_KEYS'), cfg.indexOf('const SIGNOUT_KEEP_PREFIXES'))));

// ── 6. the checks can fail ────────────────────────────────────────────────
console.log('6. planted offenders');
ok('PLANTED: a typed tester list is caught', !noTypedTesters("var MAINT = { BETA_EMAILS: ['someone@gmail.com'] };"));
ok('PLANTED: a typed email inside _isOwner is caught', !noTypedTesters("if (em === 'browntailflyer@gmail.com') return true;"));
ok('PLANTED: a typed price is caught', priceTyped("line = 'Then $75/year';"));
ok('PLANTED: a row that drops the email from the Stripe link fails the link check',
  ('<a href="' + PORTAL + '">').indexOf(PORTAL + '?prefilled_email=') < 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
