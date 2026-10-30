#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PRO LEVEL AND ITS SWITCH — v0.9.2040 (TRR Pro, release 2)
//                                              (real Chromium, the REAL app)
// Brad, 2026-10-28: Pro is the SAME app with the business features switched
// on — "lets do those four changes":
//   1. which plan and which test ring are TWO settings  (relay v4.9: the
//      features tab's plan column — relay_v49_tests.js holds that half)
//   2. the Pro product's Stripe ID typed ONCE            (relay v4.9 config cell)
//   3. a backend outage never locks a business out       (§B here)
//   4. a guard test fails if anything checks "is this Pro?" any other way (§D)
//   A  rrPlan(): the backend's answer, else this account's remembered answer
//      on this device (never another account's), else regular; recording
//      mode is regular
//   B  outage: a Pro business keeps its Pro features and its plan when the
//      backend throws, answers 503 with payments on (inside the grace), or
//      answers 503 before enforcement
//   C  My Subscription says "Pro" — and never quotes the regular price to a
//      Pro account; expired says nothing about Pro; recording mode never Pro
//   D  scan: rrPlan() is read ONLY by My Subscription; nothing compares a plan
//      to 'pro' outside config.js; PLANTED offenders in two files are caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  pro_switch_2040_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }

// ── D · the scan ────────────────────────────────────────────────────────────
// Allowed: config.js (the definitions), prefs.js may call rrPlan() for the
// My Subscription words. Anything else that asks "is this Pro?" is a second
// way of switching a feature on — it must go through rrFeatureOn('name').
function scan(overrides) {
  const bad = [];
  fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => {
    if (f === 'config.js') return;
    const src = (overrides && overrides[f]) || fs.readFileSync(path.join(APP, f), 'utf8');
    src.split('\n').forEach((ln, i) => {
      if (/^\s*\/\//.test(ln)) return;
      const code = ln.replace(/\/\/.*$/, '');
      const where = f + ':' + (i + 1) + '  ' + ln.trim();
      if (/\brrPlan\s*\(/.test(code) && f !== 'prefs.js') bad.push(where);
      if (/\.plan\b\s*(===|!==|==|!=)|(===|!==|==|!=)\s*[\w$.]*\.plan\b/.test(code)) bad.push(where);
      if (/(===|!==|==|!=)\s*['"]pro['"]|['"]pro['"]\s*(===|!==|==|!=)/i.test(code)) bad.push(where);
      if (/\bRR_PLAN_PRO\b/.test(code) && f !== 'prefs.js') bad.push(where);
    });
  });
  return bad;
}

function plantedVault() {
  const s = fs.readFileSync(path.join(APP, 'vault.js'), 'utf8');
  const out = s.replace("'features', 'plan', 'payLink'", "'features', 'payLink'");
  if (out === s) throw new Error('planted vault.js: the kept-answer list moved; update this test');
  return out;
}
async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (planted && planted.vault && u.split('?')[0].endsWith('/app/vault.js')) return r.fulfill({ body: planted.vault, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    state.user = { email: 'auction@example.com', name: 'Test Auction House' };
    window._offlineMode = false; window._subState = null; window._readOnlyMode = false;
    window.__screens = []; window._subScreen = function (k) { window.__screens.push(k); };
    window._subApply = function () {};
  });
  return { pg, errs };
}

const PRO_ANSWER = { status: 200, sub: 'active', plan: 'pro', enforce: true, level: '', features: ['shelf_pro', 'maintenance'],
                     paidThrough: '2027-08-01', portalLink: 'https://billing.example/p' };

(async () => {
  console.log('== D · scan: nothing asks "is this Pro?" except My Subscription ==');
  const clean = scan();
  T('D1 no file but config.js / prefs.js reads the plan', clean.length === 0, clean);
  const ss = fs.readFileSync(path.join(APP, 'scan-shelve.js'), 'utf8') + '\nfunction _planted() { if (window._subState && window._subState.plan === \'pro\') return true; }\n';
  const p1 = scan({ 'scan-shelve.js': ss });
  T('D2 PLANTED: _subState.plan === \'pro\' in scan-shelve.js is caught', p1.some(b => /scan-shelve\.js/.test(b)), p1);
  const mt = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8') + '\nfunction _planted2() { return rrPlan() === RR_PLAN_PRO; }\n';
  const p2 = scan({ 'maintenance.js': mt });
  T('D3 PLANTED: rrPlan() in maintenance.js is caught', p2.some(b => /maintenance\.js/.test(b)), p2);
  const vsrc = fs.readFileSync(path.join(APP, 'vault.js'), 'utf8');
  T('D4 the last answer kept per account includes the plan (vault.js)', /\['sub', 'enforce', 'level', 'features', 'plan',/.test(vsrc));
  const csrc = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
  T('D5 the word "Pro" lives in config.js (RR_PLAN_WORDS), not typed in prefs.js', /const RR_PLAN_WORDS = \{ pro: 'Pro' \}/.test(csrc) && !/['"]Pro['"]/.test(fs.readFileSync(path.join(APP, 'prefs.js'), 'utf8')));

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('\n== A · rrPlan() ==');
  {
    const { pg, errs } = await boot(browser);
    const a = await pg.evaluate((PRO) => {
      const r = {};
      r.none = rrPlan();
      window._subState = Object.assign({}, PRO); r.pro = rrPlan();
      window._subState = Object.assign({}, PRO, { plan: 'regular' }); r.reg = rrPlan();
      window._subState = Object.assign({}, PRO, { plan: undefined }); r.missing = rrPlan();
      rrFeaturesRemember(PRO); window._subState = null;
      r.cached = rrPlan();
      r.store = JSON.parse(localStorage.getItem(RR_FEATURES_CACHE_KEY) || 'null');
      state.user = { email: 'someone.else@example.com' }; r.other = rrPlan();
      state.user = { email: 'auction@example.com' };
      localStorage.setItem(RR_RECORDING_MODE_KEY, '1'); r.recording = rrPlan(); localStorage.removeItem(RR_RECORDING_MODE_KEY);
      return r;
    }, PRO_ANSWER);
    T('A0 no script error', errs.length === 0, errs);
    T('A1 no answer, nothing remembered → regular', a.none === 'regular', a);
    T('A2 the backend says pro → pro; regular → regular; no plan (an old relay) → regular', a.pro === 'pro' && a.reg === 'regular' && a.missing === 'regular', a);
    T('A3 the remembered answer carries the plan', a.store && a.store.plan === 'pro' && a.store.email === 'auction@example.com', a.store);
    T('A4 before the answer arrives: this account\'s remembered plan', a.cached === 'pro', a);
    T('A5 ...never another account\'s on the same browser', a.other === 'regular', a);
    T('A6 recording mode is a new REGULAR member', a.recording === 'regular', a);
    await pg.close();
  }

  console.log('\n== B · a backend outage never locks a business out ==');
  for (const kind of ['throws', '503-enforced', '503-before-launch', 'PLANTED']) {
    const { pg, errs } = await boot(browser, kind === 'PLANTED' ? { vault: plantedVault() } : null);
    const b = await pg.evaluate(async (o) => {
      const PRO = o.PRO, kind = o.kind;
      window.vaultPost = async function () { return Object.assign({}, PRO, { enforce: kind !== '503-before-launch' }); };
      await subCheck();                                    // a good answer first
      const firstOk = rrFeatureOn('shelf_pro') && rrPlan() === 'pro';
      window._subState = null;                             // next open of the app
      window.vaultPost = kind === 'throws'
        ? async function () { throw new Error('network down'); }
        : async function () { return { status: 503, message: 'subscription check unavailable' }; };
      await subCheck();
      return { firstOk, shelf: rrFeatureOn('shelf_pro'), labs: rrFeatureOn('not_switched_on'), plan: rrPlan(),
               stale: !!(window._subState && window._subState.stale), screens: window.__screens.slice(), ro: !!window._readOnlyMode };
    }, { PRO: PRO_ANSWER, kind: kind === 'PLANTED' ? '503-enforced' : kind });
    if (kind === 'PLANTED') {
      T('B PLANTED: the plan left out of the kept answer → a 503 drops the business to regular (caught)', b.firstOk && b.plan === 'regular', b);
      await pg.close(); continue;
    }
    T('B ' + kind + ': no script error', errs.length === 0, errs);
    T('B ' + kind + ': the Pro business still has its Pro feature and its plan', b.firstOk && b.shelf && b.plan === 'pro', b);
    T('B ' + kind + ': ...and nothing else switched on, no lock screen, not read-only', !b.labs && b.screens.length === 0 && !b.ro, b);
    await pg.close();
  }

  console.log('\n== C · My Subscription ==');
  {
    const { pg, errs } = await boot(browser);
    const c = await pg.evaluate((PRO) => {
      const row = s => { window._subState = s; return (_prefsSubRowHtml() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
      const r = {};
      r.proActive = row(Object.assign({}, PRO));
      r.regActive = row(Object.assign({}, PRO, { plan: 'regular' }));
      r.proTrial = row({ sub: 'trial', plan: 'pro', trialEnds: '2026-11-15', portalLink: 'https://billing.example/p' });
      r.proBeta = row({ sub: 'beta', plan: 'pro', freeUntil: '2027-06-30' });
      r.regBeta = row({ sub: 'beta', plan: 'regular' });
      r.proExpired = row({ sub: 'expired', plan: 'pro' });
      r.proCancel = row(Object.assign({}, PRO, { cancelAtPeriodEnd: true }));
      localStorage.setItem(RR_RECORDING_MODE_KEY, '1'); r.recording = row(Object.assign({}, PRO)); localStorage.removeItem(RR_RECORDING_MODE_KEY);
      r.price = RR_PRICE_TEXT; r.word = RR_PLAN_WORDS.pro;
      return r;
    }, PRO_ANSWER);
    const has = (s, w) => String(s).indexOf(w) >= 0;
    T('C0 no script error', errs.length === 0, errs);
    T('C1 a Pro member sees "Pro — Renews …" and a Manage button', /^My Subscription Pro — Renews /.test(c.proActive) && has(c.proActive, 'Manage'), c.proActive);
    T('C2 ...and is NOT quoted the regular price', !has(c.proActive, c.price), c.proActive);
    T('C3 a regular member: unchanged — Renews … with the price, no "Pro"', has(c.regActive, 'Renews ') && has(c.regActive, c.price) && !has(c.regActive, 'Pro'), c.regActive);
    T('C4 a Pro trial: "Pro — Free trial — ends …", no regular price', has(c.proTrial, 'Pro — Free trial — ends') && !has(c.proTrial, c.price), c.proTrial);
    T('C5 a business made Pro by hand: "Pro — free until …", not "Beta tester"', has(c.proBeta, 'Pro — free until') && !has(c.proBeta, 'Beta tester'), c.proBeta);
    T('C6 a regular beta tester: unchanged', has(c.regBeta, 'Beta tester — free'), c.regBeta);
    T('C7 an ended subscription says nothing about Pro', has(c.proExpired, 'Your subscription has ended.') && !has(c.proExpired, 'Pro'), c.proExpired);
    T('C8 a Pro member who cancelled: "Pro — Paid through …"', has(c.proCancel, 'Pro — Paid through'), c.proCancel);
    T('C9 recording mode never shows Pro (a regular paying member)', !has(c.recording, 'Pro') && has(c.recording, c.price), c.recording);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
