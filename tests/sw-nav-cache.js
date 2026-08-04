// Does a page load actually reach the server?
//
//   node tests/sw-nav-cache.js
//
// Not part of `npm test` — it drives a real Chromium and takes about a minute.
// Run it whenever app/sw.js changes. The node suite's §210 is the cheap guard
// that runs on every push; this is the one that proves the guard is guarding
// the right thing.
//
// ── why this file exists ────────────────────────────────────────────────────
// v0.9.1259 made navigations network-first, to fix "I reset twice and it still
// looks the same." It was verified against a local static server. That server
// sent no caching headers, and GitHub Pages sends `cache-control: max-age=600`.
//
// With that header present the fix did almost nothing, because a re-fetch
// inside a service worker inherits the cache MODE of the request it was handed,
// and a navigation's mode is "default" — which permits the browser's own disk
// cache to answer without a round trip. Measured: a typed URL, a bookmark, a
// home-screen launch, the landing page's hop into /app/, and an in-page
// `location.href =` all got the previous build, and the server was never asked.
// The stale index.html then re-registered the OLD sw.js, so the update did not
// arrive late — it never began.
//
// So this harness sends the real header, and asserts on the SERVER LOG rather
// than on what appeared on screen. "The page looked right" is not the question.
//
// Each scenario gets its own fresh browser profile. The first draft shared one
// and quietly lied: the Refresh scenario pulled the new build into the HTTP
// cache, and the next scenario read it from disk and looked like a pass.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.error('playwright is not installed here — skipping.\n' +
                'This test needs a browser; the node suite’s §210 does not.');
  process.exit(0);
}

// Chromium is preinstalled in the dev container. Do not run `playwright
// install` — PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set for a reason.
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const REPO = path.join(__dirname, '..');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-nav-'));
const APP = path.join(ROOT, 'app');
fs.cpSync(path.join(REPO, 'app'), APP, { recursive: true });

// The app under test is the real one; only a build marker is injected, so the
// question "which build is this page" has an answer that does not depend on
// reading the app's own version banner (which is itself cache-sensitive).
const INDEX = path.join(APP, 'index.html');
const ORIGINAL = fs.readFileSync(INDEX, 'utf8');
const STAMP = (ORIGINAL.match(/\?v=(\d+)/) || [])[1];
if (!STAMP) { console.error('could not find a ?v= stamp in app/index.html'); process.exit(2); }

function setBuild(marker, stamp) {
  let h = ORIGINAL.replace(new RegExp('\\?v=' + STAMP, 'g'), '?v=' + stamp);
  h = h.replace('<head>', '<head>\n<meta name="build-marker" content="' + marker + '">');
  fs.writeFileSync(INDEX, h);
}

// The landing page hop, the way the real root page does it.
fs.writeFileSync(path.join(ROOT, 'index.html'),
  '<!doctype html><meta charset=utf-8><title>landing</title>' +
  '<script>location.replace("/app/");</script>');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif' };
let log = [];
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  log.push(u);
  let file = path.join(ROOT, decodeURIComponent(u));
  if (u.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'cache-control': 'max-age=600' }); return res.end('nope');
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    // The one header that made the earlier verification worthless.
    'cache-control': 'max-age=600',
  });
  res.end(fs.readFileSync(file));
});

let BASE = '';
const results = [];
function say(pass, name, detail) {
  results.push({ name, pass });
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name.padEnd(44) + ' ' + detail);
}
const readMarker = p => p.evaluate(() =>
  (document.querySelector('meta[name=build-marker]') || {}).content || '(none)');

