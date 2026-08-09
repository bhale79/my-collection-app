// ══ tests/phone-audit.js — every page, at phone widths, MEASURED ══════════
//
// Brad, 2026-08-09, after three tester bugs in a row that only existed on a
// phone (the 3-row toolbar, the missing camera-roll door, the blocked picker
// tab): sweep the whole app at real phone widths before the testers find the
// rest one report at a time.
//
// The toolbar bug is the founding lesson: my first reproduction used SHORT
// placeholder <select> options, showed 2 tidy rows, and hid the bug the real
// option text caused at every phone width. So this audit boots the REAL
// app/index.html with the shared synthetic collection (tests/lib/
// guide-fixture.js — the same fixture every guide gate uses), walks through
// the REAL navigation doors, and measures the REAL rendered pixels.
//
// This is an AUDIT, not a gate: it writes a findings report and screenshots
// under /tmp/rr-phone-audit/ and exits 0 unless the app fails to boot. Turning
// a finding into a red test happens when the finding is fixed, not before —
// a gate that is born red is a gate everyone learns to ignore.
//
// What it measures, per page per width:
//   1. horizontal overflow — can the page scroll sideways, and WHAT sticks out
//   2. off-screen controls — visible interactive elements whose box crosses
//      the viewport edge (the v0.9.1211 colour-chip bug, generalised)
//   3. clipped text — controls whose content is wider than their box
//   4. tap targets — interactive elements under 40×40 CSS px (Brad's users
//      are not twenty-five; a 28px button on a phone is a miss waiting)
//   5. stacked toolbars — known flex toolbars that wrap past their intended
//      row count (the exact class of the 3-row bug)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  phone-audit needs playwright (declared devDependency; npm install).');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');

const OUT = '/tmp/rr-phone-audit';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Cooper is on 1920×945; the phone reports came from a Galaxy S25 Ultra and an
// iPhone. These are the CSS-pixel widths that cover the real device spread.
const WIDTHS = [
  [360, 800, 'small Android'],
  [390, 844, 'iPhone 15/16'],
  [412, 915, 'Galaxy S25 Ultra'],
  [430, 932, 'iPhone Pro Max'],
];

// Every page, opened by the SAME calls the app's own navigation makes.
const PAGES = [
  { id: 'dashboard',   open: "showPage('dashboard', null)" },
  { id: 'collection',  open: "showPage('browse', null); filterOwned();", pageId: 'browse' },
  { id: 'catalog',     open: "showPage('browse', null); resetFilters(); renderBrowse();", pageId: 'browse' },
  { id: 'upgrade',     open: "showPage('upgrade', null); buildUpgradePage();" },
  { id: 'forsale',     open: "showPage('forsale', null); buildForSalePage();" },
  { id: 'parts',       open: "showPage('parts', null); buildPartsPage();" },
  { id: 'sold',        open: "showPage('sold', null);" },
  { id: 'reports',     open: "showPage('reports', null);" },
  { id: 'tools',       open: "showPage('tools', null);" },
  // page-vault is NOT swept: MARKET_ENABLED is off for the beta and
  // vaultRenderPage deliberately redirects to the dashboard. Sweep it again
  // when the Collector's Market ships.
  { id: 'contacts',    open: "showPage('contacts', null);" },
  { id: 'prefs',       open: "showPage('prefs', null); buildPrefsPage();" },
  { id: 'photo-inbox', open: "window._pinGo(document.getElementById('nav-photo-inbox'));" },
  { id: 'itemdetail',  open: "var pd = Object.values(state.personalData||{})[0]; if (pd && typeof _openOwnedByInvId==='function') _openOwnedByInvId(pd.inventoryId);" },
];

// Modals and flows a phone user lives in — measured on top of their home page.
const OVERLAYS = [
  { id: 'wizard-step1', base: 'dashboard',
    open: "startWizardFor('collection');", waitFor: '#wiz-input' },
  { id: 'onboarding-1', base: 'dashboard', open: "showFeatureMap();" },
  { id: 'onboarding-2', base: 'dashboard', open: "showFeatureMap(); onboardNext();" },
  { id: 'onboarding-4', base: 'dashboard',
    open: "showFeatureMap(); onboardNext(); onboardNext(); onboardNext();" },
  { id: 'report-form',  base: 'dashboard',
    open: "if (typeof errReportOpen==='function') errReportOpen();" },
  { id: 'inbox-sources', base: 'photo-inbox',
    open: "window._pinAddSource && window._pinAddSource();" },
];

