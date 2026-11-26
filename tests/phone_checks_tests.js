#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE LAST WIDTH-ONLY PHONE CHECKS — 2026-11-25 (phonechecks)
//
// [stated] Brad 2026-11-25 15:39 CT "Yes" (the WAITING.md line from the
// filterbtn build: two Add-box spots still decide "phone" by width alone)
// → 15:49 CT "Fix all of them" (three more found: two dead style rules in
// wizard-handlers.js and the Contacts card rule). v0.9.2032's rule: a phone is
// narrow, OR short with a touch screen — rrIsPhone() / rrPhoneMedia().
//
// The REAL app in Chromium, four screen shapes:
//   iPhone upright 390x844 (touch) · iPhone on its side 844x390 (touch)
//   a narrow computer window 600x800 (mouse) · a computer 1000x800 (mouse)
//
//   A  the "How are you entering this item?" row (type 773) is brought into
//      view on every PHONE — on its side too, which is new — and never on
//      the computer
//   B  the Add box's height is exactly what it was before at every shape
//      (the change there is spelling only: a phone on its side is short,
//      and the short-screen branch already wins)
//   C  Contacts: on every phone the card picture gives way to the small
//      "📇 Card" link — on its side too, which is new; the computer keeps
//      the picture
//   P  planted: the old width-only nudge served → the phone on its side is
//      not nudged → red; the old width-only Contacts rule served → the
//      picture shows on its side → red; the box height's bar gap changed →
//      B goes red
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  phone_checks_tests needs playwright: ' + e.message); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1';
const UPRIGHT = { n: 'iPhone upright 390x844', w: 390, h: 844, ua: UA_IPHONE, phone: true };
const SIDEWAYS = { n: 'iPhone on its side 844x390', w: 844, h: 390, ua: UA_IPHONE, phone: true };
const NARROW = { n: 'narrow computer window 600x800', w: 600, h: 800, phone: true };
const COMPUTER = { n: 'computer 1000x800', w: 1000, h: 800, phone: false };
const SHAPES = [UPRIGHT, SIDEWAYS, NARROW, COMPUTER];

