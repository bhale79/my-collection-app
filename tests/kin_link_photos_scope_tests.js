#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TWO THINGS BRAD HIT WHILE PREPARING THE BOOTH VIDEO — v0.9.1923
//
// K  "i am looking at the 3309-50, but it doesn't have the cott link here for
//    me to see." The Add screen's "Also catalogued separately" rows offered a
//    relative to tap but no way to CHECK it. Each relative row now carries the
//    same reference link the variation cards do (refLink → cottAnchorUrl →
//    resolveRefLabel), as a sibling of the button, only when the row has one,
//    and the row is found through findMaster WITH the add's era hint.
//    PLANTED: the link call removed → no link (caught).
//
// P  "why does it keep asking me this" — Google's "wants additional access …
//    Google Photos" screen every time, though he had clicked Continue. The yes
//    lived in window._rrPhotosScoped, which every reload wiped, and Google's
//    answer was never written down. Now the scopes Google granted are stored
//    beside the pass (fingerprinted) and checked before asking.
//    PLANTED: the old flag version asks again after a reload (caught).
// Runs the REAL functions from app/wizard.js, app/app.js, app/app-auth.js,
// app/cott-anchors.js, app/item-search-filters-config.js and app/browse.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function fnSrc(src, name) {
  let i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' not found');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  throw new Error(name + ' unbalanced');
}

