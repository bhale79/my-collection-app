// ══ tests/launch_screens_tests.js ══════════════════════════════════════════
// v0.9.1892 (launch build, release 2). Brad's launch plan, 2026-10-06:
//   • Google sign-in FIRST, then payment — "we need to make sure no one can
//     get locked out": every checkout link carries the signed-in email, LOCKED.
//   • 3-week trial with the card at sign-up, $75/year plus tax; York show
//     special $60 first year (no trial) Oct 22–25.
//   • Lapsed = LOCKED: only Renew + links to their own sheet and photos.
//   • "add the how to get a gmail account help function" — a line under the
//     sign-in button straight to the create-a-Gmail steps.
//   • The invite screen goes away at launch: ONE switch (RR_INVITE_GATE_ON).
// Runs the REAL _subApply / _subScreen / subCheck from vault.js against a
// small fake page, for every answer the backend (relay v4.1/4.2) can give.
// §7 plants an offender for each source rule.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const vault = rd('vault.js'), cfg = rd('config.js'), auth = rd('app-auth.js'), setup = rd('app-setup.js'),
      data = rd('app-data.js'), onb = rd('onboarding-config.js');

// the subscription section of vault.js, from _subState to the window exports
const SUB = vault.slice(vault.indexOf('window._subState = null;'),
                        vault.indexOf("if (typeof window !== 'undefined') { window.subCheck = subCheck; window._subApply = _subApply; }"));

// ── a fake page ──────────────────────────────────────────────────────────
function page(opts) {
  opts = opts || {};
  const body = { children: [], appendChild(c) { this.children.push(c); c._parent = this; return c; } };
  function el(tag) {
    return {
      tagName: tag, id: '', style: {}, attrs: {}, children: [], innerHTML: '', textContent: '', href: '', onclick: null,
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); return c; },
      remove() { const p = this._parent; if (p) p.children = p.children.filter(x => x !== this); },
      get text() { return this.innerHTML + ' ' + this.textContent + ' ' + this.children.map(c => c.textContent + ' ' + c.href).join(' '); },
    };
  }
  const ss = Object.assign({}, opts.session || {});
  const timers = [], toasts = [], posts = [];
  const ctx = {
    console: { warn() {}, log() {} }, JSON, String, Number, Date, Math, encodeURIComponent, URLSearchParams,
    document: {
      body, createElement: el,
      getElementById: id => body.children.find(c => c.id === id) || null,
    },
    sessionStorage: { getItem: k => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); }, removeItem: k => { delete ss[k]; } },
    location: { search: opts.search || '', pathname: '/app/', hash: '' },
    history: { replaceState: (a, b, url) => { ctx._replaced = url; } },
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; },
    showToast: (m) => toasts.push(m),
    state: { user: { email: opts.email || 'pat.doe@gmail.com', name: 'Pat' }, personalSheetId: opts.sheetId === undefined ? 'SHEET123' : opts.sheetId },
    RR_PRICE_TEXT: '$75/year plus tax', RR_SHOW_PRICE_TEXT: '$60 first year plus tax', ADMIN_EMAIL: 'support@therailroster.com',
    ONBOARD_UI: { bodyFontPx: 18, headingFontPx: 28, buttonMinHeightPx: 52 },
    APP_VERSION: 'v0.9.1892',
    _formatDate: iso => 'D(' + iso + ')',
    rrIsRealOwner: () => !!opts.owner,
    vaultPost: async (p) => { posts.push(p); return opts.answer || { status: 200, sub: 'beta' }; },
    CustomEvent: function (n, d) { this.type = n; this.detail = d && d.detail; },
  };
  ctx.window = ctx;
  ctx.dispatchEvent = () => {};
  vm.createContext(ctx);
  vm.runInContext(SUB, ctx);
  return { ctx, body, ss, timers, toasts, posts,
    apply(r) { ctx._subApply(r); },
    screen() { return body.children.find(c => c.id === 'sub-screen') || null; },
    bar() { return body.children.find(c => c.id === 'sub-banner') || null; } };
}
const LINK = 'https://buy.stripe.com/14A28k3xJf37dJNfi62sM01';
const RENEW = 'https://buy.stripe.com/7sY28k7NZbQV7lpd9Y2sM02';
const SHOW = 'https://buy.stripe.com/7sY28k7NZbQV7lpd9Y2sM02?prefilled_promo_code=YORK2026';
const PORTAL = 'https://billing.stripe.com/p/login/xyz';
const base = (x) => Object.assign({ status: 200, enforce: true, payLink: LINK, renewLink: RENEW, portalLink: PORTAL, showMode: false }, x);

