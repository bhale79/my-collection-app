#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// NO "FREE" ABOUT READING PHOTOS — v0.9.1956   (real Chromium + every page)
//
// [stated] Brad, 2026-10-15, on the Photo Inbox button "Identify my items —
// read 8 (free)": "we need to get rid of the free terminology as that had to
// do with the autoreader". Then: "yes, make sure we check all the website
// stuff, welcome screens and everywhere else".
//
// "Free" only ever meant "this does not use one of Auto Read's daily reads".
// Auto Read is off for everyone (v0.9.1949), so with it off NOTHING a person
// sees may call reading free. Kept, on purpose: the subscription's "free
// trial", Google's free Gmail account (the welcome steps), a free custom
// column — different meanings — and the wording that only appears if Auto
// Read is switched back on, where the daily limit makes "free" true.
//
//   S  every line of every page people see (app/*.js, app/*.html, the website
//      index.html, privacy, terms, the preview page) that says "free" is one
//      of the kept meanings or Auto Read-only — anything new fails, named.
//      PLANTED: the Inbox button's "(free)" back without the Auto Read gate.
//   R  rendered with Auto Read off — no "free" anywhere on: the scanning card,
//      Help → Photo ID (and no cost column), Photo ID's crop screen, the
//      Identify screen, the Your Picture box while reading, every guided tour
//      step a person without Auto Read is shown, the reading words in config.
//      PLANTED: the crop screen's "always free" without the gate.
//   A  with Auto Read ON the daily-limit wording is still there (gated, not
//      deleted).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  no_free_wording_1956_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const FIX = path.join(__dirname, 'fixtures');
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// ── S · the source sweep ──────────────────────────────────────────────────
// Program names that merely contain the letters (never shown to anyone).
const NAMES = /_freeRead|rrFreeReadBlob|_FREE_PASSES|FREE_TRIED_KEY|_freeTried|rrIdentifyFree|\b_free\b|freeUntil|free_until|rrTagFreeCustomSlot|rrTagCustomIsFree|_impFreeCustomSlot|_FREEMAIL|_freezeStage|\bfreed\b|frees up|freeonly|_freeOnly|\bfree: 1\b|var free = |\bfree \? |_freeReadQueue|textContent = free\b|function _step\(n, title, cost, free, body\)|draw a free ID|rr_inbox_freetried/;
// The kept meanings and the Auto Read-only wording, each by the words that
// make it allowed — a line that merely sits in the same file is not enough.
const KEPT = [
  { f: 'app/config.js', has: "Start your free trial", why: 'subscription trial' },
  { f: 'app/prefs.js', has: "line = 'Free trial'", why: 'subscription trial' },
  { f: 'app/prefs.js', has: "line = 'Free trial' + (s.trialEnds", why: 'subscription trial' },
  { f: 'app/vault.js', has: "Your free trial ends", why: 'subscription trial' },
  { f: 'app/vault.js', has: "No free trial with the show price", why: 'subscription trial' },
  { f: 'app/vault.js', has: "Try everything free for 3 weeks", why: 'subscription trial' },
  { f: 'app/vault.js', has: "Start your 3-week free trial", why: 'subscription trial' },
  { f: 'terms/index.html', has: "Free trial:", why: 'subscription trial' },
  { f: 'terms/index.html', has: "free period we've communicated", why: 'beta pricing' },
  { f: 'terms/index.html', has: "it may replace the free trial with a different offer", why: 'subscription trial (specials)' },
  { f: 'preview-1051ec16/index.html', has: "Free While in Beta", why: 'beta pricing' },
  { f: 'app/onboarding-config.js', has: "you can create one for free", why: "Google's free Gmail account" },
  { f: 'app/onboarding-config.js', has: "Takes about 5 minutes. Completely free.", why: "Google's free Gmail account" },
  { f: 'app/import-ui.js', has: "free one in Preferences", why: 'a free custom column' },
  { f: 'app/photo-inbox.js', has: "console.warn('[Inbox] screenshot OCR (free pass) failed:'", why: 'console only' },
  { f: 'app/photo-inbox.js', has: "// write cap only; resolution stays free", why: 'a code comment' },
  { f: 'app/photo-inbox.js', has: "_freeRead = true; }   // free read good enough only with a number", why: 'a code comment' },
  { f: 'app/prefs.js', has: "'Beta tester \\u2014 free until '", why: 'subscription (beta testers ride free)' },
  { f: 'app/prefs.js', has: "Everyone else's Photo ID is free and has nothing to switch. -->", why: 'an HTML comment' },
  // Auto Read only — each sits behind ar / _ar / _pinAr() / rrAutoReadOn() / autoRead:true
  { f: 'app/app-misc.js', has: "(ar ? 'Scanning is free. Photo ID is the one part with a limit.'", why: 'Auto Read only' },
  { f: 'app/app-misc.js', has: "(ar ? 'Scanning is free and unlimited.'", why: 'Auto Read only' },
  { f: 'app/app-misc.js', has: "the same photo twice is free, and a failed one is given back", why: 'Auto Read only (the daily-allowance box)' },
  { f: 'app/barcode.js', has: "(_ar ? 'always free' : 'reads the number')", why: 'Auto Read only' },
  { f: 'app/barcode.js', has: "&bull; Photo ID</b> — <b>always free</b>: reads the barcode and the printed number. If they can", why: 'Auto Read only (the _ar branch)' },
  { f: 'app/barcode.js', has: "Free readers run first; <b>one of your daily photo ID reads</b>", why: 'Auto Read only' },
  { f: 'app/barcode.js', has: "Close look: not run — Photo ID is the free pass. Auto Read takes the closer look.", why: 'Auto Read only (freeonly needs Auto Read)' },
  { f: 'app/barcode.js', has: "_optedOut ? 'The free readers couldn’t tell, and photo ID reads are turned off", why: 'Auto Read only (opt-out)' },
  { f: 'app/barcode.js', has: "_freeOnly ? 'The free readers couldn’t tell — nothing was spent.", why: 'Auto Read only' },
  { f: 'app/help-photo-id.js', has: "return ar ? _step(n, title, 'Free', true, body)", why: 'Auto Read only' },
  { f: 'app/help-photo-id.js', has: "_row('Identify my items (the first read)', 'Free', false)", why: 'Auto Read only (the table is behind ar)' },
  { f: 'app/help-photo-id.js', has: "_row('This is wrong — re-scan', 'Free', false)", why: 'Auto Read only' },
  { f: 'app/help-photo-id.js', has: "_row('Research Number', 'Free', false)", why: 'Auto Read only' },
  { f: 'app/help-photo-id.js', has: "_row('Google Search', 'Free', false)", why: 'Auto Read only' },
  { f: 'app/photo-inbox.js', has: "(_pinAr() ? 'The free reader could not pick out a number on this one", why: 'Auto Read only' },
  { f: 'app/photo-inbox.js', has: "(_pinAr() ? ' (free)' : '')", why: 'Auto Read only' },
  { f: 'app/photo-inbox.js', has: "((_freeRead && _pinAr()) ? ' (free — no photo ID used)' : '')", why: 'Auto Read only' },
  { f: 'app/photo-inbox.js', has: "'Tip: <b>Identify my items</b> is free \\u2014 try it first.'", why: 'Auto Read only (the paid batch prompt)' },
  { f: 'app/prefs.js', has: "Every photo is checked free first — printed numbers and barcodes cost nothing.", why: 'Auto Read only (the switch)' },
  { f: 'app/prefs.js', has: "'Off — free readers only'", why: 'Auto Read only' },
  { f: 'app/prefs.js', has: "? 'Off \\u2014 free readers only'", why: 'Auto Read only' },
  { f: 'app/prefs.js', has: "'Photo ID reads are off — free readers only'", why: 'Auto Read only' },
  { f: 'app/prefs.js', has: "rrAiOptedOut === 'function' && rrAiOptedOut()) ? 'Off", why: 'Auto Read only (the switch label)' },
  { f: 'app/tutorial.js', has: "{ autoRead: true, selector: '#pin-idall-btn', optional: true, title: 'When free is not enough'", why: 'Auto Read only' },
  { f: 'app/tutorial.js', has: "and nothing is ever spent. The free readers keep working", why: 'Auto Read only (the step above carries autoRead: true)' },
  { f: 'app/tutorial.js', has: "'What is free and unlimited, and the daily photo ID allowance' : ", why: 'Auto Read only' },
  { f: 'app/wizard-photos.js', has: "rrAutoReadOn()) ? 'Read it free from the photo", why: 'Auto Read only' },
];
function sweep(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    files[f].split('\n').forEach((line, i) => {
      if (!/free/i.test(line)) return;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;          // a comment line
      const rest = line.replace(new RegExp(NAMES.source, 'g'), '');
      if (!/free/i.test(rest)) return;                       // only program names
      if (KEPT.some(k => k.f === f && line.indexOf(k.has) >= 0)) return;
      bad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 160));
    });
  });
  return bad;
}
function userFiles() {
  const out = {};
  fs.readdirSync(APP).filter(n => /\.(js|html)$/.test(n)).forEach(n => { out['app/' + n] = fs.readFileSync(path.join(APP, n), 'utf8'); });
  ['index.html', 'privacy/index.html', 'terms/index.html'].forEach(p => { if (fs.existsSync(path.join(ROOT, p))) out[p] = fs.readFileSync(path.join(ROOT, p), 'utf8'); });
  fs.readdirSync(ROOT).filter(n => /^preview-/.test(n) && fs.existsSync(path.join(ROOT, n, 'index.html')))
    .forEach(n => { out[n + '/index.html'] = fs.readFileSync(path.join(ROOT, n, 'index.html'), 'utf8'); });
  return out;
}

