#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE ADS TAG + THE AFTER-CHECKOUT WELCOME PAGE   (site release 2026-10-20)
//
// [stated] Brad 2026-10-20: "lets do the paid deal with google" → "can we add the
// tag now" → "yes" to: Google's ad tag on the PUBLIC website only (home page +
// /welcome/), never inside the app; Stripe sends new members to /welcome/, which
// counts one free trial and moves them on to /app/?checkout=done.
//
// Checks — each also run against a PLANTED offender that must make it fail:
//   O  one place: the tag's ID and label live in site/ads-tag.js and nowhere else
//   A  the app never loads Google's ad script (nothing under app/ does)
//   L  the home page and the welcome page load /site/ads-tag.js
//   W  the welcome page, run for real in a sandbox:
//        W1 back from Stripe → ONE "conversion" to the right send_to, with the
//           checkout reference as transaction_id, then on to /app/?checkout=done
//        W2 the same checkout reloaded → no second count, still moves on
//        W3 no ?checkout=done → nothing counted, on to /app/
//        W4 Google's script blocked or silent → still moves on, within 3 s
//   N  the welcome page is noindex, on the publish list, and not in the sitemap
//   V  the privacy page says the two public pages use Google's ad tag, and no
//      longer says "We don't run third-party advertising or analytics trackers"
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };

let pass = 0, fail = 0;
function ok(name, cond, why) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (why ? '  —  ' + why : '')); }
}

const TAG = rd('site/ads-tag.js') || '';
const ID = (TAG.match(/id:\s*'(AW-\d+)'/) || [])[1];
const LABEL = (TAG.match(/signupLabel:\s*'([^']+)'/) || [])[1];
ok('site/ads-tag.js names the account tag and the sign-up label', !!ID && !!LABEL, ID + ' / ' + LABEL);

// Every text file in the repo except tests/, node_modules and .git.
function repoFiles(dir, out) {
  for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'tests'].includes(d.name)) continue;
    const rel = dir ? dir + '/' + d.name : d.name;
    if (d.isDirectory()) repoFiles(rel, out);
    else if (/\.(js|html|json|md|txt|yml|css|xml)$/i.test(d.name)) out.push(rel);
  }
  return out;
}
const FILES = repoFiles('', []);
const content = {}; for (const f of FILES) content[f] = rd(f) || '';

// ── O · one place ──────────────────────────────────────────────────────────
function checkOnePlace(c) {
  const bad = Object.keys(c).filter(f => f !== 'site/ads-tag.js' && ((ID && c[f].includes(ID.replace('AW-', ''))) || (LABEL && c[f].includes(LABEL))));
  return bad.length ? 'also in ' + bad.join(', ') : '';
}
{ const w = checkOnePlace(content); ok('O  the ID and label live in site/ads-tag.js only', !w, w); }
{ const p = Object.assign({}, content, { 'index.html': content['index.html'] + '\n<!-- ' + LABEL + ' -->' });
  ok('PLANTED the label copied into index.html → O fails', !!checkOnePlace(p)); }

// ── A · the app never loads Google's ad script ─────────────────────────────
function checkApp(c) {
  const bad = Object.keys(c).filter(f => f.startsWith('app/') && /googletagmanager|googleadservices|ads-tag\.js|gtag\(/.test(c[f]));
  return bad.length ? 'loaded in ' + bad.join(', ') : '';
}
{ const w = checkApp(content); ok('A  nothing under app/ loads Google\'s ad script', !w, w); }
{ const p = Object.assign({}, content, { 'app/index.html': content['app/index.html'] + '\n<script src="/site/ads-tag.js"></script>' });
  ok('PLANTED the tag added to app/index.html → A fails', !!checkApp(p)); }

// ── L · the two public pages load it ───────────────────────────────────────
const loads = h => /<script[^>]+src="\/site\/ads-tag\.js"/.test(h || '');
ok('L  the home page loads /site/ads-tag.js', loads(content['index.html']));
ok('L  the welcome page loads /site/ads-tag.js', loads(content['welcome/index.html']));
ok('PLANTED a page without it → L fails', !loads('<html><head></head></html>'));

// ── W · the welcome page, run in a sandbox ─────────────────────────────────
const WELCOME = content['welcome/index.html'] || '';
const INLINE = (WELCOME.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/) || [])[1] || '';
ok('W  the welcome page has its inline script', !!INLINE);