// ── 1. nobody is touched until launch, owners never ──────────────────────
console.log('1. enforcement off / owners');
for (const sub of ['none', 'expired', 'trial']) {
  const p = page(); p.apply(base({ sub, enforce: false, daysLeft: 2 }));
  ok('enforce off: "' + sub + '" shows nothing and blocks nothing', !p.screen() && !p.bar() && p.ctx._readOnlyMode === false);
}
{ const p = page({ owner: true }); p.apply(base({ sub: 'expired' }));
  ok('owner is never locked out, even enforced and expired', !p.screen() && p.ctx._readOnlyMode === false); }
for (const sub of ['beta', 'active']) {
  const p = page(); p.apply(base({ sub }));
  ok(sub + ': full app, no screen, no bar', !p.screen() && !p.bar() && p.ctx._readOnlyMode === false);
}

// ── 2. trial ──────────────────────────────────────────────────────────────
console.log('2. trial');
{ const p = page(); p.apply(base({ sub: 'trial', daysLeft: 12, trialEnds: '2026-10-28' }));
  ok('trial with 12 days left: no bar', !p.bar() && !p.screen()); }
{ const p = page(); p.apply(base({ sub: 'trial', daysLeft: 5, trialEnds: '2026-10-28' }));
  const b = p.bar();
  ok('trial in the last 7 days: a bar with the date and the price', b && /ends D\(2026-10-28\) — then your card is charged \$75\/year plus tax\./.test(b.text), b && b.text);
  ok('…the bar has a Manage link with the email filled in', b && b.children.some(c => c.href === PORTAL + '?prefilled_email=pat.doe%40gmail.com'));
  const close = b && b.children.find(c => c.textContent === 'Close');
  ok('…and a Close button that keeps it closed for this visit', !!close);
  close.onclick(); p.apply(base({ sub: 'trial', daysLeft: 5, trialEnds: '2026-10-28' }));
  ok('…closed stays closed', !p.bar());
  ok('trial is never read-only', p.ctx._readOnlyMode === false); }
{ const p = page(); p.apply(base({ sub: 'trial', daysLeft: 3, trialEnds: '2026-10-28', cancelAtPeriodEnd: true }));
  ok('cancelled trial: says they will not be charged', /will not be charged/.test(p.bar().text)); }

// ── 3. never subscribed → welcome ─────────────────────────────────────────
console.log('3. welcome');
{ const p = page(); p.apply(base({ sub: 'none' }));
  const s = p.screen(), h = s ? s.innerHTML : '';
  ok('"none" shows the welcome screen', !!s && /Welcome to The Rail Roster/.test(h));
  ok('…the button is the 3-week trial', /Start your 3-week free trial/.test(h));
  ok('…its link is the trial checkout with the Google email LOCKED', h.indexOf(LINK + '?locked_prefilled_email=pat.doe%40gmail.com') >= 0, h);
  ok('…says the price and that nothing is charged for 3 weeks', /\$75\/year plus tax/.test(h) && /not charged until/.test(h));
  ok('…offers a different Google account (sign out)', /handleSignOut\(\)/.test(h));
  ok('…and the app behind it is read-only', p.ctx._readOnlyMode === true);
  ok('…not dismissible: no backdrop close, no ✕', !/onclick="[^"]*_subScreenClose/.test(h) && !/✕/.test(h)); }
{ const p = page(); p.apply(base({ sub: 'none', showMode: true, payLink: SHOW }));
  const h = p.screen().innerHTML;
  ok('show dates: York special wording and price', /York show special/.test(h) && /\$60 first year plus tax/.test(h));
  ok('…the show link keeps its code AND gets the locked email (&, not a second ?)', h.indexOf(SHOW + '&amp;locked_prefilled_email=pat.doe%40gmail.com') >= 0, h);
  ok('…tells them about the 7 days', /7 days/.test(h)); }

