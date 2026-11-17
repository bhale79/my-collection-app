#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE STEP-BY-STEP MANUALS IN THE HELP CENTER — 2026-11-16 (helpmanual)
//
// [stated] Brad 06:21 CT "The regular manual, need to place it here in the
// help menu" → 06:22 CT "make it downloadable" → 06:24 CT "yes".
//
// Files (no browser):
//   F1  every listed manual's PDF is in app/manual/ and is a real PDF
//   F2  its `size` line is the real file's size (so the line moves with a new
//       edition), and no manual is over the size cap
//   F3  nothing sits in app/manual/ that the list does not use
//   F4  no "AI" and no "DRAFT" in what a collector reads (the list, and the
//       words inside each PDF's first pages)
// Who sees what (the real list file, run):
//   W1  a regular collector sees the main manual only
//   W2  a beta tester with one of the Beta Manual's switches sees both
//   W3  rrManualOpen makes a download link to the right file
// The offline cache:
//   C1  the REAL sw.js fetch handler never answers for a manual
// The real app in Chromium (computer + phone):
//   B1  the Help Center opens with "Manual" as its FIRST heading, the main
//       manual's line under it, and the size it says
//   B2  tapping the line downloads The_Rail_Roster_Manual.pdf, byte for byte
//       the file in app/manual/
//   B3  a regular collector has no Beta Manual line; a beta tester does
// Every check is shown failing on a planted offender (rules_testing).
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const APP = path.join(__dirname, '..', 'app');
const MAN = path.join(APP, 'manual');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600)));
  cond ? pass++ : fail++;
}
const SIZE_CAP = 10 * 1024 * 1024;   // a phone download; the main manual is ~6 MB

// ── the list, as the app sees it (the real file, run) ───────────────────────
function loadList(src, features, owner) {
  const made = [];
  const sb = {
    window: {}, console, setTimeout: (f) => f(),
    document: {
      createElement: () => { const a = { style: {}, parentNode: null, click() { made.push(this); } }; return a; },
      body: { appendChild(a) { a.parentNode = this; }, removeChild(a) { a.parentNode = null; } },
    },
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  sb.rrFeatureOn = (f) => !!owner || (features || []).indexOf(f) >= 0;
  return { list: sb.window.RR_MANUALS, shown: sb.window.rrManualsShown(), open: sb.window.rrManualOpen, made, folder: vm.runInContext('RR_MANUAL_FOLDER', sb) };
}
const GIFS = read('tutorial-gifs-config.js');
const L = loadList(GIFS, []);
T('the list loads, with the main manual first', Array.isArray(L.list) && L.list.length >= 1 && L.list[0].id === 'main', L.list && L.list.map(m => m.id));

// ── F1–F3: the files ─────────────────────────────────────────────────────────
const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';
function fileProblems(list, dir) {
  const out = [];
  for (const m of list) {
    const p = path.join(dir, m.file);
    if (!fs.existsSync(p)) { out.push(m.id + ': no file ' + m.file); continue; }
    const buf = fs.readFileSync(p);
    if (buf.slice(0, 5).toString('latin1') !== '%PDF-') out.push(m.id + ': not a PDF');
    if (m.size !== mb(buf.length)) out.push(m.id + ': says ' + m.size + ', file is ' + mb(buf.length));
    if (buf.length > SIZE_CAP) out.push(m.id + ': ' + mb(buf.length) + ' is over the cap');
  }
  return out;
}
T('F1/F2 every listed manual is a real PDF in app/manual/, its size line is true, none over the cap', !fileProblems(L.list, MAN).length, fileProblems(L.list, MAN));
T('F1-P a listed file that is not there — caught', fileProblems([{ id: 'x', file: 'Nope.pdf', size: '1.0 MB' }], MAN).length === 1);
T('F2-P a size line left over from the last edition — caught', fileProblems(L.list.map(m => Object.assign({}, m, { size: '99.9 MB' })), MAN).filter(x => /says 99\.9/.test(x)).length === L.list.length);
function strays(list, dir) { const used = new Set(list.map(m => m.file)); return fs.readdirSync(dir).filter(f => !used.has(f)); }
T('F3 nothing in app/manual/ the list does not use', !strays(L.list, MAN).length, strays(L.list, MAN));
T('F3-P a file the list forgot — caught', strays(L.list.slice(1), MAN).length === 1);

// ── F4: the words ────────────────────────────────────────────────────────────
function pdfTitle(file) {
  // The PDF's own title (its Info dictionary), as the build writes it: a plain
  // (string) or a UTF-16 <FEFF…> hex string. It carries the edition label, the
  // same words the footer prints on every page.
  const s = fs.readFileSync(file).toString('latin1');
  const m = /\/Title\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)/.exec(s);
  if (!m) return '';
  let t = m[1];
  if (t[0] === '(') return t.slice(1, -1).replace(/\\([0-7]{3})/g, (x, o) => { const c = parseInt(o, 8); return c === 0x84 ? '\u2014' : String.fromCharCode(c); }).replace(/\\(.)/g, '$1');
  const hex = t.slice(1, -1).replace(/\s/g, '');
  const b = Buffer.from(hex, 'hex');
  if (b[0] === 0xFE && b[1] === 0xFF) { let o = ''; for (let i = 2; i + 1 < b.length; i += 2) o += String.fromCharCode(b.readUInt16BE(i)); return o; }
  return b.toString('latin1');
}
function badWords(text) { return (text.match(/\bAI\b|\bDRAFT\b|🤖/g) || []); }
const listWords = L.list.map(m => [m.title, m.desc].join(' ')).join(' ');
T('F4 no "AI" or "DRAFT" in the list a collector reads', !badWords(listWords).length, badWords(listWords));
for (const m of L.list) {
  const p = path.join(MAN, m.file);
  if (fs.existsSync(p)) { const t = pdfTitle(p); T('F4 ' + m.file + ' is an edition, not a draft (its title: "' + t + '")', /edition/i.test(t) && !badWords(t).length, t); }
}
T('F4-P a draft label — caught', badWords('The Rail Roster — Manual — DRAFT 3').length === 1 && !/edition/i.test('The Rail Roster Manual (DRAFT 3)'));