// ── K ──────────────────────────────────────────────────────────────────────
const APPJS = rd('app.js'), WIZ = rd('wizard.js'), BRW = rd('browse.js'), CFG = rd('item-search-filters-config.js'), COTT = rd('cott-anchors.js');
const ROWS = [
  { itemNum: '3309', variation: '1', varDesc: 'unpainted red plastic depressed center flatcar without lettering', itemType: 'Flatcar', _tab: 'Lionel PW - Items', _era: 'pw', refLink: 'https://cornucopiaoftoytrains.com/flatcars-space-and-military-a/' },
  { itemNum: '3309-50', variation: '1', varDesc: 'UNPAINTED OLIVE GREEN SHELL WITHOUT ANY LETTERING', itemType: 'Flatcar', _tab: 'Lionel PW - Items', _era: 'pw', refLink: 'https://cornucopiaoftoytrains.com/flatcars-space-and-military-a/' },
  { itemNum: '3309-2', variation: '1', varDesc: 'Norfolk & Western 1004', itemType: 'Flatcar', _tab: 'Lionel PW - Items', _era: 'pw', refLink: '' },
];
function kinWorld(wizSrc, opts) {
  opts = opts || {};
  const calls = [];
  const ctx = { console: { warn() {}, log() {} }, URL, String, Object, JSON, state: { masterData: ROWS } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(BRW.slice(BRW.indexOf('var _SITE_LABELS'), BRW.indexOf('if (typeof window', BRW.indexOf('var _SITE_LABELS'))) + '\nwindow._externalSiteLabel = _externalSiteLabel;', ctx);
  vm.runInContext(CFG, ctx);
  vm.runInContext(COTT, ctx);
  vm.runInContext(APPJS.slice(APPJS.indexOf('function rrDashedKin(num) {'), APPJS.indexOf('var _issuedInvIds')), ctx);
  ctx._wizMasterPrefer = () => ({ era: 'pw' });
  if (!opts.noFindMaster) ctx.findMaster = (num, v, prefer) => { calls.push({ num, prefer }); return ROWS.find(r => r.itemNum === num) || null; };
  vm.runInContext(wizSrc.slice(wizSrc.indexOf('function _wizKinNoteHtml(num) {'), wizSrc.indexOf('// ── v0.9.1369 — the viewer')), ctx);
  return { ctx, calls };
}
{
  const { ctx, calls } = kinWorld(WIZ);
  const html = ctx._wizKinNoteHtml('3309');
  const m50 = html.match(/<button[^>]*wizSwitchToKin\('3309-50'\)[\s\S]*?<\/button>(<a class="wiz-kin-ref" href="([^"]*)"[^>]*>([^<]*)<\/a>)?/);
  T('K1 the 3309-50 row carries a reference link', !!(m50 && m50[1]), html);
  T('K2 …that says COTT', !!(m50 && m50[3] === 'COTT ↗'), m50 && m50[3]);
  T('K3 …and goes to the COTT page', !!(m50 && /^https:\/\/cornucopiaoftoytrains\.com\/flatcars-space-and-military-a\//.test(m50[2])), m50 && m50[2]);
  T('K4 the link sits BESIDE the button, never inside it', !/<button[^>]*>(?:(?!<\/button>)[\s\S])*<a /.test(html), html);
  T('K5 the link opens a new tab', /class="wiz-kin-ref"[^>]*target="_blank" rel="noopener"/.test(html), html);
  const m2 = html.match(/wizSwitchToKin\('3309-2'\)[\s\S]*?<\/button>(<a class="wiz-kin-ref")?/);
  T('K6 a relative with no reference gets no link (no dead button)', !!(m2 && !m2[1]), html);
  T('K7 the row is found through findMaster with the add\'s era hint', calls.some(c => c.num === '3309-50' && c.prefer && c.prefer.era === 'pw'), calls);
  T('K8 still two tap buttons (the existing ranking test counts them)', (html.match(/class="wiz-kin-btn"/g) || []).length === 2, html);
  const planted = WIZ.replace("+ '</button>' + _wizKinRefLink(k) + '</div>';", "+ '</button>' + '</div>';");
  if (planted === WIZ) throw new Error('could not plant');
  const p = kinWorld(planted).ctx._wizKinNoteHtml('3309');
  T('K9 PLANTED: without the link call the row has no link', !/wiz-kin-ref/.test(p), p);
  const css = rd('app.css');
  T('K10 the link and row are styled, in theme colours only', /\.wiz-kin-row \{[^}]*display: flex/.test(css) && /\.wiz-kin-ref \{[^}]*color: var\(--accent2\)/.test(css) && !/\.wiz-kin-ref \{[^}]*#[0-9a-f]{3,6}/i.test(css));
}

// ── P ──────────────────────────────────────────────────────────────────────
const AUTH = rd('app-auth.js');
const PHOTOS = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const BASE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
function authWorld(src, store, token, googleAnswer) {
  const asked = [], log = [];
  const ctx = {
    console: { warn() {}, log() {} }, JSON, String, Promise, parseInt, Date,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    state: { user: { email: 'support@therailroster.com' } },
    CLIENT_ID: 'cid', SCOPES: BASE, SCOPE_PHOTOS: PHOTOS, SCOPE_SHEETS_FULL: 'https://www.googleapis.com/auth/spreadsheets',
    RR_TOKEN_SCOPES_KEY: 'lv_token_scopes',
    _rrAuthLog: m => log.push(m),
    google: { accounts: { oauth2: { initTokenClient: cfg => ({ requestAccessToken: () => { asked.push(cfg.scope); cfg.callback(googleAnswer()); } }) } } },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext('var accessToken = ' + JSON.stringify(token) + ';', ctx);
  const names = ['_rrNoteGrantedScopes', '_rrPassPrint', '_rrPassScopes', '_rrPassHasScope', '_rrScopeNames', '_rrRequestExtraScope', '_ensurePhotosScope'];
  names.forEach(n => { if (src.indexOf('function ' + n + '(') >= 0) vm.runInContext(fnSrc(src, n), ctx); });
  if (src.indexOf('function _rrEnsureScope(') >= 0) vm.runInContext(fnSrc(src, '_rrEnsureScope'), ctx);
  return { ctx, asked, log };
}
(async () => {
  const store = {};
  const grant = () => ({ access_token: 'tok-AAAA-0000-1111-2222', scope: BASE + ' ' + PHOTOS, expires_in: 3599 });
  // first use: nothing known → ask Google once, Google grants
  let w = authWorld(AUTH, store, 'tok-start-9999-8888-7777', grant);
  let ok = await w.ctx._ensurePhotosScope();
  T('P1 first use asks Google once and takes the yes', ok === true && w.asked.length === 1, { ok, asked: w.asked.length });
  T('P2 …and writes down what Google granted, beside the pass', /photospicker/.test(store.lv_token_scopes || '') && /"fp"/.test(store.lv_token_scopes || ''), store.lv_token_scopes);
  // BRAD'S BUG: reload (fresh page, flags gone) — same pass restored from storage
  w = authWorld(AUTH, store, 'tok-AAAA-0000-1111-2222', grant);
  ok = await w.ctx._ensurePhotosScope();
  T('P3 BRAD\'S BUG: after a reload the same pass does NOT ask again', ok === true && w.asked.length === 0, { ok, asked: w.asked.length, log: w.log });
  T('P4 …and the diary says why', w.log.some(m => /already carries it/.test(m)), w.log);
  // the hourly renewal hands back a pass that still carries Photos
  w.ctx._rrNoteGrantedScopes(BASE + ' ' + PHOTOS, 'tok-BBBB-renewed-carries');
  w = authWorld(AUTH, store, 'tok-BBBB-renewed-carries', grant);
  ok = await w.ctx._ensurePhotosScope();
  T('P5 a renewed pass that carries Photos does not ask', ok === true && w.asked.length === 0, w.asked.length);
  // a different pass we know nothing about → ask (never read another pass's answer)
  w = authWorld(AUTH, store, 'tok-CCCC-unknown-pass-xyz', grant);
  ok = await w.ctx._ensurePhotosScope();
  T('P6 a pass with no recorded answer asks (the record is tied to its pass)', w.asked.length === 1, w.asked.length);
  // Google answers but WITHOUT Photos (box unticked) → not a yes
  const store2 = {};
  w = authWorld(AUTH, store2, 'tok-DDDD-0000', () => ({ access_token: 'tok-DDDD-1111-noPhotos', scope: BASE, expires_in: 3599 }));
  ok = await w.ctx._ensurePhotosScope();
  T('P7 a Google answer without Photos is NOT treated as a yes', ok === false, ok);
  T('P8 …and the diary records what Google actually gave', w.log.some(m => /NOT granted/.test(m) && /drive\.file/.test(m)), w.log);
  // the token paths record WITH the pass they belong to
  T('P9 sign-in and renewal record the scopes with their pass',
    /_rrNoteGrantedScopes\(params\.scope, params\.access_token\)/.test(AUTH) && /_rrNoteGrantedScopes\(resp && resp\.scope, resp && resp\.access_token\)/.test(AUTH) && /_rrNoteGrantedScopes\(resp\.scope, resp\.access_token\)/.test(AUTH));
  T('P10 no reload-wiped flag decides a permission any more', !/window\._rrPhotosScoped\s*=|window\._rrSheetsScoped\s*=|if \(window\._rrPhotosScoped\)/.test(AUTH));
  // PLANTED: the pre-v1923 flag version
  const oldFn = "function _ensurePhotosScope() {\n  return new Promise(function (resolve) {\n    if (window._rrPhotosScoped) return resolve(true);\n    _rrRequestExtraScope(SCOPE_PHOTOS, function (ok) {\n      if (ok) window._rrPhotosScoped = true;\n      resolve(ok);\n    });\n  });\n}";
  const planted = AUTH.replace(fnSrc(AUTH, '_ensurePhotosScope'), oldFn);
  const st3 = {};
  let pw = authWorld(planted, st3, 'tok-start', grant);
  await pw.ctx._ensurePhotosScope();
  pw = authWorld(planted, st3, 'tok-AAAA-0000-1111-2222', grant);
  await pw.ctx._ensurePhotosScope();
  T('P11 PLANTED: the old flag version asks again after a reload', pw.asked.length === 1, pw.asked.length);
  T('P12 the storage key lives in config.js (one place)', /const RR_TOKEN_SCOPES_KEY = 'lv_token_scopes';/.test(rd('config.js')) && !/RR_TOKEN_SCOPES_KEY = /.test(AUTH));

  console.log('\nkin_link_photos_scope_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
