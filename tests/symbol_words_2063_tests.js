#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// A BUTTON THAT SHOWS ONLY A SYMBOL SAYS WHAT IT DOES — v0.9.2063
// (known-problems sweep, release 6, type A3)
//
// The sweep measured 142 buttons whose face is only a symbol (× ✕ ▲ ▼ ✂ 📷
// 📅 ✏️ ‹ › + − ? ⚡): 53 had their words only in a mouse hover tip (a phone
// never shows one), 25 only for a screen reader, ~57 none at all.
// Now:
//   • every one carries its words where it is built — aria-label or title;
//   • a11y.js (THE accessibility stamp) copies them to the other half, so a
//     resting mouse (title) and a screen reader (aria-label) both get them;
//   • on a phone, holding one for half a second shows the same words in the
//     conductor's bubble (tutorial.js) and lifting does NOT press it; a quick
//     tap presses it as always. rrSymbolOnly / rrControlWords (a11y.js) are
//     the ONE test of "only a symbol" and "its words".
//
//   S  source scan — app/*.js + index.html: every <button> whose literal face
//      is only a symbol has words (title / aria-label / data-ctip); a clickable
//      <span>/<div> with only a symbol is role="button" with words; a button
//      made by createElement with a symbol face is given words. Each rule
//      proven on planted offenders (and on a real button with its words
//      taken off).
//   B  the real app in Chromium (phone 390x844 with touch, and a computer):
//      the hold, the tap, the stamp both ways, plain-word buttons left alone,
//      no words = no bubble, and a walk where every symbol button on screen
//      has both halves.
//   P  old code served — no hold, the phone hiding the bubble, no stamp, the
//      Add screen's ✕ without words — each turns its own check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };

// ── S — the source scan ──
const LETTER = /[A-Za-z0-9]/;
function dec(s) {
  return s.replace(/\\u\{([0-9a-f]+)\}/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&[a-z]+;/gi, '\u00b7');   // &times; &larr; &minus; … — a symbol, never a word
}
// a face built from an expression (${…}, ' + x + ') is not known here — the walk (B) covers those
const EXPR = /\$\{|['"`]\s*\+|\+\s*['"`]/;
const WORDS = /\b(title|aria-label|data-ctip)\s*=/;
function scan(name, src) {
  const out = [];
  const line = i => src.slice(0, i).split('\n').length;
  // 1. <button …>FACE</button>
  const re = /<button\b/g; let m;
  while ((m = re.exec(src))) {
    const gt = src.indexOf('>', m.index), close = src.indexOf('</button>', gt);
    if (gt < 0 || close < 0 || close - gt > 600) continue;
    const tag = src.slice(m.index, gt + 1), face = src.slice(gt + 1, close);
    if (/<button\b/.test(face) || EXPR.test(face)) continue;
    const txt = dec(face).replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    if (!txt || LETTER.test(txt)) continue;
    if (!WORDS.test(tag)) out.push(name + ':' + line(m.index) + ' <button> ' + JSON.stringify(txt) + ' has no words');
  }
  // 2. a clickable <span>/<div>/<i>/<label> whose face is only a symbol
  const re2 = /<(span|div|i|label)\b([^<>]{0,900}?\bonclick=[^<>]{0,900}?)>([^<]{1,40})<\/\1>/g;
  while ((m = re2.exec(src))) {
    if (EXPR.test(m[3])) continue;
    const txt = dec(m[3]).replace(/\s+/g, '');
    if (!txt || LETTER.test(txt)) continue;
    if (!WORDS.test(m[2])) out.push(name + ':' + line(m.index) + ' <' + m[1] + ' onclick> ' + JSON.stringify(txt) + ' has no words');
    if (!/\brole\s*=\s*\\?["']button/.test(m[2])) out.push(name + ':' + line(m.index) + ' <' + m[1] + ' onclick> ' + JSON.stringify(txt) + ' is not role="button" (a screen reader skips its words)');
  }
  // 3. var x = document.createElement('button') … x.textContent / innerHTML = 'SYMBOL'
  const re3 = /(\w+)\s*=\s*document\.createElement\(\s*['"]button['"]\s*\)/g;
  while ((m = re3.exec(src))) {
    const v = m[1], body = src.slice(m.index, m.index + 1500).split('\n').slice(0, 10).join('\n');
    const f = new RegExp('\\b' + v + '\\.(?:textContent|innerHTML|innerText)\\s*=\\s*([\'"])((?:\\\\.|(?!\\1).){1,24})\\1').exec(body);
    if (!f) continue;
    const txt = dec(f[2]).replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    if (!txt || LETTER.test(txt)) continue;
    if (!new RegExp('\\b' + v + '\\.(?:title\\s*=|ariaLabel\\s*=|setAttribute\\(\\s*[\'"](?:aria-label|title)[\'"])').test(body))
      out.push(name + ':' + line(m.index) + ' createElement button ' + v + ' ' + JSON.stringify(txt) + ' has no words');
  }
  return out;
}
const FILES = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/vendor|\.min\./.test(f));
let hits = [], counted = 0;
for (const f of FILES) { const s = read(f); counted += (s.match(/<button\b/g) || []).length; hits = hits.concat(scan(f, s)); }
ok('S0 the scan read the app (' + FILES.length + ' files, ' + counted + ' buttons) and index.html is in it', FILES.includes('index.html') && FILES.length > 80 && counted > 500, FILES.length + ' / ' + counted);
ok('S1 every symbol-only button, clickable symbol and made-in-code symbol button has words', !hits.length, hits.slice(0, 8).join(' | ') + (hits.length > 8 ? ' … +' + (hits.length - 8) : ''));

const PS = [
  ['S-P1 a template button with only ×', 'x = `<button onclick="go()" style="a:b">×</button>`;'],
  ['S-P2 a quoted button with only \\u2715', "x = '<button onclick=\"go()\" style=\"a:b\">\\u2715</button>';"],
  ['S-P3 a button with only &times;', "x = '<button class=\"q\">&times;</button>';"],
  ['S-P4 an emoji button (📷) with words for nothing', "x = '<button data-x=\"1\">\\uD83D\\uDCF7</button>';"],
  ['S-P5 a clickable span ✂ with no words, no role', "x = '<span onclick=\"crop()\" style=\"a:b\">\\u2702</span>';"],
  ['S-P6 a clickable span with words but no role', "x = '<span onclick=\"crop()\" title=\"Crop\">\\u2702</span>';"],
  ['S-P7 a made-in-code ✕ with no words', "var cb = document.createElement('button');\ncb.textContent = '\\u2715';\ncb.onclick = close;"],
];
for (const [label, s] of PS) ok(label + ' — caught', scan('planted.js', s).length > 0, 'not caught');
const GOOD = [
  'x = `<button aria-label="Close" onclick="go()">×</button>`;',
  "x = '<button title=\"Zoom in\">+</button>';",
  "x = '<button data-ctip=\"Edit\">\\u270e</button>';",
  "x = '<button>Save</button>';",
  "x = '<button>' + label + '</button>';",
  "x = `<button>${n}</button>`;",
  "x = '<span role=\"button\" onclick=\"crop()\" title=\"Crop\">\\u2702</span>';",
  "var cb = document.createElement('button');\ncb.setAttribute('aria-label', 'Close');\ncb.textContent = '\\u2715';",
  "var cb = document.createElement('button');\ncb.title = 'Crop photo'; cb.textContent = '\\u2702';",
];
ok('S-G nothing that already has words (or is words) is counted', GOOD.every(s => !scan('good.js', s).length), GOOD.filter(s => scan('good.js', s).length).join(' | '));
{ // a REAL button with its words taken off is caught
  const w = read('wizard.js');
  const bad = plant(w, '<button aria-label="Close" class="btn-close" onclick="closeWizard()">', '<button class="btn-close" onclick="closeWizard()">', 'the Add screen ✕');
  ok('S-P8 the real Add screen ✕ without its words — caught', scan('wizard.js', bad).length === 1, String(scan('wizard.js', bad).length));
  const t = read('tutorial.js');
  ok('S-P9 the conductor tip\'s ✕ without its words — caught', scan('tutorial.js', plant(t, '<button aria-label="Close the guide" type="button" id="rr-guide-x"', '<button type="button" id="rr-guide-x"', 'the guide ✕')).length === 1);
}
{ // the one test lives in one place
  const defs = FILES.filter(f => /function rrSymbolOnly\s*\(/.test(read(f)));
  ok('S2 rrSymbolOnly / rrControlWords are defined once, in a11y.js', defs.length === 1 && defs[0] === 'a11y.js' && /function rrControlWords\s*\(/.test(read('a11y.js')), defs.join(','));
  ok('S3 the phone hold reads them (tutorial.js) and does not keep its own copy', /window\.rrSymbolOnly\(sym\)/.test(read('tutorial.js')) && /window\.rrControlWords\(sym\)/.test(read('tutorial.js')));
}

// ── B — the real app ──
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  symbol_words_2063_tests needs playwright for its browser half and it is not installed.'); process.exit(1); }
const { SEED } = require('./lib/guide-fixture');

async function boot(browser, phone, served) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'));
  await pg.waitForTimeout(2200);
  await pg.evaluate(SEED); await pg.waitForTimeout(300);
  return { ctx, pg, errs };
}
// the Add screen, without the one-time "Scanning and photo ID" card over it
async function openAdd(pg) {
  await pg.evaluate(() => { openWizard('collection'); });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const u = document.getElementById('rr-ai-usage-card'); if (u) u.remove(); });
  await pg.waitForTimeout(150);
}
async function touch(o, sel, ms) {
  const b = await o.pg.locator(sel).first().boundingBox();
  if (!b) return false;
  const cdp = o.cdp || (o.cdp = await o.ctx.newCDPSession(o.pg));
  const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await o.pg.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await o.pg.waitForTimeout(350);
  return true;
}
const TIP = () => { const t = document.getElementById('conductor-tip'); return { text: t ? t.textContent.trim() : null, shown: !!(t && getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().height > 0) }; };
const ADD_OPEN = () => { const w = document.getElementById('wizard-modal'); return !!(w && w.classList.contains('open')); };

// every visible symbol-only control on screen, and whether both halves of its words are there
const MEASURE = `(() => {
  const out = [];
  for (const el of document.querySelectorAll(window.RR_SYMBOL_CONTROL || 'button')) {
    if (el.closest('#conductor-tip')) continue;
    if (el.matches('[onclick]') && !el.matches('button,[role=button]')) { if (getComputedStyle(el).cursor !== 'pointer' || el.querySelector('button,a[href],[onclick],input,select,textarea')) continue; }
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || !el.getClientRects().length) continue;
    let p = el, hid = false; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') { hid = true; break; } p = p.parentElement; } if (hid) continue;
    if (!window.rrSymbolOnly(el)) continue;
    const al = el.getAttribute('aria-label') || '', ti = el.getAttribute('title') || '', ct = el.hasAttribute('data-ctip');
    const both = /[A-Za-z0-9]/.test(al) && (/[A-Za-z0-9]/.test(ti) || ct);
    out.push({ face: (el.textContent || '').trim().slice(0, 6), both, al, ti, id: el.id, oc: (el.getAttribute('onclick') || '').slice(0, 50) });
  }
  return out;
})()`;
const VIEWS = [
  ['dashboard', "showPage('dashboard', null)"],
  ['collection list', "showPage('browse', null); filterOwned();"],
  ['upgrade / want', "showPage('upgrade', null); buildUpgradePage();"],
  ['for sale', "showPage('forsale', null); buildForSalePage();"],
  ['parts', "showPage('parts', null); buildPartsPage();"],
  ['sold', "showPage('sold', null); if (typeof buildSoldPage === 'function') buildSoldPage();"],
  ['contacts', "showPage('contacts', null); if (window._ctRenderList) window._ctRenderList();"],
  ['reports', "showPage('reports', null);"],
  ['item page', "_openOwnedByInvId('46001')"],
  ['instruction sheet popup', "openISDetail('46050')"],
  ['help guide', "rrgOpen('grading')", "document.querySelectorAll('[id^=rrg]').forEach(function (e) { e.remove(); })"],
  ['terms', "rrTermsOpen()", "var t = document.getElementById('rr-terms'); if (t) t.remove();"],
  ['filter sheet', "showPage('browse', null); if (window._rrFilterSheetOpen) _rrFilterSheetOpen();", "if (window._rrFilterSheetClose) _rrFilterSheetClose();"],
  ['Add screen', "openWizard('collection'); setTimeout(function () { var u = document.getElementById('rr-ai-usage-card'); if (u) u.remove(); }, 700);", "closeWizard()"],
];
async function walk(pg) {
  const bad = [], seen = new Set();
  let n = 0;
  for (const [name, open, close] of VIEWS) {
    await pg.evaluate(new Function('try{' + open + '}catch(e){}'));
    await pg.waitForTimeout(950);
    for (const h of await pg.evaluate(MEASURE)) {
      const k = h.face + '|' + h.id + '|' + h.oc; if (seen.has(k)) continue; seen.add(k); n++;
      if (!h.both) bad.push(name + ': ' + JSON.stringify(h));
    }
    if (close) await pg.evaluate(new Function('try{' + close + '}catch(e){}'));
    await pg.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(o => { if (o.id !== 'wizard-modal') o.remove(); }); });
    await pg.waitForTimeout(150);
  }
  return { n, bad };
}

async function phoneChecks(browser, served, full) {
  const o = await boot(browser, true, served);
  const R = {};
  await openAdd(o.pg);
  R.closeWords = await o.pg.evaluate(() => { const x = document.querySelector('#wizard-modal .btn-close'); return x ? { al: x.getAttribute('aria-label'), ti: x.getAttribute('title') } : null; });
  await touch(o, '#wizard-modal .btn-close', 750);
  R.hold = await o.pg.evaluate(TIP); R.openAfterHold = await o.pg.evaluate(ADD_OPEN);
  await o.pg.waitForTimeout(700);
  await touch(o, '#wizard-modal .btn-close', 60);
  R.openAfterTap = await o.pg.evaluate(ADD_OPEN); R.tipAfterTap = await o.pg.evaluate(TIP);
  if (full) {
    // a symbol button with NO words: holding it shows nothing (and is not swallowed into a bubble)
    await o.pg.evaluate(() => { const b = document.createElement('button'); b.id = 'nw-probe'; b.textContent = '\u2295'; b.style.cssText = 'position:fixed;left:40px;top:300px;width:60px;height:60px;z-index:200000'; document.body.appendChild(b); });
    await o.pg.waitForTimeout(120);
    await touch(o, '#nw-probe', 750); R.noWords = await o.pg.evaluate(TIP);
    // a button with WORDS on its face: holding it shows nothing — it already says what it does
    await o.pg.evaluate(() => { const b = document.getElementById('nw-probe'); b.textContent = 'Save'; b.title = 'Save this'; });
    await o.pg.waitForTimeout(120);
    await touch(o, '#nw-probe', 750); R.plainWord = await o.pg.evaluate(TIP);
    // a span-style symbol (role=button, title only): the stamp gives it aria-label; the hold shows its words
    await o.pg.evaluate(() => { const b = document.getElementById('nw-probe'); b.remove(); const s = document.createElement('div'); s.innerHTML = '<span role="button" id="sp-probe" title="Make a copy of this photo" onclick="window.__sp=(window.__sp||0)+1" style="position:fixed;left:40px;top:300px;width:60px;height:60px;z-index:200000;display:block">\u29c9</span>'; document.body.appendChild(s); });
    await o.pg.waitForTimeout(200);
    R.spanAria = await o.pg.evaluate(() => document.getElementById('sp-probe').getAttribute('aria-label'));
    await touch(o, '#sp-probe', 750); R.spanHold = await o.pg.evaluate(TIP); R.spanClicks = await o.pg.evaluate(() => window.__sp || 0);
    await o.pg.evaluate(() => { const s = document.getElementById('sp-probe'); if (s) s.remove(); });
    // a real title-only button (the notice's ✕ on My Collection) gets its aria-label from the stamp
    await o.pg.evaluate(() => { showPage('browse', null); filterOwned(); });
    await o.pg.waitForTimeout(700);
    R.noticeX = await o.pg.evaluate(() => { const x = [...document.querySelectorAll('button.rr-notice-x')].find(b => b.getClientRects().length && b.getAttribute('title')); return x ? { al: x.getAttribute('aria-label'), ti: x.getAttribute('title') } : null; });
    R.walk = await walk(o.pg);
  }
  R.errs = o.errs.slice();
  await o.ctx.close();
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  const P = await phoneChecks(browser, null, true);
  ok('B1 the Add screen ✕ carries its words both ways (aria-label written once, title from the stamp)', P.closeWords && P.closeWords.al === 'Close' && P.closeWords.ti === 'Close', JSON.stringify(P.closeWords));
  ok('B2 a phone: hold the ✕ — the conductor says "Close"', P.hold.shown && P.hold.text === 'Close', JSON.stringify(P.hold));
  ok('B3 …and the hold did not press it (the Add screen is still open)', P.openAfterHold === true, String(P.openAfterHold));
  ok('B4 a quick tap still presses it (the Add screen closes, no bubble)', P.openAfterTap === false && !P.tipAfterTap.shown, JSON.stringify([P.openAfterTap, P.tipAfterTap]));
  ok('B5 a symbol button with no words: the hold shows nothing', P.noWords.text === null, JSON.stringify(P.noWords));
  ok('B6 a button with words on its face: the hold shows nothing', P.plainWord.text === null, JSON.stringify(P.plainWord));
  ok('B7 a clickable symbol span (role=button, title only) gets its aria-label from the stamp', P.spanAria === 'Make a copy of this photo', String(P.spanAria));
  ok('B8 …and holding it shows its words without pressing it', P.spanHold.shown && P.spanHold.text === 'Make a copy of this photo' && P.spanClicks === 0, JSON.stringify([P.spanHold, P.spanClicks]));
  ok('B9 a real title-only button (My Collection notice ✕) gets aria-label = its title', P.noticeX && P.noticeX.al === P.noticeX.ti && /Hide/.test(P.noticeX.al || ''), JSON.stringify(P.noticeX));
  ok('B10 phone walk: every symbol button on ' + VIEWS.length + ' screens has words both ways (' + P.walk.n + ' found)', P.walk.n >= 5 && !P.walk.bad.length, P.walk.bad.slice(0, 4).join(' | '));

  { // a computer: same walk, and a resting mouse gets no conductor bubble on a symbol button (the native title tip is its job)
    const o = await boot(browser, false, null);
    await openAdd(o.pg);
    await o.pg.locator('#wizard-modal .btn-close').hover();
    await o.pg.waitForTimeout(1900);
    const hov = await o.pg.evaluate(TIP);
    await o.pg.evaluate(() => closeWizard()); await o.pg.waitForTimeout(300);
    const w = await walk(o.pg);
    ok('B11 a computer: resting the mouse on ✕ adds no conductor bubble (its title tip is the browser\'s)', hov.text === null, JSON.stringify(hov));
    ok('B12 computer walk: every symbol button has words both ways (' + w.n + ' found)', w.n >= 5 && !w.bad.length, w.bad.slice(0, 4).join(' | '));
    P.errs = P.errs.concat(o.errs);
    await o.ctx.close();
  }
  const appErrs = P.errs.filter(e => !/fonts|Failed to fetch|net::|ERR_/i.test(e));
  ok('B13 no page errors', !appErrs.length, [...new Set(appErrs)].slice(0, 3).join(' | '));

  // ── P — old code served, each turns its own check red ──
  const PL = [
    ['P1 no hold for symbol buttons (tutorial.js)', 'tutorial.js', "      if (w) { tgt = sym; _holdWords = w.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }", '', x => x.hold.shown && x.hold.text === 'Close'],
    ['P2 the phone hides the held bubble (tutorial.css)', 'tutorial.css', '  #conductor-tip.ctip-held { display: flex !important; }', '', x => x.hold.shown],
    ['P3 no stamp (a11y.js)', 'a11y.js', "        if (!el.hasAttribute('title') && !el.hasAttribute('data-ctip')) el.setAttribute('title', w);", '', x => x.closeWords && x.closeWords.ti === 'Close'],
    ['P4 the Add screen ✕ without words (wizard.js) — the hold and the walk both', 'wizard.js', '<button aria-label="Close" class="btn-close" onclick="closeWizard()">', '<button class="btn-close" onclick="closeWizard()">', x => (x.hold.shown && x.openAfterHold) || !x.walk.bad.some(b => /closeWizard/.test(b)), true],
  ];
  for (const [label, file, from, to, still, full] of PL) {
    let x = null;
    try { x = await phoneChecks(browser, { [file]: plant(read(file), from, to, label) }, !!full); } catch (e) { x = null; console.log('   (' + label + ': ' + e.message + ')'); }
    let s = false; try { s = !!(x && still(x)); } catch (e) { s = false; }
    ok(label + ' — caught', x && !s, x ? 'the check still passed' : 'the planted run did not finish');
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