// ── W1–W3: who sees what, and the download link ─────────────────────────────
const reg = loadList(GIFS, []), beta = loadList(GIFS, ['giftlist']);
T('W1 a regular collector sees the main manual only', reg.shown.map(m => m.id).join() === 'main', reg.shown.map(m => m.id));
T('W2 a beta tester (any Beta Manual switch) sees both', beta.shown.map(m => m.id).join() === 'main,beta', beta.shown.map(m => m.id));
T('W2 the Beta Manual line names its switches', !!(L.list.find(m => m.id === 'beta') || {}).features, L.list.find(m => m.id === 'beta'));
const planted = loadList(GIFS.replace(/,\s*features: \[[^\]]*\]/, ''), []);
T('W1-P the beta line without its switches — a regular collector would see it, caught', planted.shown.length === 2);
reg.open('main');
const a = reg.made[0] || {};
T('W3 rrManualOpen makes a download link to the right file', a.href === reg.folder + 'The_Rail_Roster_Manual.pdf' && a.download === 'The_Rail_Roster_Manual.pdf', a);
reg.open('nope');
T('W3 an unknown id does nothing', reg.made.length === 1, reg.made.length);

// ── C1: the offline cache ────────────────────────────────────────────────────
function swAnswers(src, url) {
  const handlers = {};
  const cacheStub = { match: () => Promise.resolve(undefined), put: () => Promise.resolve() };
  const sb = {
    self: { location: { href: 'https://therailroster.com/app/sw.js?v=1' }, addEventListener: (t, f) => { handlers[t] = f; },
            skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) } },
    caches: { open: () => Promise.resolve(cacheStub), keys: () => Promise.resolve([]), delete: () => Promise.resolve(true), match: () => Promise.resolve(undefined) },
    fetch: () => Promise.resolve({ ok: true, clone() { return this; } }),
    URL, console: { log() {}, warn() {}, error() {} }, Promise, setTimeout, Request: function () {}, Response: { error: () => ({}) }
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  let answered = false;
  handlers.fetch({ request: { url, method: 'GET', mode: 'no-cors', destination: 'document', headers: { get: () => null } },
                   respondWith: () => { answered = true; } });
  return answered;
}
const SW = read('sw.js');
const murl = 'https://therailroster.com/app/manual/The_Rail_Roster_Manual.pdf';
T('C1 the offline cache never answers for a manual', !swAnswers(SW, murl));
T('C1 (control) it does answer for an ordinary app file', swAnswers(SW, 'https://therailroster.com/app/help-guides.js'));
T('C1-P the skip line taken out — caught', swAnswers(SW.replace("if (url.includes('/manual/')) return;", ''), murl));