// ── 4. lapsed → lock ──────────────────────────────────────────────────────
console.log('4. lock screen');
{ const p = page(); p.apply(base({ sub: 'expired' }));
  const h = p.screen().innerHTML;
  ok('"expired" shows the lock screen', /Your subscription has ended/.test(h));
  ok('…Renew goes to the NO-TRIAL checkout with the email locked', h.indexOf(RENEW + '?locked_prefilled_email=pat.doe%40gmail.com') >= 0, h);
  ok('…"Your collection is still yours" with their sheet', /Your collection is still yours/.test(h) && /docs\.google\.com\/spreadsheets\/d\/SHEET123/.test(h));
  ok('…and their photos folder', /_prefsOpenPhotosFolder\(\)/.test(h));
  ok('…and sign out', /handleSignOut\(\)/.test(h));
  ok('…read-only behind it', p.ctx._readOnlyMode === true); }
{ const p = page({ sheetId: '' }); p.apply(base({ sub: 'expired' }));
  ok('no sheet id: no broken sheet link', !/spreadsheets\/d\/"/.test(p.screen().innerHTML)); }
{ const p = page({ email: 'a"b<c>@x.com' }); p.apply(base({ sub: 'expired' }));
  ok('odd characters are escaped', !/<c>/.test(p.screen().innerHTML)); }

// ── 5. back from Stripe ───────────────────────────────────────────────────
console.log('5. checkout return');
{ const p = page({ search: '?checkout=done&x=1' });
  ok('?checkout=done is remembered for this tab', !!p.ss.rr_checkout_done);
  ok('…and taken out of the address bar (other words kept)', p.ctx._replaced === '/app/?x=1', p.ctx._replaced); }
{ const p = page({ search: '?checkout=done', answer: { status: 200, sub: 'trial', enforce: true } });
  p.ctx.subCheck().then(() => {
    ok('the next check asks the backend to skip its cache (fresh:1)', p.posts[0] && p.posts[0].fresh === 1, p.posts[0]);
  }); }
{ const p = page({ answer: { status: 200, sub: 'beta' } });
  p.ctx.subCheck().then(() => ok('an ordinary load sends fresh:0', p.posts[0] && p.posts[0].fresh === 0)); }
{ const p = page({ search: '?checkout=done' });
  p.apply(base({ sub: 'none' }));
  ok('Stripe not caught up yet: "Setting up your subscription…", NOT the sales screen again',
     /Setting up your subscription/.test(p.screen().innerHTML) && !/Start your 3-week/.test(p.screen().innerHTML));
  ok('…and it checks again in a few seconds', p.timers.length === 1 && p.timers[0].ms === 4000);
  for (let i = 0; i < 6; i++) p.apply(base({ sub: 'none' }));
  ok('after six tries: "Still waiting" with Check again and the support address',
     /Still waiting to hear from Stripe/.test(p.screen().innerHTML) && /Check again/.test(p.screen().innerHTML) && /support@therailroster\.com/.test(p.screen().innerHTML));
  ok('…and stops retrying on its own', p.timers.length === 6, p.timers.length);
  p.apply(base({ sub: 'trial', daysLeft: 21 }));
  ok('when Stripe answers: screen gone, welcome toast, the flag cleared',
     !p.screen() && p.toasts.length === 1 && !p.ss.rr_checkout_done && p.ctx._readOnlyMode === false); }

// ── 6. sign-in screen, the switch, timing ─────────────────────────────────
console.log('6. sign-in screen');
ok('sign-in card has "No Gmail? Get one free" opening the create-an-account steps',
   /No Gmail\? Get one free/.test(setup) && /gmailShowPath\(\\'create\\'\)/.test(setup));
ok('…the "create" steps exist in GMAIL_HELP', /id:\s*'create'/.test(onb) && /accounts\.google\.com\/signup/.test(onb));
ok('…and it sits right under the Continue with Google button',
   setup.indexOf('No Gmail? Get one free') > setup.indexOf("'Continue with Google'") &&
   setup.indexOf('No Gmail? Get one free') - setup.indexOf("'Continue with Google'") < 800);
ok('config.js holds ONE invite-screen switch, ON until launch day', /const RR_INVITE_GATE_ON = true;/.test(cfg) && /function rrInviteGateOn\(\)/.test(cfg));
ok('_rrShowFirstScreen goes straight to sign-in when the switch is off',
   /if \(_isBetaVerified\(\) \|\| \(typeof rrInviteGateOn === 'function' && !rrInviteGateOn\(\)\)\)/.test(auth));
{ // run the real decision with the switch off and on
  const fn = auth.slice(auth.indexOf('function _rrShowFirstScreen()'), auth.indexOf('// Is this page load a return trip'));
  const run = (gateOn, verified) => {
    const els = { 'beta-gate': { style: {} }, 'auth-screen': { style: {} } };
    const ctx = { document: { getElementById: id => els[id] }, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null },
      state: {}, MASTER_SHEET_ID: 'M', JSON, _buildBetaGate() {}, _buildAuthScreen() {}, _buildAppShell() {}, showApp() {}, showLoading() {},
      _isBetaVerified: () => verified, rrInviteGateOn: () => gateOn };
    vm.createContext(ctx); vm.runInContext(fn + '\nthis.r = _rrShowFirstScreen();', ctx);
    return { r: ctx.r, gate: els['beta-gate'].style.display, auth: els['auth-screen'].style.display };
  };
  const off = run(false, false), on = run(true, false);
  ok('RUN: switch OFF, new visitor → sign-in screen, no invite screen', off.r === 'auth' && off.gate === 'none' && off.auth === 'flex', off);
  ok('RUN: switch ON (today), new visitor → invite screen, as before', on.r === 'gate' && on.gate === 'flex', on);
}
ok('the subscription check now runs 600 ms after load (was 2.5 s)', /subCheck\(\); \} catch \(e\) \{\} \}, 600\);/.test(data));