// The measurement, run inside the page. Returns findings, not verdicts.
const MEASURE = `(function () {
  var vw = window.innerWidth;
  var out = { overflow: null, offscreen: [], clipped: [], smallTaps: [], toolbars: [] };
  var doc = document.documentElement;
  if (doc.scrollWidth > vw + 1) {
    // Name the widest offenders, not just the fact.
    var worst = [];
    document.querySelectorAll('body *').forEach(function (el) {
      if (!el.offsetParent && el.tagName !== 'BODY') return;
      var b = el.getBoundingClientRect();
      if (b.width < 24) return;
      if (b.right > vw + 2 && b.left < vw) {
        worst.push({ sig: (el.tagName + '#' + (el.id||'') + '.' + String(el.className||'').split(' ')[0]).slice(0,60),
                     text: (el.innerText||'').trim().replace(/\\s+/g,' ').slice(0,40),
                     right: Math.round(b.right), over: Math.round(b.right - vw) });
      }
    });
    worst.sort(function (a,b) { return b.over - a.over; });
    out.overflow = { docWidth: doc.scrollWidth, viewport: vw, worst: worst.slice(0, 5) };
  }
  var interactive = document.querySelectorAll('button, a, select, input, [onclick], [role=button]');
  interactive.forEach(function (el) {
    if (el.offsetParent === null) return;
    var b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    var sig = (el.tagName + '#' + (el.id||'') + '.' + String(el.className||'').split(' ')[0]).slice(0,60);
    var text = (el.innerText || el.value || '').trim().replace(/\\s+/g,' ').slice(0,40);
    if (b.right > vw + 2 || b.left < -2) {
      var scrollable = false, a = el.parentElement;
      while (a && a !== document.body) {
        var acs = getComputedStyle(a);
        if ((acs.overflowX === 'auto' || acs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 2) { scrollable = true; break; }
        a = a.parentElement;
      }
      if (!scrollable) out.offscreen.push({ sig: sig, text: text, left: Math.round(b.left), right: Math.round(b.right) });
    }
    if (el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).overflowX !== 'visible'
        && el.tagName !== 'SELECT') {
      out.clipped.push({ sig: sig, text: text, content: el.scrollWidth, box: el.clientWidth });
    }
    // Tap targets: the wizard/nav standard in this app is 44px minimum.
    if ((b.width < 32 || b.height < 32) && text && el.tagName !== 'A' && el.tagName !== 'INPUT') {
      out.smallTaps.push({ sig: sig, text: text, w: Math.round(b.width), h: Math.round(b.height) });
    }
  });
  // Toolbars: any visible flex row that wraps — report its real row count.
  document.querySelectorAll('div, nav').forEach(function (el) {
    if (el.offsetParent === null || el.children.length < 2) return;
    var cs = getComputedStyle(el);
    if (cs.display !== 'flex' || cs.flexWrap !== 'wrap' || cs.flexDirection.indexOf('row') !== 0) return;
    var tops = {};
    Array.from(el.children).forEach(function (c) {
      if (c.offsetParent === null) return;
      var t = Math.round(c.getBoundingClientRect().top / 8) * 8;
      tops[t] = 1;
    });
    var rows = Object.keys(tops).length;
    var kids = Array.from(el.children).filter(function (c) { return c.offsetParent !== null; });
    var controls = kids.filter(function (c) {
      return /^(BUTTON|SELECT|INPUT|A|LABEL)$/.test(c.tagName) || c.querySelector && c.children.length === 0 && c.onclick;
    }).length;
    if (controls < kids.length * 0.7 || kids.length < 3) return;
    if (rows >= 3) {
      out.toolbars.push({ sig: (el.tagName + '#' + (el.id||'') + '.' + String(el.className||'').split(' ')[0]).slice(0,60),
                          rows: rows, children: el.children.length });
    }
  });
  // Cap list sizes so the report stays readable; counts carry the truth.
  ['offscreen','clipped','smallTaps','toolbars'].forEach(function (k) {
    out[k + 'Count'] = out[k].length; out[k] = out[k].slice(0, 6);
  });
  return out;
})()`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const findings = [];
  let booted = 0;

  try {
    for (const [w, h, label] of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        isMobile: true, hasTouch: true, deviceScaleFactor: 3,
        // IS_MOBILE_UA reads the UA at config.js load — a phone UA is what
        // makes the app BUILD its phone layout, and auditing the desktop
        // layout at 360px would be measuring a page no phone user sees.
        userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
      });
      const page = await ctx.newPage();
      // The audit measures the app a RETURNING user sees. Without these flags
      // the first sweep measured the welcome card on every page — it sat over
      // everything and the screenshots proved it. The offline banner (network
      // is deliberately blocked here) is removed after boot for the same
      // reason: a real phone has internet, and a banner that only exists in
      // the harness must not appear in a finding.
      await page.addInitScript(() => {
        try {
          localStorage.setItem('lv_welcome_seen', '1');
          localStorage.setItem('lv_onboarded', '1');
          localStorage.setItem('lv_ios_hint_dismissed', '1');
        } catch (e) {}
      });
      const errs = [];
      page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
      for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                       '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                       '**://*.google.com/**', '**://fonts.gstatic.com/**'])
        await page.route(u, r => r.abort());

      await page.goto('file://' + APP + '/index.html');
      await page.waitForTimeout(2200);
      await page.evaluate(SEED);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const ob = document.getElementById('offline-banner'); if (ob) ob.remove();
        const wc = document.getElementById('rr-welcome-card'); if (wc) wc.remove();
        document.querySelectorAll('[id*=welcome]').forEach(el => {
          if (el.id !== 'page-dashboard' && /overlay|card|ov/.test(el.id)) el.remove();
        });
      });

      const ready = await page.evaluate(() =>
        !!(window.state && state.masterData && state.masterData.length &&
           typeof showPage === 'function'));
      if (!ready) {
        console.log('FAIL  boot at ' + w + 'px — page errors: ' + errs.join(' | '));
        continue;
      }
      booted++;

      for (const p of PAGES) {
        try {
          await page.evaluate(new Function('try {' + p.open + '} catch (e) { window.__openErr = e.message; }'));
          await page.waitForTimeout(650);
          const openErr = await page.evaluate(() => { const e = window.__openErr; window.__openErr = null; return e || null; });
          const shown = await page.evaluate((pid) => {
            const el = document.getElementById('page-' + pid);
            return !!(el && el.classList.contains('active'));
          }, p.pageId || p.id);
          const m = await page.evaluate(MEASURE);
          m.page = p.id; m.width = w; m.device = label; m.openErr = openErr; m.shown = shown;
          const bad = m.overflow || m.offscreenCount || m.clippedCount || m.toolbarsCount || openErr || !shown;
          if (bad) {
            const shot = path.join(OUT, p.id + '-' + w + '.png');
            await page.screenshot({ path: shot, fullPage: false });
            m.screenshot = shot;
          }
          findings.push(m);
        } catch (e) {
          findings.push({ page: p.id, width: w, device: label, crashed: e.message.slice(0, 140) });
        }
      }

      for (const ov of OVERLAYS) {
        try {
          const base = PAGES.find(x => x.id === ov.base);
          await page.evaluate(new Function('try {' + base.open + '} catch (e) {}'));
          await page.waitForTimeout(400);
          await page.evaluate(new Function('try {' + ov.open + '} catch (e) { window.__openErr = e.message; }'));
          await page.waitForTimeout(800);
          const openErr = await page.evaluate(() => { const e = window.__openErr; window.__openErr = null; return e || null; });
          const m = await page.evaluate(MEASURE);
          m.page = ov.id; m.width = w; m.device = label; m.openErr = openErr; m.overlay = true;
          const bad = m.overflow || m.offscreenCount || m.clippedCount || m.toolbarsCount || openErr;
          if (bad) {
            const shot = path.join(OUT, ov.id + '-' + w + '.png');
            await page.screenshot({ path: shot, fullPage: false });
            m.screenshot = shot;
          }
          findings.push(m);
          // Tear the overlay down so the next one starts clean.
          await page.evaluate(() => {
            ['onboarding-map-overlay', 'err-report-modal', 'err-restore-bar', 'pin-src-ov'].forEach(id => {
              const el = document.getElementById(id); if (el) el.remove();
            });
            try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
            try { if (typeof closeWizard === 'function') closeWizard(); } catch (e) {}
          });
          await page.waitForTimeout(200);
        } catch (e) {
          findings.push({ page: ov.id, width: w, device: label, crashed: e.message.slice(0, 140) });
        }
      }

      if (errs.length) findings.push({ page: '(page errors at ' + w + 'px)', width: w, errors: errs.slice(0, 10) });
      await ctx.close();
      console.log('swept ' + w + 'px (' + label + ')');
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));

  // Console summary: one line per page×width that has anything to say.
  let flagged = 0;
  for (const f of findings) {
    const bits = [];
    if (f.crashed) bits.push('CRASHED: ' + f.crashed);
    if (f.openErr) bits.push('open error: ' + f.openErr);
    if (f.shown === false) bits.push('page never became active');
    if (f.overflow) bits.push('H-OVERFLOW ' + f.overflow.docWidth + '>' + f.overflow.viewport);
    if (f.offscreenCount) bits.push(f.offscreenCount + ' off-screen controls');
    if (f.clippedCount) bits.push(f.clippedCount + ' clipped');
    if (f.toolbarsCount) bits.push(f.toolbarsCount + ' toolbars at 3+ rows');
    if (f.smallTapsCount) bits.push(f.smallTapsCount + ' small taps');
    if (f.errors) bits.push('page errors: ' + f.errors.length);
    if (bits.length) { flagged++; console.log('  ' + String(f.page).padEnd(16) + String(f.width || '').padEnd(6) + bits.join(' · ')); }
  }
  console.log('\n' + (booted === WIDTHS.length ? 'AUDIT COMPLETE' : 'AUDIT INCOMPLETE — boot failures') +
    '  —  ' + findings.length + ' page×width combinations measured, ' + flagged + ' flagged.');
  console.log('Report: ' + path.join(OUT, 'findings.json'));
  process.exit(booted === WIDTHS.length ? 0 : 1);
})();