// ── B: the real app ──────────────────────────────────────────────────────────
let pw;
try { pw = require('playwright'); }
catch (e) { console.log('FAILED  —  help_manual_tests needs playwright for its browser half and it is not installed.'); process.exit(1); }
const { SEED } = require('./lib/guide-fixture');

// The app is served over http here (not file://): a browser only honours a
// download link on the page's own site, as it is on therailroster.com.
let BASE = '';
function serve() {
  const http = require('http');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(APP, u === '/' ? 'index.html' : u);
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { BASE = 'http://127.0.0.1:' + srv.address().port + '/'; r(srv); }));
}

async function hub(browser, dev, features, plant) {
  // serviceWorkers 'block': on http the app's offline worker would take over and
  // reload the page mid-check (C1 above tests the worker's /manual/ rule).
  const o = Object.assign({ acceptDownloads: true, serviceWorkers: 'block' }, dev); delete o.defaultBrowserType;
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  await ctx.route('**', r => { const u = r.request().url(); return (/^(data|about|blob):/.test(u) || u.startsWith(BASE)) ? r.continue() : r.abort(); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  await pg.goto(BASE + 'index.html');
  await pg.waitForFunction(() => typeof buildApp === 'function' && typeof openHelpHub === 'function' && typeof state !== 'undefined', null, { timeout: 20000 });
  await pg.waitForTimeout(900);
  await pg.evaluate(SEED); await pg.waitForTimeout(250);
  await pg.evaluate((f) => { window.rrIsRealOwner = () => false; window._subState = Object.assign({}, window._subState || {}, { features: f }); }, features);
  if (plant) await pg.evaluate(() => { window.RR_MANUALS[0].file = 'Gone.pdf'; });
  await pg.evaluate(() => openHelpHub());
  await pg.waitForTimeout(400);
  const seen = await pg.evaluate(() => {
    const p = document.getElementById('help-hub-panel');
    const heads = [...p.querySelectorAll('div')].filter(d => d.children.length === 0 && getComputedStyle(d).textTransform === 'uppercase').map(d => d.textContent.trim());
    const rows = [...p.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
    return { heads, rows };
  });
  let dl = null;
  const btn = await pg.$('#help-hub-panel button[onclick*="rrManualOpen(\'main\')"]');
  if (btn) {
    try {
      const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), btn.click()]);
      const p = await d.path();
      dl = { name: d.suggestedFilename(), sha: p ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null, failure: await d.failure() };
    } catch (e) { dl = { error: e.message.split('\n')[0] }; }
  }
  await ctx.close();
  return { seen, dl, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const srv = await serve();
  let browser;
  try { browser = await pw.chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  const mainSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(MAN, 'The_Rail_Roster_Manual.pdf'))).digest('hex');
  const main = L.list[0];
  const DEVS = [['computer', { viewport: { width: 1280, height: 900 } }], ['phone', pw.devices['iPhone 13']]];
  for (const [name, dev] of DEVS) {
    const r = await hub(browser, dev, []);
    T('B1 ' + name + ': "Manual" is the Help Center\'s first heading', r.seen.heads[0] === 'Manual', r.seen.heads.slice(0, 3));
    const line = r.seen.rows.find(t => t.indexOf(main.title) >= 0) || '';
    T('B1 ' + name + ': the main manual\'s line, with its size', line.indexOf('Download (PDF, ' + main.size + ')') >= 0, line);
    T('B2 ' + name + ': the line downloads The_Rail_Roster_Manual.pdf, byte for byte', !!r.dl && r.dl.name === 'The_Rail_Roster_Manual.pdf' && r.dl.sha === mainSha && !r.dl.failure, r.dl);
    T('B3 ' + name + ': a regular collector has no Beta Manual line', !r.seen.rows.some(t => /Beta Manual/.test(t)), r.seen.rows.slice(0, 4));
    T('B ' + name + ': no page errors', !r.errs.length, r.errs);
  }
  const b = await hub(browser, { viewport: { width: 1280, height: 900 } }, ['maintenance']);
  T('B3 a beta tester (maintenance) has the Beta Manual line too', b.seen.rows.some(t => /Beta Manual/.test(t)), b.seen.rows.slice(0, 4));
  const p = await hub(browser, { viewport: { width: 1280, height: 900 } }, [], true);
  T('B2-P a line pointing at a file that is not there — no good download, caught', !p.dl || p.dl.error || p.dl.failure || p.dl.sha !== mainSha, p.dl);
  await browser.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