// ── 7. source rules, each with a planted offender ─────────────────────────
console.log('7. source rules + planted offenders');
const typesPrice = s => /\$75|\$60/.test(s.replace(/\/\/.*$/gm, ''));
ok('vault.js never types the price (RR_PRICE_TEXT is the one place)', !typesPrice(SUB));
ok('PLANTED: a typed price is caught', typesPrice("msg = 'charged $75';"));
const unlockedCheckout = s => /payLink\s*\+|href="'\s*\+\s*(r\.payLink|r\.renewLink)/.test(s);
ok('every checkout link goes through _subCheckoutUrl (email locked) — no raw payLink in an href', !unlockedCheckout(SUB));
ok('PLANTED: a raw payLink link is caught', unlockedCheckout("'<a href=\"' + r.payLink + '\">'"));
ok('_subCheckoutUrl uses locked_prefilled_email', /locked_prefilled_email=/.test(SUB));
ok('PLANTED: an unlocked prefilled_email would fail that rule', !/locked_prefilled_email=/.test("base + '?prefilled_email=' + em"));
ok('still fail-open: a bad answer returns before anything is shown', /if \(!r \|\| r\.status !== 200 \|\| !r\.sub\) return;/.test(SUB));
ok('the old "Subscribe — $75/yr" banner and "view-only" wording are gone', !/Subscribe — \$75\/yr|view-only\. Subscribe/.test(vault));

setTimeout(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, 50);
