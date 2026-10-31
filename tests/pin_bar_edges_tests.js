#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE PHOTO INBOX TOP BAR MEETS THE PAGE'S EDGES ON EVERY SCREEN
// (found by the first full Safari walk, 2026-10-31; [stated] Brad "yes" to
// fixing it)
//
// The inbox's pinned top bar (title, count, "? How this works") reaches out to
// .main's edges with negative margins. It repeated the computer's 1.5rem, so on
// a phone (.main padding 0.75rem) it stuck out 12px each side — the whole inbox
// could be pushed sideways — and beside an iPhone's notch (47px) it fell short.
// Now .main's top / left / right padding live in ONE place each (app.css
// --rr-main-pt / --rr-main-pr / --rr-main-pl) and the bar reads them.
//   S  source: no .main rule sets its top / left / right padding directly, and
//      no app markup reaches .main's edges with a fixed -1.5rem — each proven
//      on planted offenders.
//   B  the real app in Chromium, five screens (computer, phone, notched phone
//      on its side with the safe area emulated, phone on its side, tablet):
//      .main's padding is exactly what it was before this release, the bar is
//      flush with .main on the left, right and top, and nothing scrolls
//      sideways.
//   P  the old bar served — the phone and notch screens turn red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
const CSS = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');

// ── S ──
// Every rule whose selector list is exactly `.main` — its declarations.
function mainRules(css) {
  const out = []; const re = /(^|[}\n])\s*\.main\s*\{([^}]*)\}/g; let m;
  while ((m = re.exec(css))) out.push(m[2]);
  return out;
}
function directEdgePadding(css) {
  return mainRules(css).filter(b => {
    const d = b.replace(/\/\*[\s\S]*?\*\//g, '');
    if (/(^|[;\s])padding-(top|left|right)\s*:/.test(d)) return true;
    const sh = d.match(/(^|[;\s])padding\s*:\s*([^;]+)/);
    return !!(sh && !/var\(--rr-main-pt\)\s+var\(--rr-main-pr\)\s+\S+\s+var\(--rr-main-pl\)/.test(sh[2]));
  });
}
ok('S0 app.css has .main rules to check', mainRules(CSS).length >= 4, mainRules(CSS).length);
ok('S1 no .main rule sets its top / left / right padding directly (only the three settings)', !directEdgePadding(CSS).length, directEdgePadding(CSS).map(x => x.trim().slice(0, 80)).join(' | '));
ok('S1-P1 the old phone rule — caught', directEdgePadding('\n    .main { padding: 0.75rem 0.75rem 92px; }').length === 1);
ok('S1-P2 the old notch rule — caught', directEdgePadding('\n    .main {\n      padding-top: 0.75rem;\n      padding-left: max(0.75rem, env(safe-area-inset-left));\n    }').length === 1);
ok('S1-G a bottom-only rule — not caught', !directEdgePadding('\n    .main { --rr-main-pt: 0.75rem; padding-bottom: 92px; }').length);
function fixedReach(name, src) {
  const out = [];
  src.split('\n').forEach((ln, i) => { if (!/^\s*\/\//.test(ln) && /(margin(-left|-right)?|top)\s*:\s*-1\.5rem/.test(ln)) out.push(name + ':' + (i + 1)); });
  return out;
}
let fr = [];
for (const f of fs.readdirSync(APP).filter(f => /\.(js|html|css)$/.test(f) && !/vendor|\.min\./.test(f))) fr = fr.concat(fixedReach(f, fs.readFileSync(path.join(APP, f), 'utf8')));
ok('S2 no app markup reaches .main\'s edges with a fixed -1.5rem', !fr.length, fr.join(' | '));
ok('S2-P the old bar — caught', fixedReach('p.js', `'<div id="pin-chrome" style="position:sticky;top:-1.5rem;z-index:5;' + 'margin:-1.5rem -1.5rem 0;'`).length === 1);

// ── B ──
let pw;
try { pw = require('playwright'); }
catch (e) { console.log('FAILED  —  pin_bar_edges_tests needs playwright for its browser half and it is not installed.'); process.exit(1); }

// .main's padding on each screen as it was BEFORE this release (measured on
// 6bccd1e9, v0.9.2081) — this release must not move it by a pixel.
const SCREENS = [
  ['computer', { viewport: { width: 1280, height: 900 } }, null, '24px 24px 24px 24px'],
  ['phone', pw.devices['iPhone 13'], null, '12px 12px 92px 12px'],
  ['notched phone on its side', pw.devices['iPhone 13 landscape'], { top: 0, bottom: 21, left: 47, right: 47 }, '8px 47px 113px 47px'],
  ['phone on its side', pw.devices['iPhone 13 landscape'], null, '8px 12px 92px 12px'],
  ['tablet', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }, null, '24px 24px 24px 24px'],
];
const OLD_BAR = 'position:sticky;top:-1.5rem;z-index:5;background:var(--bg);margin:-1.5rem -1.5rem 0;padding:1.5rem 1.5rem 0.55rem;box-shadow:0 6px 10px -8px rgba(0,0,0,0.25)';

async function measure(browser, plantOld) {
  const out = {};
  for (const [name, dev, insets] of SCREENS) {
    const o = Object.assign({}, dev); delete o.defaultBrowserType;
    const ctx = await browser.newContext(o);
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    await ctx.route('**', r => { const u = r.request().url(); return /^(file|data|about|blob):/.test(u) ? r.continue() : r.abort(); });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    if (insets) await (await ctx.newCDPSession(pg)).send('Emulation.setSafeAreaInsetsOverride', { insets });
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForFunction(() => typeof buildApp === 'function' && typeof window._pinGo === 'function', null, { timeout: 15000 });
    await pg.waitForTimeout(900);
    await pg.evaluate(SEED); await pg.waitForTimeout(250);
    await pg.evaluate(() => window._pinGo(document.getElementById('nav-photo-inbox')));
    await pg.waitForTimeout(700);
    if (plantOld) await pg.evaluate((s) => { document.getElementById('pin-chrome').setAttribute('style', s); }, OLD_BAR);
    out[name] = await pg.evaluate(() => {
      const m = document.querySelector('.main'), cs = getComputedStyle(m), mr = m.getBoundingClientRect();
      const c = document.getElementById('pin-chrome');
      const cr = c && c.offsetParent ? c.getBoundingClientRect() : null;
      const inner = { l: mr.left + m.clientLeft, r: mr.left + m.clientLeft + m.clientWidth, t: mr.top + m.clientTop };
      return {
        pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
        bar: cr ? { l: Math.round(cr.left - inner.l), r: Math.round(inner.r - cr.right), t: Math.round(cr.top - inner.t) } : null,
        sideways: m.scrollWidth - m.clientWidth,
      };
    });
    out[name].errs = errs;
    await ctx.close();
  }
  return out;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await pw.chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  const R = await measure(browser, false);
  for (const [name, , , pad] of SCREENS) {
    const x = R[name];
    ok('B1 ' + name + ': .main\'s padding is exactly what it was (' + pad + ')', x.pad === pad, x.pad);
    ok('B2 ' + name + ': the inbox top bar is flush with the page on the left, right and top', !!x.bar && x.bar.l === 0 && x.bar.r === 0 && x.bar.t === 0, JSON.stringify(x.bar));
    ok('B3 ' + name + ': the inbox cannot be pushed sideways', x.sideways <= 0, x.sideways + 'px');
    ok('B4 ' + name + ': no page errors', !x.errs.length, x.errs.join(' | '));
  }
  const P = await measure(browser, true);
  ok('P1 the old bar on a phone — sticks out, red', P['phone'].bar.l < 0 && P['phone'].sideways > 0, JSON.stringify(P['phone']));
  ok('P2 the old bar beside a notch — falls short, red', P['notched phone on its side'].bar.l > 0, JSON.stringify(P['notched phone on its side'].bar));
  ok('P3 the old bar on a computer — fits (its values WERE the computer\'s)', P['computer'].bar.l === 0, JSON.stringify(P['computer'].bar));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