function runWelcome(search, opts) {
  opts = opts || {};
  const replaced = [], timers = [], store = opts.store || {};
  const sb = {
    location: { search, replace: u => replaced.push(u) },
    sessionStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
    URLSearchParams, Date
  };
  sb.window = sb;
  vm.createContext(sb);
  if (!opts.noTag) vm.runInContext(TAG, sb);
  vm.runInContext(opts.script || INLINE, sb);
  const events = (sb.dataLayer || []).map(a => Array.from(a)).filter(a => a[0] === 'event' && a[1] === 'conversion');
  return { replaced, timers, store, events };
}

{ const r = runWelcome('?checkout=done&session_id=cs_A');
  const e = r.events[0] && r.events[0][2];
  ok('W1 back from Stripe → exactly one conversion counted', r.events.length === 1, r.events.length);
  ok('W1 …sent to this account\'s "Free trial started"', e && e.send_to === ID + '/' + LABEL, e && e.send_to);
  ok('W1 …with the checkout reference as transaction_id', e && e.transaction_id === 'cs_A');
  ok('W1 …and nobody is moved on before Google answers', r.replaced.length === 0, r.replaced);
  if (e) e.event_callback();
  r.timers.forEach(t => t.fn());
  ok('W1 …then on to /app/?checkout=done, once', r.replaced.length === 1 && r.replaced[0] === '/app/?checkout=done', r.replaced);
  const again = runWelcome('?checkout=done&session_id=cs_A', { store: r.store });
  ok('W2 the same checkout reloaded → not counted again', again.events.length === 0, again.events.length);
  ok('W2 …and still moved on to /app/?checkout=done', again.replaced[0] === '/app/?checkout=done', again.replaced);
  // PLANTED: the once-per-checkout guard removed
  const noGuard = INLINE.replace('if (!already && window.gtag', 'if (window.gtag');
  ok('PLANTED guard anchor found', noGuard !== INLINE);
  const twice = runWelcome('?checkout=done&session_id=cs_A', { store: r.store, script: noGuard });
  ok('PLANTED without the guard a reload counts again (W2 can fail)', twice.events.length === 1);
}
{ const r = runWelcome('');
  ok('W3 no ?checkout=done → nothing counted', r.events.length === 0);
  ok('W3 …straight on to /app/', r.replaced[0] === '/app/', r.replaced); }
{ const r = runWelcome('?checkout=done&session_id=cs_B');
  const t = r.timers[0];
  ok('W4 Google silent → a fallback timer of 3 s or less', t && t.ms <= 3000, t && t.ms);
  if (t) t.fn();
  ok('W4 …which moves the member on to /app/?checkout=done', r.replaced[0] === '/app/?checkout=done', r.replaced); }
{ const r = runWelcome('?checkout=done&session_id=cs_C', { noTag: true });
  ok('W4 Google\'s script missing entirely → moved on at once', r.replaced[0] === '/app/?checkout=done', r.replaced); }

// ── N · not in search, but on the website ──────────────────────────────────
ok('N  the welcome page is noindex', /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(WELCOME));
ok('N  the welcome page is on the publish list', /^publish:\s*welcome\s*$/m.test(rd('.github/site-files.txt') || ''));
ok('N  the sitemap does not list it', !/\/welcome\//.test(rd('sitemap.xml') || ''));

// ── V · the privacy page tells the truth ───────────────────────────────────
function checkPrivacy(h) {
  h = h || '';
  if (/We don't run third-party advertising or analytics trackers/.test(h)) return 'still says there are no advertising trackers';
  if (!/Google's advertising tag/.test(h) || !/home page/.test(h) || !/Welcome aboard/.test(h)) return 'does not name the tag and the two pages';
  return '';
}
{ const w = checkPrivacy(content['privacy/index.html']); ok('V  the privacy page names the ad tag and the two pages', !w, w); }
ok('PLANTED the old privacy sentence → V fails',
   !!checkPrivacy('<p>We don\'t run third-party advertising or analytics trackers.</p>'));

console.log('\n' + (fail ? 'FAILED' : 'ALL ADS TAG TESTS GREEN') + ' (' + pass + ' passed, ' + fail + ' failed)');
process.exit(fail ? 1 : 0);
