// tests/lib/photo-home-lib.js — v0.9.1996. The stand-in Drive and the sandbox
// that runs the REAL config.js + drive.js, shared by photo_home_1995_tests and
// photo_home_1996_tests (one copy, so the two suites cannot drift apart).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const CFG = fs.readFileSync(path.join(ROOT, 'app', 'config.js'), 'utf8');
const DRV = fs.readFileSync(path.join(ROOT, 'app', 'drive.js'), 'utf8');
const FOLDER = 'application/vnd.google-apps.folder';

// ── a stand-in Drive that keeps folders, their parents, and every call ──────
function makeDrive() {
  let seq = 0;
  const files = [];
  const log = [];
  function add(name, parent, mimeType) {
    const f = { id: 'F' + (++seq), name: name, parents: [parent], trashed: false, mimeType: mimeType || FOLDER };
    files.push(f);
    return f.id;
  }
  function query(q) {
    const nm = q.match(/name='((?:\\.|[^'\\])*)'/);
    const name = nm ? nm[1].replace(/\\(.)/g, '$1') : null;
    const wantFolder = q.indexOf("mimeType='" + FOLDER + "'") !== -1;
    const parents = [];
    const re = /'([^']+)' in parents/g;
    let m;
    while ((m = re.exec(q)) !== null) parents.push(m[1]);
    return files.filter(function (f) {
      if (f.trashed) return false;
      if (name !== null && f.name !== name) return false;
      if (wantFolder && f.mimeType !== FOLDER) return false;
      if (parents.length && !parents.some(function (p) { return f.parents.indexOf(p) !== -1; })) return false;
      return true;
    }).map(function (f) { return { id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents.slice() }; });
  }
  async function request(method, url, body) {
    log.push({ method: method, url: url });
    if (method === 'GET' && url.indexOf('/files?q=') === 0) {
      const q = decodeURIComponent(url.slice(9).split('&')[0]);
      return { files: query(q) };
    }
    if (method === 'POST' && url.indexOf('/files') === 0) {
      return { id: add(body.name, body.parents[0]) };
    }
    const mv = /^\/files\/([^?]+)\?addParents=([^&]+)&removeParents=([^&]+)/.exec(url);
    if (method === 'PATCH' && mv) {
      const f = files.find(function (x) { return x.id === mv[1]; });
      f.parents = f.parents.filter(function (p) { return p !== mv[3]; }).concat([mv[2]]);
      return { id: f.id };
    }
    throw new Error('stand-in Drive: unhandled ' + method + ' ' + url);
  }
  return {
    files: files, add: add, log: log, request: request,
    childrenOf: function (pid) { return files.filter(function (f) { return f.parents.indexOf(pid) !== -1; }); },
    byName: function (n) { return files.filter(function (f) { return f.name === n; }); },
    writes: function () { return log.filter(function (c) { return c.method !== 'GET'; }).length; },
  };
}

// ── the REAL config.js + drive.js in one sandbox, Drive swapped for the stand-in
// Stubs, each named: findMaster (the catalog — only its `_era` is read here),
// baseItemNum (the -P/-D/-T/-C strip), driveEnsureSetup (no sign-in).
function boot(opts) {
  opts = opts || {};
  const drv = opts.driveSrc || DRV;
  const store = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; },
                createElement() { return { style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }; },
                documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } },
                head: { appendChild() {} }, body: { appendChild() {} } },
    navigator: { userAgent: 'node' },
    location: { href: 'https://therailroster.com/app/', search: '', hostname: 'therailroster.com' },
    addEventListener() {}, removeEventListener() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    accessToken: 'stand-in-token',   // drive.js's find-only lookup checks a pass is held
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(CFG, ctx, { filename: 'config.js' });
  vm.runInContext(drv, ctx, { filename: 'drive.js' });
  const D = opts.drive || makeDrive();
  const PHOTOS = opts.photosId || 'PHOTOS';
  ctx.driveRequest = D.request;
  ctx.driveEnsureSetup = async function () {};
  ctx.findMaster = function (n) { return (opts.catalog || {})[n] || null; };
  ctx.baseItemNum = function (n) { return String(n).replace(/-?[PDTC]$/, ''); };
  ctx.state = { personalData: opts.owned || {}, setData: opts.sets || [] };
  vm.runInContext('driveCache.photosId = ' + JSON.stringify(PHOTOS) + '; driveCache.itemFolders = {};', ctx);
  return { ctx: ctx, D: D, PHOTOS: PHOTOS,
           run: function (expr) { return vm.runInContext(expr, ctx); } };
}


module.exports = { makeDrive: makeDrive, boot: boot, CFG: CFG, DRV: DRV, ROOT: ROOT, FOLDER: FOLDER };
