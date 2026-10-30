#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE HOME BAR — v0.9.2055 (known-problems sweep, release 4, type A1)
//
// [stated] Brad 2026-10-30 05:45 CT: "check other chats to make sure your not
// working on the same thing and then yes start on it".
// An iPhone (and an iPad) keeps a strip at the bottom of the screen for its home
// bar — 34 px on a modern iPhone. A tap there goes to the PHONE, not the app.
// Measured on the real app at iPhone size with Chromium's own safe-area
// emulation: 11 bars and pills had their buttons on that strip (Share
// selected, the bulk-tag bar, the trial bar, the "changes not saved" badge,
// the catalog-stall and error banners, the help sheet, the inbox's group
// panel, the preload pill, the two "Back to …" pills).
//
//   ONE setting: --rr-safe-b in app.css's :root (= the home-bar strip, 0 on a
//   computer). Every bar or pill pinned to the bottom adds it.
//   S  the scan — every position:fixed thing pinned to the bottom (bottom ≤ 2rem,
//      not a full-height overlay) in app/*.js (acorn: every string literal and
//      its '+' chain; stylesheet strings split by rule), app/*.css (by
//      selector) and index.html carries var(--rr-safe-b); and
//      env(safe-area-inset-bottom) is written ONCE, in that :root line.
//   B  the real app in Chromium, 390x844, touch, a 34 px home bar: each bar
//      opened by the app's own code; no tap target's CONTENT in the strip, and
//      each bar really drawn (no vacuous pass).
//   P  planted offenders — each turns its own check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium, acorn;
try { chromium = require('playwright').chromium; acorn = require('acorn'); }
catch (e) { console.log('FAILED  —  home_bar_2055_tests needs playwright and acorn: ' + e.message); process.exit(1); }
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