async function boot(browser, files, ar) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    if (/cropperjs/.test(u) && /\.js$/.test(base)) return r.fulfill({ body: CROPPER_JS, contentType: 'application/javascript' });
    if (/cropperjs/.test(u) && /\.css$/.test(base)) return r.fulfill({ body: CROPPER_CSS, contentType: 'text/css' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate((ar) => {
    window.RR_AUTO_READ_ON = !!ar;
    if (ar) { state.user = { email: 'support@therailroster.com' }; }
    state.masterData = []; try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {};
    try { _aiUsageMarkSeen(); } catch (e) {}
  }, ar);
  return { pg, errs };
}
const FREE = /\bfree\b/i;
// what a screen says, read from the page itself
const cropScreen = pg => pg.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200);
  window._barcodeDebug._biCrop(c, null);
  await new Promise(r => setTimeout(r, 700));
  const o = document.getElementById('bi-overlay'); const t = o ? o.innerText : '';
  if (o) o.remove();
  return t;
});

(async function () {
  // ── S ──
  const files = userFiles();
  const bad = sweep(files);
  T('S every page people see: "free" only in the kept meanings or behind Auto Read (' + Object.keys(files).length + ' files)', bad.length === 0, bad);
  const planted = Object.assign({}, files);
  planted['app/photo-inbox.js'] = files['app/photo-inbox.js'].replace("(_pinAr() ? ' (free)' : '')", "' (free)'");
  T('S PLANTED: the Inbox button\'s "(free)" back without the Auto Read gate is caught', planted['app/photo-inbox.js'] !== files['app/photo-inbox.js'] && sweep(planted).some(b => /Identify my items/.test(b)), sweep(planted));
  T('S the website pages were read too (home, privacy, terms)', ['index.html', 'privacy/index.html', 'terms/index.html'].every(p => p in files), Object.keys(files).filter(k => !/^app\//.test(k)));

  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    // ── R · rendered, Auto Read off ──
    {
      const { pg, errs } = await boot(browser, null, false);
      const offOk = await pg.evaluate(() => (typeof rrAutoReadOn === 'function') && !rrAutoReadOn());
      T('R (set-up) Auto Read is off', offOk);
      const card = await pg.evaluate(async () => {
        showAiUsageCard(true); await new Promise(r => setTimeout(r, 300));
        const o = [...document.querySelectorAll('body > div')].filter(d => /Scanning/.test(d.innerText || '')).pop();
        const t = o ? o.innerText : ''; if (o) o.remove(); return t;
      });
      T('R the "Scanning and photo ID" card says nothing is free', card.length > 40 && !FREE.test(card), card.slice(0, 400));
      const help = await pg.evaluate(() => { const d = document.createElement('div'); d.innerHTML = rrPhotoIdHelpHtml(); document.body.appendChild(d); const t = d.innerText; d.remove(); return t; });
      T('R Help → Photo ID: no "free", and no cost column', help.length > 200 && !FREE.test(help) && !/1 photo ID/.test(help), help.match(/.{0,60}free.{0,60}/i));
      const crop = await cropScreen(pg);
      T('R Photo ID\'s crop screen: no "free" (Photo ID reads the number; Google Lens searches Google with this photo)', /Photo ID/.test(crop) && /search Google with this photo/.test(crop) && !FREE.test(crop), crop.slice(0, 500));
      const ident = await pg.evaluate(async () => {
        try { openIdentify('wizard'); } catch (e) {}
        await new Promise(r => setTimeout(r, 400));
        const m = document.getElementById('identify-modal'); const t = m ? m.innerText : '';
        try { closeIdentify(); } catch (e) {}
        return t;
      });
      T('R the Identify screen ("Photo ID" button and help) says nothing is free', /Photo ID/.test(ident) && !FREE.test(ident), ident.match(/.{0,60}free.{0,60}/i));
      const words = await pg.evaluate(() => JSON.stringify([RR_PIC_FIRST, RR_PHOTO_ID_CLOSER]));
      T('R the reading words (Your Picture box, closer look) have no "free"', !FREE.test(words), words.match(/.{0,40}free.{0,40}/i));
      const tours = await pg.evaluate(() => {
        const out = [];
        Object.keys(window.GUIDES || {}).forEach(k => (GUIDES[k].steps || []).forEach(s => {
          if (s.autoRead) return;   // shown only to people with Auto Read
          const t = String(s.title || '') + ' ' + String(s.body || '');
          if (/\bfree\b/i.test(t.replace(/<[^>]+>/g, ''))) out.push(k + ': ' + t.slice(0, 120));
        }));
        return { n: Object.keys(window.GUIDES || {}).length, bad: out };
      });
      T('R every guided-tour step a person without Auto Read sees: no "free" (' + tours.n + ' tours)', tours.n > 5 && tours.bad.length === 0, tours.bad);
      T('R page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const bc = fs.readFileSync(path.join(APP, 'barcode.js'), 'utf8');
      const old = bc.replace("(_ar ? 'always free' : 'reads the number')", "'always free'");
      if (old === bc) T('R PLANTED: could plant the crop screen\'s old "always free"', false);
      else {
        const { pg } = await boot(browser, { 'barcode.js': old }, false);
        const crop = await cropScreen(pg);
        T('R PLANTED: the crop screen\'s ungated "always free" is caught (R would fail)', FREE.test(crop), crop.slice(0, 300));
        await pg.close();
      }
    }
    // ── A · Auto Read on: the daily-limit wording is gated, not deleted ──
    {
      const { pg } = await boot(browser, null, true);
      const on = await pg.evaluate(() => rrAutoReadOn());
      const crop = await cropScreen(pg);
      const help = await pg.evaluate(() => rrPhotoIdHelpHtml());
      T('A with Auto Read ON the crop screen still says Photo ID is "always free" beside Auto Read', on === true && /always free/.test(crop) && /Auto Read/.test(crop), { on, crop: crop.slice(0, 300) });
      T('A …and Help → Photo ID keeps its cost column', /1 photo ID/.test(help) && /Free/.test(help));
      await pg.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('NO FREE WORDING 1956 TESTS FAILING'); process.exit(1); }
  console.log('ALL NO FREE WORDING 1956 TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