async function fresh(tag) {
  const dir = path.join(ROOT, 'profile-' + tag.replace(/\W+/g, '_'));
  fs.rmSync(dir, { recursive: true, force: true });
  return chromium.launchPersistentContext(dir,
    { executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
}

// Warm on build A until the worker is in charge, deploy build B, then run one
// entry path and see what it gets.
async function scenario(name, run) {
  const ctx = await fresh(name);
  try {
    setBuild('A', STAMP);
    const warm = await ctx.newPage(); warm.on('pageerror', () => {});
    await warm.goto(BASE + '/app/', { waitUntil: 'load' });
    await warm.evaluate(() => navigator.serviceWorker.ready);
    await warm.waitForTimeout(1200);
    const controlled = await warm.evaluate(() => !!navigator.serviceWorker.controller);
    await warm.close();
    if (!controlled) return say(false, name, 'SETUP BROKEN — the worker never took control');

    setBuild('B', String(Number(STAMP) + 1));    // a deploy. Nothing tells the browser.
    log = [];
    const page = await ctx.newPage(); page.on('pageerror', () => {});
    const marker = await run(page);
    const asked = log.some(u => u === '/app/' || u === '/app/index.html');
    await page.close();
    say(marker === 'B' && asked, name,
        'server asked: ' + String(asked).padEnd(5) + ' page got: ' + marker + ' (want B)');
  } finally { await ctx.close(); }
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  BASE = 'http://127.0.0.1:' + server.address().port;
  console.log('\nservice worker page loads, on a host that sends cache-control: max-age=600\n');

  // A typed URL, a bookmark and a home-screen PWA launch are one navigation as
  // far as the browser is concerned. This was the main regression.
  await scenario('typed URL / bookmark / PWA launch', async page => {
    await page.goto(BASE + '/app/', { waitUntil: 'load' });
    return readMarker(page);
  });

  // How most visits actually arrive.
  await scenario('landing page hop into the app', async page => {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    return readMarker(page);
  });

  // Refresh always worked. It has to keep working.
  await scenario('browser Refresh', async page => {
    await page.goto(BASE + '/app/', { waitUntil: 'load' });
    log = [];
    await page.reload({ waitUntil: 'load' });
    return readMarker(page);
  });

  // `location.href = …` is an ordinary navigation, not a reload navigation, so
  // it was broken too even though `location.reload()` was fine.
  await scenario('in-page location assignment', async page => {
    await page.goto(BASE + '/app/', { waitUntil: 'load' });
    log = [];
    await page.evaluate(() => { location.href = location.href; });
    await page.waitForTimeout(1400);
    return readMarker(page);
  });

  // v0.9.1336 note, kept for the next reader: a "warm open hits the server
  // for zero stamped files" scenario was written here and REMOVED the same
  // hour — its mutation drill passed WITHOUT the fix, because this harness
  // (correctly) mirrors GitHub Pages' cache-control: max-age=600, and the
  // browser's own HTTP cache absorbs the background re-downloads for ten
  // minutes, so a server-side counter cannot see them either way. The
  // behavioural gate for the immutable-hit short-circuit is §210 in the node
  // suite: it drives the REAL fetch handler with a cache hit and counts
  // calls to fetch itself — proven red when the short-circuit is removed.

  // The guard on the fix. `cache: 'reload'` bypasses the browser's HTTP cache.
  // If it were ever mistaken for bypassing the PRECACHE as well, the app would
  // stop opening without a signal — much worse than the bug being fixed.
  {
    const ctx = await fresh('offline');
    setBuild('A', STAMP);
    const page = await ctx.newPage(); page.on('pageerror', () => {});
    await page.goto(BASE + '/app/', { waitUntil: 'load' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    let scripts = 0;
    try {
      await page.goto(BASE + '/app/', { waitUntil: 'load', timeout: 15000 });
      scripts = await page.evaluate(() => document.querySelectorAll('script').length);
    } catch (e) { /* stays 0 */ }
    await ctx.setOffline(false);
    say(scripts > 10, 'offline still opens the whole app',
        'script tags served from the precache: ' + scripts);
    await page.close(); await ctx.close();
  }

  server.close();
  fs.rmSync(ROOT, { recursive: true, force: true });
  const bad = results.filter(r => !r.pass);
  console.log('\n' + (bad.length ? bad.length + ' of ' + results.length + ' FAILED'
                                 : 'ALL PASS  —  ' + results.length + ' checks passed'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