// ── S: the scan ────────────────────────────────────────────────────────────
// "pinned to the bottom" = bottom 0 … 2rem (32 px), once the safe-area term is taken out
function lowBottom(v) {
  v = v.trim().replace(/^var\(--rr-safe-b[^)]*\)$/, '0').replace(/^calc\((.*)\)$/, '$1').replace(/\s*\+\s*var\(--rr-safe-b[^)]*\)/, '').trim();
  let m;
  if (/^0(px|rem)?$/.test(v)) return true;
  if ((m = /^(-?[0-9.]+)px$/.exec(v))) return +m[1] <= 32;
  if ((m = /^(-?[0-9.]+)rem$/.exec(v))) return +m[1] <= 2;
  return false;
}
function bottomOf(style) { const m = /(?:^|[;\s{])bottom\s*:\s*([^;!}]+)/.exec(style); return m && m[1].trim(); }
function fullHeight(style) { return /(?:^|[;\s{])(top|inset)\s*:/.test(style); }
function pinnedRule(style) { if (!/position\s*:\s*fixed/.test(style)) return null; const b = bottomOf(style); return (b && lowBottom(b) && !fullHeight(style)) ? b : null; }

function scanFile(f, s) {
  const out = [];
  if (/\.css$/.test(f)) {
    const re = /([^{}]+)\{([^{}]*)\}/g; let m; const bySel = {}, hits = [];
    while ((m = re.exec(s))) {
      const sel = m[1].trim().split('\n').pop().trim(), b = m[2];
      (bySel[sel] = bySel[sel] || []).push(b);
      const bv = pinnedRule(b); if (bv) hits.push([sel, s.slice(0, m.index).split('\n').length, bv]);
    }
    for (const [sel, line, bv] of hits) out.push({ where: f + ':' + line + ' ' + sel, bottom: bv, ok: (bySel[sel] || []).some(b => b.includes('--rr-safe-b')) });
    return out;
  }
  if (/\.html$/.test(f)) {
    const re = /style\s*=\s*"([^"]*)"/g; let m;
    while ((m = re.exec(s))) { const bv = pinnedRule(m[1]); if (bv) out.push({ where: f + ':' + s.slice(0, m.index).split('\n').length, bottom: bv, ok: m[1].includes('--rr-safe-b') }); }
    return out;
  }
  const toks = []; for (const t of acorn.tokenizer(s, { ecmaVersion: 'latest', locations: true })) toks.push(t);
  const isStr = t => t.type.label === 'string' || t.type.label === 'template';
  const isPlus = t => t && t.type.label === '+/-' && t.value === '+';
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]; if (!isStr(t) || !/position\s*:\s*fixed/.test(t.value)) continue;
    let a = k, b = k;
    while (a >= 2 && isPlus(toks[a - 1]) && isStr(toks[a - 2])) a -= 2;
    while (b + 2 < toks.length && isPlus(toks[b + 1]) && isStr(toks[b + 2])) b += 2;
    const style = toks.slice(a, b + 1).filter(isStr).map(x => x.value).join(''); k = b;
    const parts = /\{/.test(style) ? (style.match(/[^{}]*\{[^{}]*\}/g) || []).map(r => r.slice(r.indexOf('{'))) : [style];
    for (const st of parts) { const bv = pinnedRule(st); if (bv) out.push({ where: f + ':' + t.loc.start.line, bottom: bv, ok: st.includes('--rr-safe-b') }); }
  }
  return out;
}
const FILES = fs.readdirSync(APP).filter(f => /\.(js|css|html)$/.test(f));
const ALL = [].concat(...FILES.map(f => scanFile(f, read(f))));
const MISSING = ALL.filter(x => !x.ok);
ok('S1 every bar / pill pinned to the bottom carries var(--rr-safe-b) (' + ALL.length + ' found)', !MISSING.length, MISSING.map(x => x.where + ' bottom:' + x.bottom).join('  '));
ok('S1 the scan really finds the pinned bars (share, bulk-tag, trial bar, badge, pills… ≥ 18)', ALL.length >= 18 && ['share.js', 'bulk-tag.js', 'vault.js', 'app.css', 'wizard.js', 'photo-inbox-grid.js', 'help-guides.js'].every(f => ALL.some(x => x.where.startsWith(f + ':'))), ALL.map(x => x.where).join(', '));
const ENV = FILES.map(f => [f, (read(f).match(/env\(\s*safe-area-inset-bottom/g) || []).length]).filter(x => x[1]);
ok('S2 env(safe-area-inset-bottom) is read ONCE — the --rr-safe-b line in app.css', ENV.length === 1 && ENV[0][0] === 'app.css' && ENV[0][1] === 1 && /:root \{ --rr-safe-b: env\(safe-area-inset-bottom, 0px\); \}/.test(read('app.css')), JSON.stringify(ENV));
// planted (S)
const PS = [
  ['share.js', "padding:0.75rem 1rem;padding-bottom:calc(0.75rem + var(--rr-safe-b, 0px));", 'padding:0.75rem 1rem;', 'a flush bar (+ chain) without it'],
  ['wizard.js', "position:fixed;bottom:calc(1.1rem + var(--rr-safe-b, 0px));left:50%;", 'position:fixed;bottom:1.1rem;left:50%;', 'a floating pill without it'],
  ['appearance.js', "#rrap-prevbar{position:fixed;left:50%;bottom:calc(1.1rem + var(--rr-safe-b, 0px));", '#rrap-prevbar{position:fixed;left:50%;bottom:1.1rem;', 'a rule inside a stylesheet string'],
  ['app.css', "#rr-outbox-badge { position: fixed; left: 1rem; bottom: calc(1rem + var(--rr-safe-b));", '#rr-outbox-badge { position: fixed; left: 1rem; bottom: 1rem;', 'a stylesheet rule'],
  ['vault.js', "position:fixed;bottom:calc(30px + var(--rr-safe-b, 0px));left:50%;", 'position:fixed;bottom:30px;left:50%;', 'a template-literal style'],
];
for (const [f, from, to, label] of PS) ok('S1 P ' + label + ' (' + f + ') turns S1 red', scanFile(f, plant(read(f), from, to, label)).some(x => !x.ok));
ok('S2 P a second env(safe-area-inset-bottom) turns S2 red', (plant(read('share.js'), 'var(--rr-safe-b, 0px)', 'env(safe-area-inset-bottom)', 'S2').match(/env\(\s*safe-area-inset-bottom/g) || []).length > 0);
ok('S1 P a full-height overlay (inset:0) is NOT a bar — the scan leaves it alone', !scanFile('x.js', "el.style.cssText = 'position:fixed;inset:0;bottom:0;z-index:9';").length);

// ── B: the real app, iPhone size, a 34 px home bar ─────────────────────────
const HB = 34;
const MEASURE = `(function (HB) {
  var H = window.innerHeight, out = [];
  // a bar that scrolls inside itself is measured scrolled to its END (its last button)
  document.querySelectorAll('body *').forEach(function (e) {
    var cs = getComputedStyle(e);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2) {
      var f = e; while (f && f !== document.body && getComputedStyle(f).position !== 'fixed') f = f.parentElement;
      if (f && f !== document.body) e.scrollTop = e.scrollHeight;
    }
  });
  function fixedAnc(e) { for (var p = e; p && p !== document.body; p = p.parentElement) { var cs = getComputedStyle(p); if (cs.position === 'fixed' || cs.position === 'sticky') return p; } return null; }
  var cands = Array.from(document.querySelectorAll('button, a, input, select, textarea, [onclick], [role=button], label'));
  document.querySelectorAll('body *').forEach(function (e) { if (typeof e.onclick === 'function' || getComputedStyle(e).cursor === 'pointer') cands.push(e); });
  var seen = new Set();
  cands.forEach(function (e) {
    var r0 = e.getBoundingClientRect(); if (!r0.width || !r0.height) return;
    var cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    // a whole bar that is its own tap target: its CONTENT counts, not the padding that colours the strip
    var bottom = r0.bottom - (parseFloat(cs.paddingBottom) || 0) - (parseFloat(cs.borderBottomWidth) || 0);
    if (bottom <= H - HB + 0.5 || r0.top >= H) return;
    var x = Math.min(innerWidth - 1, Math.max(0, r0.left + r0.width / 2)), y = Math.min(H - 1, (Math.max(r0.top, H - HB) + Math.min(bottom, H)) / 2);
    var top = document.elementFromPoint(x, y);
    if (!top || !(e === top || e.contains(top) || top.contains(e))) return;   // covered by something else
    var f = fixedAnc(e), key = (f && (f.id || f.className) || 'page') + ' > ' + (e.id || e.textContent.trim().slice(0, 24) || e.tagName);
    if (seen.has(key)) return; seen.add(key);
    out.push(key + ' [' + Math.round(r0.top) + '-' + Math.round(bottom) + ']');
  });
  return out;
})(${HB})`;
// [name, open (the app's own code), the bar that must be drawn, close]
const VIEWS = [
  ['dashboard + "changes not saved" badge', "showPage('dashboard', null)", 'rr-outbox-badge', ''],
  ['Share selected bar', "showPage('browse', null); filterOwned(); startShareMode('collection');", 'share-bottom-bar', "cancelShareMode()"],
  ['bulk-tag bar', "_rrTag = { field:'notes', label:'Notes', value:'Shelf A', pairValue:'', sel:{} }; rrTagBar();", 'rr-tag-bar', "_rrTag = null; rrTagBar();"],
  ['trial bar', "_subTrialBar({ daysLeft: 3 })", 'sub-banner', "document.getElementById('sub-banner').remove()"],
  ['catalog stall banner', "_catalogStallBanner(true)", 'cat-stall-banner', "_catalogStallBanner(false)"],
  ['error banner', "for (var i = 0; i < 4; i++) window.dispatchEvent(new ErrorEvent('error', { message: 'TypeError: x is undefined', error: new TypeError('x is undefined'), filename: location.href }))", 'rr-err-banner', "document.getElementById('rr-err-banner').remove()"],
  ['help sheet (phone)', "rrgOpen('grading')", 'rrg-modal', "document.querySelectorAll('[id^=rrg]').forEach(function (e) { e.remove(); })"],
  ['inbox group panel', "window._pinGo(); setTimeout(function () { window._pinStartMode('group'); }, 600)", 'pin-grp-panel', "window._pinFinishMode()"],
  ['Reconnect bar', "window._rrTokenUsable = function () { return false; }; document.getElementById('app').classList.add('active'); _rrShowReconnect()", 'rr-reconnect-bar', "document.getElementById('rr-reconnect-bar').remove()"],
  ['catalog loading pill', "_catalogPillShow()", 'cat-loading-pill', "_catalogPillHide()"],
  ['preload pill', "_showPreloadPill(100)", 'preload-status-pill', "document.getElementById('preload-status-pill').remove()"],
  ['market toast', "vaultShowToast('Testing the market toast')", 'vault-toast', "document.getElementById('vault-toast').remove()"],
  ['"Back to …" pill (owned item)', "_rrOwnedOpen('46001', 'inbox')", 'wiz-return-pill', "document.getElementById('wiz-return-pill').remove()"],
  ['"Back to the inbox" pill', "window._pinGo(); setTimeout(function () { window._pinSeeOwned('46001'); }, 400)", 'pin-owned-pill', "document.getElementById('pin-owned-pill').remove()"],
  ['Add screen', "openWizard('collection')", 'wizard-modal', "closeWizard()"],
];

async function boot(browser, served) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try {
    localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1');
    // one change waiting to save, so the "changes not saved" badge is up
    localStorage.setItem('rr_write_outbox', JSON.stringify([{ id: 't1', at: Date.now() - 3600000, label: 'test', method: 'PUT', range: 'x', values: [[1]] }]));
  } catch (e) {} });
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: HB, left: 0, right: 0 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
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
async function walk(pg, views) {
  const res = {};
  for (const [name, open, id, close] of views) {
    await pg.evaluate(new Function('try{' + open + '}catch(e){window.__e=e.message}'));
    await pg.waitForTimeout(1200);
    const e = await pg.evaluate(() => { const x = window.__e; window.__e = null; return x; });
    const drawn = await pg.evaluate(id => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return !!(r.width && r.height && cs.display !== 'none' && cs.visibility !== 'hidden' && r.top < innerHeight); }, id);
    const safe = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--rr-safe-b').trim());
    const hits = await pg.evaluate(MEASURE);
    res[name] = { e, drawn, hits, safe };
    if (close) await pg.evaluate(new Function('try{' + close + '}catch(e){}'));
    await pg.waitForTimeout(250);
  }
  return res;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  const a = await boot(browser);
  const r = await walk(a.pg, VIEWS);
  ok('B0 the home bar is really there in this browser (Chromium safe-area emulation → --rr-safe-b = 34px)', /^34px$/.test(Object.values(r)[0].safe || '') || !!(await a.pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;bottom:0;padding-bottom:var(--rr-safe-b)'; document.body.appendChild(d); const v = getComputedStyle(d).paddingBottom; d.remove(); return v === '34px'; })), Object.values(r)[0].safe);
  for (const [name] of VIEWS) {
    const x = r[name];
    ok('B ' + name + ' — opens, drawn', !x.e && x.drawn, (x.e || '') + ' drawn=' + x.drawn);
    ok('B ' + name + ' — nothing to tap on the home-bar strip', !x.hits.length, x.hits.join(' | '));
  }
  ok('B no page errors while walking', !a.errs.length, [...new Set(a.errs)].slice(0, 3).join(' | '));
  await a.ctx.close();

  // ── P: the old lines served — each bar's own screen goes red ──
  const PB = [
    ['share.js', "padding:0.75rem 1rem;padding-bottom:calc(0.75rem + var(--rr-safe-b, 0px));", 'padding:0.75rem 1rem;', 'Share selected bar', 'P1 Share selected without the home-bar room'],
    ['bulk-tag.js', "padding:0.6rem 0.9rem;padding-bottom:calc(0.6rem + var(--rr-safe-b, 0px));", 'padding:0.6rem 0.9rem;', 'bulk-tag bar', 'P2 the bulk-tag bar without it'],
    ['wizard.js', "position:fixed;bottom:calc(1.1rem + var(--rr-safe-b, 0px));left:50%;", 'position:fixed;bottom:1.1rem;left:50%;', '"Back to …" pill (owned item)', 'P3 a "Back to …" pill without it'],
    ['app.css', "  :root { --rr-safe-b: env(safe-area-inset-bottom, 0px); }", "  :root { --rr-safe-b: 0px; }", 'trial bar', 'P4 the ONE setting not reading the home bar'],
  ];
  const served = {};
  for (const [f, from, to, , label] of PB) served[f] = plant(served[f] || read(f), from, to, label);
  const b = await boot(browser, served);
  const pr = await walk(b.pg, VIEWS.filter(v => PB.some(p => p[3] === v[0])));
  await b.ctx.close();
  for (const [, , , view, label] of PB) ok(label + ' — turns "' + view + '" red', pr[view] && pr[view].drawn && pr[view].hits.length > 0, JSON.stringify(pr[view]));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
