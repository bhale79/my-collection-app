#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE HELP VIDEOS — v0.9.1987
//
// Brad (2026-10-18): "can you go ahead and fix the help center. under guided
// walk throughs, the tour is the only one we need to keep, we need to add our
// new videos with audio" — and "get rid of the step by step guides. leave the
// other 2 under suggestions".
//
// No browser needed — this reads the files themselves:
//   V1  every listed video has its .mp4, .vtt and .jpg in app/videos/
//   V2  each .mp4 starts playing before it has fully downloaded (moov before
//       mdat — "faststart"), and its real length matches what the list says
//   V3  each .vtt is a real caption file whose cues stay inside the video
//   V4  nothing sits in app/videos/ that the list does not use (the repo
//       carries every byte forever), and no video is over the size cap
//   V5  no "AI" in what a collector reads (titles, descriptions, captions)
//   V6  the offline cache (sw.js) never touches the videos — the REAL fetch
//       handler is run in a sandbox and must not answer for one
//   V7  the ten per-page guides and the Step-by-step index are gone; the tour
//       and the two Suggestions rows stay; the tour's Help card no longer
//       promises a guide per page
//   V8  the two remembered settings are named in ONE place
// Every scan is shown failing on a planted offender (rules_testing).
// The player itself (buttons, remembered choices, phone sizes) is driven in a
// real browser by tests/help-hub.js §8–§9.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const VID = path.join(APP, 'videos');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600)));
  cond ? pass++ : fail++;
}

// ── the list, as the app sees it (the real file, run) ───────────────────────
function loadList(src) {
  const sb = { window: {}, document: { createElement: () => ({}) }, console };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return { cfg: sb.window.TUTORIAL_GIFS, ready: sb.window.rrReadyDemos(), groups: sb.window.rrVideoGroups() };
}
const GIFS = read('tutorial-gifs-config.js');
const L = loadList(GIFS);
T('the list loads and has videos ready', L.ready.length >= 1, L.ready.length);