// A + B: the Add box, the grouping row for 773 (it has a tender), and the box height
const ADD = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {};
  try { localStorage.removeItem('lv_add_mfr'); localStorage.removeItem('lv_add_era'); localStorage.removeItem('lv_add_scale'); } catch (e) {}
  const nudged = [];
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (o) { if (this.id === 'wiz-grouping-btns') nudged.push(1); return orig.call(this, o); };
  const stepType = () => (wizard.steps[wizard.step] || {}).type;
  await openWizard('collection'); wizard.data._era = 'all'; await sleep(200);
  for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(150); }
  const i = document.getElementById('wiz-input');
  if (i) { i.value = '773'; i.dispatchEvent(new Event('input', { bubbles: true })); }
  await sleep(1200);
  const g = document.getElementById('wiz-grouping-btns');
  // the box height before this release, word for word (wizard.js v0.9.2164)
  const oldH = () => {
    var vv = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 800;
    if (vv < 596) return Math.max(300, Math.round(vv - 16));
    if ((window.innerWidth || 0) >= 900) return Math.min(Math.round(vv * 0.9), 900);
    if ((window.innerWidth || 0) <= 640) {
      var _bar = (typeof window.rrBottomBarMeasure === 'function') ? window.rrBottomBarMeasure() : 85;
      return Math.max(300, Math.round(Math.min(vv * 0.92, vv - _bar - 23)));
    }
    return 580;
  };
  return {
    step: stepType(), phone: rrIsPhone(),
    grouping: g && g.style.display !== 'none' ? Array.from(g.querySelectorAll('button')).map(b => b.textContent.trim()) : [],
    nudged: nudged.length, boxH: _wizBoxHeight(), oldH: oldH(),
  };
})()`;

// C: the Contacts page with one contact that has a business-card picture
const CONTACTS = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.sheetsGet = async () => ({ values: [] });
  try { await buildContactsPage(); } catch (e) {}
  state.contactsData = [{ id: 'C-1', row: 2, name: 'Test Dealer', business: 'Test Hobby Shop', cardLink: 'https://drive.google.com/file/d/CARD123/view',
    personPhoto: '', specialties: '', notes: '', metAt: '', title: '', phone: '', email: '', address: '' }];
  _ctRenderList(); await sleep(150);
  const th = document.querySelector('#ct-list .ct-cthumb'), ln = document.querySelector('#ct-list .ct-clink');
  return { thumb: th ? getComputedStyle(th).display : 'missing', link: ln ? getComputedStyle(ln).display : 'missing' };
})()`;

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  async function boot(S, served) {
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, isMobile: !!S.ua, hasTouch: !!S.ua, userAgent: S.ua || undefined });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    await ctx.route('**', r => {
      const u = r.request().url();
      if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:')) return r.abort();
      const name = u.split('?')[0].split('/').pop();
      if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForTimeout(2200);
    await pg.evaluate(SEED); await pg.waitForTimeout(200);
    await pg.evaluate(() => { state.user = { email: 'tester@example.com' }; });
    return { ctx, pg, errs };
  }
  async function look(S, served) {
    const a = await boot(S, served);
    const add = await a.pg.evaluate(ADD);
    await a.ctx.close();
    const c = await boot(S, served);
    const ct = await c.pg.evaluate(CONTACTS);
    await c.ctx.close();
    return { add, ct, errs: a.errs.concat(c.errs) };
  }

  const R = {};
  for (const S of SHAPES) R[S.n] = await look(S);

  for (const S of SHAPES) {
    const r = R[S.n], a = r.add, c = r.ct;
    ok('0 ' + S.n + ': the page loads with no script error', r.errs.length === 0, r.errs.join(' | '));
    ok('0 ' + S.n + ': rrIsPhone() says ' + (S.phone ? 'phone' : 'computer'), a.phone === S.phone, JSON.stringify(a.phone));
    ok('A ' + S.n + ': 773 shows the grouping row (Engine Only / Engine + Tender) — the check is real', a.step === 'itemNumGrouping' && a.grouping.length >= 2, JSON.stringify([a.step, a.grouping]));
    if (S.phone) ok('A ' + S.n + ': the grouping row is brought into view' + (S === SIDEWAYS ? ' (NEW on its side)' : ''), a.nudged >= 1, 'nudged ' + a.nudged);
    else ok('A ' + S.n + ': the grouping row is NOT scrolled on a computer', a.nudged === 0, 'nudged ' + a.nudged);
    ok('B ' + S.n + ': the Add box height is exactly what it was (' + a.oldH + 'px)', a.boxH === a.oldH, a.boxH + ' vs ' + a.oldH);
    if (S.phone) ok('C ' + S.n + ': Contacts shows the "📇 Card" link, not the card picture' + (S === SIDEWAYS ? ' (NEW on its side)' : ''), c.thumb === 'none' && c.link !== 'none' && c.link !== 'missing', JSON.stringify(c));   // the link sits in a flex row, so "inline" reads back as "block"
    else ok('C ' + S.n + ': Contacts keeps the card picture, no link', c.thumb !== 'none' && c.thumb !== 'missing' && c.link === 'none', JSON.stringify(c));
  }

  // ── planted offenders ──
  {
    const old = { 'wizard-handlers.js': plant(read('wizard-handlers.js'), 'if (_grpWasHidden && _isMobile) {', 'if (_grpWasHidden && (window.innerWidth || 0) <= 640) {', 'the nudge') };
    const p = await look(SIDEWAYS, old);
    ok('P1 PLANTED the old width-only nudge: the phone on its side is NOT nudged — proof A can fail', p.add.grouping.length >= 2 && p.add.nudged === 0, 'nudged ' + p.add.nudged);
  }
  {
    const old = { 'contacts.js': plant(read('contacts.js'), "'<style>@media ' + rrPhoneMedia() + '{", "'<style>@media (max-width:640px){", 'the card rule') };
    const p = await look(SIDEWAYS, old);
    ok('P2 PLANTED the old width-only Contacts rule: the picture shows on its side — proof C can fail', p.ct.thumb !== 'none' && p.ct.link === 'none', JSON.stringify(p.ct));
  }
  {
    const off = { 'wizard.js': plant(read('wizard.js'), 'Math.min(vv * 0.92, vv - _bar - 23)', 'Math.min(vv * 0.92, vv - _bar)', 'the bar gap') };
    const p = await look(UPRIGHT, off);
    ok('P3 PLANTED a changed phone box height: B goes red at 390x844 — proof B can fail', p.add.boxH !== p.add.oldH, p.add.boxH + ' vs ' + p.add.oldH);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