// ── mp4 reading: top-level boxes, and the movie header's duration ──────────
function boxes(buf) {
  const out = [];
  let o = 0;
  while (o + 8 <= buf.length) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(o + 8));
    else if (size === 0) size = buf.length - o;
    if (size < 8) break;
    out.push({ type, at: o, size });
    o += size;
  }
  return out;
}
function mp4Seconds(buf) {
  const moov = boxes(buf).find(b => b.type === 'moov');
  if (!moov) return null;
  const inner = boxes(buf.subarray(moov.at + 8, moov.at + moov.size));
  const mvhd = inner.find(b => b.type === 'mvhd');
  if (!mvhd) return null;
  const p = moov.at + 8 + mvhd.at + 8;
  const ver = buf[p];
  const scale = ver === 1 ? buf.readUInt32BE(p + 20) : buf.readUInt32BE(p + 12);
  const dur = ver === 1 ? Number(buf.readBigUInt64BE(p + 24)) : buf.readUInt32BE(p + 16);
  return dur / scale;
}
function fastStart(buf) {
  const b = boxes(buf);
  const m = b.findIndex(x => x.type === 'moov'), d = b.findIndex(x => x.type === 'mdat');
  return m >= 0 && d >= 0 && m < d;
}
const mmss = s => { const m = /^(\d+):(\d\d)$/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
function vttCues(txt) {
  if (!/^WEBVTT/.test(txt)) return null;
  const t = x => { const p = x.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  const cues = [];
  const re = /(\d[\d:.]*)\s+-->\s+(\d[\d:.]*)[^\n]*\n([^\n]+(?:\n[^\n]+)*)/g;
  let m;
  while ((m = re.exec(txt))) cues.push({ a: t(m[1]), b: t(m[2]), text: m[3] });
  return cues;
}

// ── V1–V4: per video ────────────────────────────────────────────────────────
const CAP_MB = 25;
function checkVideo(d, dir) {
  const bad = [];
  const f = n => path.join(dir, d.file + n);
  if (!/^[a-z0-9-]+$/.test(d.file || '')) bad.push(d.id + ': file name must be a-z 0-9 -');
  ['.mp4', '.vtt', '.jpg'].forEach(x => { if (!fs.existsSync(f(x))) bad.push(d.id + ': missing ' + d.file + x); });
  if (bad.length) return bad;
  const buf = fs.readFileSync(f('.mp4'));
  if (!fastStart(buf)) bad.push(d.id + ': not faststart (moov after mdat)');
  const secs = mp4Seconds(buf);
  if (secs == null) bad.push(d.id + ': no movie header');
  else if (!(Math.abs(secs - mmss(d.length)) <= 1)) bad.push(d.id + ': list says ' + d.length + ', video is ' + secs.toFixed(1) + 's');
  if (buf.length > CAP_MB * 1024 * 1024) bad.push(d.id + ': ' + (buf.length / 1048576).toFixed(1) + ' MB is over the ' + CAP_MB + ' MB cap');
  const cues = vttCues(fs.readFileSync(f('.vtt'), 'utf8'));
  if (!cues) bad.push(d.id + ': captions do not start WEBVTT');
  else {
    if (cues.length < 5) bad.push(d.id + ': only ' + cues.length + ' captions');
    cues.forEach((c, i) => {
      if (!(c.b > c.a)) bad.push(d.id + ': caption ' + (i + 1) + ' ends before it starts');
      if (i && c.a < cues[i - 1].a) bad.push(d.id + ': caption ' + (i + 1) + ' is out of order');
    });
    if (secs != null && cues.length && cues[cues.length - 1].b > secs + 1) bad.push(d.id + ': captions run past the end');
  }
  const jpg = fs.readFileSync(f('.jpg'));
  if (!(jpg[0] === 0xFF && jpg[1] === 0xD8)) bad.push(d.id + ': the still is not a JPEG');
  return bad;
}
const perVideo = [].concat(...L.ready.map(d => checkVideo(d, VID)));
T('V1–V3 every listed video has its three files, starts fast, is as long as listed, and has sound captions', perVideo.length === 0, perVideo);
T('…ids are unique', new Set(L.ready.map(d => d.id)).size === L.ready.length, L.ready.map(d => d.id));
T('…and every video sits in a listed group (none falls into "More videos")',
  L.groups.every(g => g.title !== 'More videos') && L.groups.reduce((n, g) => n + g.demos.length, 0) === L.ready.length,
  L.groups.map(g => g.title));

// PLANTED: each kind of fault is caught.
{
  const d0 = L.ready[0];
  T('V1 PLANTED: a listed video with no file is caught',
    checkVideo(Object.assign({}, d0, { file: 'no-such-video' }), VID).some(x => /missing/.test(x)));
  T('V2 PLANTED: a wrong length in the list is caught',
    checkVideo(Object.assign({}, d0, { length: '9:59' }), VID).some(x => /list says/.test(x)));
  const buf = fs.readFileSync(path.join(VID, d0.file + '.mp4'));
  const b = boxes(buf), moov = b.find(x => x.type === 'moov'), mdat = b.find(x => x.type === 'mdat');
  const swapped = Buffer.concat([buf.subarray(0, Math.min(moov.at, mdat.at)), buf.subarray(mdat.at, mdat.at + mdat.size), buf.subarray(moov.at, moov.at + moov.size)]);
  T('V2 PLANTED: a video saved without faststart is caught', fastStart(buf) && !fastStart(swapped));
  T('V3 PLANTED: a caption file that is not WEBVTT is caught', vttCues('1\n00:00:01.000 --> 00:00:02.000\nhi\n') === null);
}

// V4: nothing unused in the folder.
function orphans(files, ready) {
  const want = new Set();
  ready.forEach(d => ['.mp4', '.vtt', '.jpg'].forEach(x => want.add(d.file + x)));
  return files.filter(n => !want.has(n));
}
const inFolder = fs.readdirSync(VID);
T('V4 nothing sits in app/videos/ that the list does not use', orphans(inFolder, L.ready).length === 0, orphans(inFolder, L.ready));
T('V4 PLANTED: a stray file is caught', orphans(inFolder.concat(['old-take.mp4']), L.ready).length === 1);

// ── V5: no "AI" in what a collector reads ───────────────────────────────────
const AI_RE = /\bA\.?I\.?\b|🤖|artificial intelligence/;
function aiWords(list) {
  const bad = [];
  list.forEach(d => {
    const caps = fs.existsSync(path.join(VID, d.file + '.vtt')) ? fs.readFileSync(path.join(VID, d.file + '.vtt'), 'utf8') : '';
    [d.title, d.description, caps].forEach(t => { const m = AI_RE.exec(t || ''); if (m) bad.push(d.id + ': ' + m[0]); });
  });
  [L.cfg.sectionTitle, L.cfg.sectionNote].concat((L.cfg.sections || []).map(s => s.title))
    .forEach(t => { if (AI_RE.test(t || '')) bad.push('heading: ' + t); });
  return bad;
}
T('V5 no "AI" in any video title, description, caption or heading', aiWords(L.ready).length === 0, aiWords(L.ready));
T('V5 PLANTED: "AI" in a title is caught', aiWords([Object.assign({}, L.ready[0], { title: 'Let the AI read it' })]).length > 0);

// ── V6: the offline cache never answers for a video ─────────────────────────
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
  handlers.fetch({ request: { url, method: 'GET', mode: 'no-cors', destination: 'video', headers: { get: () => null } },
                   respondWith: () => { answered = true; } });
  return answered;
}
const SW = read('sw.js');
const VURL = 'https://therailroster.com/app/videos/' + L.ready[0].file + '.mp4';
T('V6 the real service worker lets a video request pass straight to the site', swAnswers(SW, VURL) === false);
T('V6 …while it still answers for an ordinary app file (so the check can tell)', swAnswers(SW, 'https://therailroster.com/app/app.css?v=1') === true);
{
  const planted = SW.replace("  if (url.includes('/videos/')) return;\n", '');
  T('V6 PLANTED: without the /videos/ line the worker would answer for a video', planted !== SW && swAnswers(planted, VURL) === true);
}
T('V6 …and no video is on the precache list', !/videos\//.test(SW.slice(SW.indexOf('['), SW.indexOf('];'))));

// ── V7: what went, what stayed ──────────────────────────────────────────────
const TUT = read('tutorial.js'), HG = read('help-guides.js');
function guideIds(src) {
  const a = src.indexOf('const GUIDES = {'), b = src.indexOf("if (typeof window !== 'undefined') window.GUIDES = GUIDES;");
  if (a < 0 || b < a) return null;
  return (src.slice(a, b).match(/^  '([a-z-]+)': \{/gm) || []).map(x => x.trim().slice(1, x.trim().indexOf("'", 1)));
}
T('V7 the tour is the one guided walkthrough left', JSON.stringify(guideIds(TUT)) === '["tour"]', guideIds(TUT));
T('V7 PLANTED: a second guide is caught',
  JSON.stringify(guideIds(TUT.replace("  'tour': {", "  'add-item': { steps: [] },\n  'tour': {"))) !== '["tour"]');
const HUB = TUT.slice(TUT.indexOf('function openHelpHub('), TUT.indexOf('window.openHelpHub = openHelpHub;'));
T('V7 the Help Center no longer lists guides from a loop (the tour has its own row)',
  !/Object\.keys\(GUIDES\)/.test(HUB) && /startGuide\('tour'\)/.test(HUB) && !/Guided walkthroughs/.test(HUB));
T('V7 the Videos block sits right under the tour', HUB.indexOf("startGuide('tour')") < HUB.indexOf('_helpHubVideosHtml(row, hdr)') &&
  HUB.indexOf('_helpHubVideosHtml(row, hdr)') < HUB.indexOf("hdr('Getting Started')"));
const SUG = HUB.slice(HUB.indexOf("hdr('Suggestions')"), HUB.indexOf("hdr('More')"));
T('V7 Suggestions keeps exactly its two rows: Photographing and Condition grading',
  (SUG.match(/row\(/g) || []).length === 2 && /Photographing a large collection/.test(SUG) && /Condition grading \(the C-scale\)/.test(SUG));
T('V7 the Step-by-step guides are gone (index, row and the other ten)',
  !/rrgIndex|rrgPath|Step-by-step guides/.test(HG.replace(/\/\/[^\n]*/g, '')) && !/Step-by-step/.test(HUB) &&
  !/addItem: \{|forSale: \{|whereFiled: \{/.test(HG));
T('V7 …and the grading guide the Add screen links to is still there', /grading: \{/.test(HG) && /window\.rrgOpen = rrgOpen;/.test(HG) &&
  /rrgOpen\(\\?'grading\\?'\)/.test(read('wizard.js')));
const helpCard = (TUT.match(/title: 'Need Help\?',\s*\n\s*body: '((?:[^'\\]|\\.)*)'/) || [])[1] || '';
T('V7 the tour\'s Help card no longer promises a guide for every page',
  helpCard.length > 40 && !/its own guide|has its own/.test(helpCard) && /video/i.test(helpCard), helpCard.slice(0, 160));
T('V7 the photographing guide says 50–75 items in an hour, not half an hour',
  /50–75 items in an hour/.test(TUT) && !/half an hour/.test(TUT));

// ── V8: one place for the two remembered settings ───────────────────────────
function keyHomes(files) {
  return files.filter(f => /lv_help_video_(muted|captions)/.test(read(f)));
}
const appFiles = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f));
T('V8 the Sound and Captions settings are named in tutorial-gifs-config.js and nowhere else',
  JSON.stringify(keyHomes(appFiles)) === '["tutorial-gifs-config.js"]', keyHomes(appFiles));
T('V8 …and the player reads them from the list, not from a typed-in name',
  /getOn\(cfg\.prefMuted\)/.test(GIFS) && /getOn\(cfg\.prefCaptions\)/.test(GIFS) &&
  (GIFS.match(/lv_help_video_/g) || []).length === 2);

console.log('\nhelp_videos_1987_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
