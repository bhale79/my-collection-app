#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// REFERRALS — a partner sends us members (Trainz first), 2026-11-24
//
// PLAN_2026-11-24_TRAINZ_REFERRALS.md. [stated] Brad 17:14 CT "give trains an
// affiliate link so that when some click the rail roster product on the
// trainz.com site, they sign up on our site and we know that they came from
// trainz.com. the deal is that trainz.com get 10% of the purchase price".
//
// The relay's half (who counts, the window, the 10%) is proved in
// relay_v57_tests.js. This suite proves the app's half:
// A  /site/from-tag.js — the ONE place that reads the link
// B  the home page reads it BEFORE it moves a signed-in visitor on to the app
// C  rrFromTag — the app's read-only view; never trusts what it finds
// D  the sign-in check carries the word and the day; the checkout link carries
//    the word to Stripe, and nothing personal rides in the partner's link
// E  the Office card: money, last month, the file for the partner
// P  planted offenders — each turns a check above red
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

const TAG = read('site/from-tag.js'), HOME = read('index.html'), CFG = read('app/config.js'), VAULT = read('app/vault.js'), YM = read('app/yardmaster.js');

// ── A · the link reader ──────────────────────────────────────────
function runTag(src, search, store, opts) {
  const ls = Object.assign({}, store || {});
  const ctx = { location: { search: search }, JSON, String,
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(2026, 10, 24, 17, 14, 0); } },
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { if (opts && opts.full) throw new Error('quota'); ls[k] = String(v); } } };
  vm.createContext(ctx);
  let threw = false;
  try { vm.runInContext(src, ctx); } catch (e) { threw = true; }
  return { ls, threw };
}
function sectionA(src) {
  const R = {};
  const WHEN = new Date(2026, 10, 24, 17, 14, 0).getTime();
  const kept = r => { try { return JSON.parse(r.ls.rr_from); } catch (e) { return null; } };
  const is = (r, w) => { const k = kept(r); return !!k && k.src === w && k.at === '2026-11-24' && k.ts === WHEN && Object.keys(k).length === 3; };
  const a = runTag(src, '?from=trainz');
  R['A1 ?from=trainz → this browser keeps { src: "trainz", at: the day of the click, ts: the moment }'] = [is(a, 'trainz'), a.ls];
  R['A2 any letter case, and other things in the address, still read'] = [is(runTag(src, '?utm_source=x&from=TRAINZ&b=1'), 'trainz'), runTag(src, '?utm_source=x&from=TRAINZ&b=1').ls];
  const none = runTag(src, '', { rr_from: '{"src":"trainz","at":"2026-11-01"}' });
  R['A3 a visit WITHOUT ?from= changes nothing (the note is kept)'] = [none.ls.rr_from === '{"src":"trainz","at":"2026-11-01"}', none.ls];
  const again = runTag(src, '?from=muffin', { rr_from: '{"src":"trainz","at":"2026-11-01"}' });
  R['A4 the newest click replaces an older one'] = [is(again, 'muffin'), again.ls];
  const bad = ['?from=', '?from=a b', '?from=<script>', '?fromage=trainz', '?xfrom=trainz', '?from=' + 'x'.repeat(40), '?from=trainz%22'].map(q => runTag(src, q).ls.rr_from);
  R['A5 not a plain word (blank, a space, a tag, another name, 40 letters, a quote) → nothing kept'] = [bad.every(v => v === undefined), bad];
  R['A6 a browser that cannot keep it (private mode) does not break the page'] = [runTag(src, '?from=trainz', {}, { full: true }).threw === false, 0];
  R['A7 nothing personal: the reader never touches an email, the address bar or the network'] = [!/email|fetch\(|XMLHttpRequest|sendBeacon|location\.(href|replace|assign)|document\.cookie/.test(src), 0];
  return R;
}

// ── B · the home page ────────────────────────────────────────────
function sectionB(home) {
  const R = {};
  const iTag = home.indexOf('<script src="/site/from-tag.js"></script>');
  const iHop = home.indexOf("location.replace('/app/'");
  R['B1 the home page loads /site/from-tag.js'] = [iTag > 0, iTag];
  R['B2 ...BEFORE the script that sends a signed-in visitor on to the app (or the click would be lost)'] = [iTag > 0 && iHop > 0 && iTag < iHop, [iTag, iHop]];
  R['B3 it is not deferred or async (it must run first)'] = [!/<script[^>]*from-tag\.js[^>]*(async|defer)/.test(home), 0];
  return R;
}

// ── C · the app's read-only view ─────────────────────────────────
function cfgSlice(cfg) {
  const a = cfg.indexOf('const RR_REFERRAL = {'), b = cfg.indexOf("if (typeof window !== 'undefined') { window.RR_REFERRAL = RR_REFERRAL;");
  if (a < 0 || b < 0) throw new Error('the RR_REFERRAL block moved; update this test');
  return cfg.slice(a, b);
}
function fromTagWith(cfg, stored) {
  const ctx = { JSON, String, Number, Math, isFinite, localStorage: { getItem: () => { if (stored === 'THROW') throw new Error('no'); return stored; } } };
  vm.createContext(ctx);
  vm.runInContext(cfgSlice(cfg) + '\nthis.__t = rrFromTag(); this.__R = RR_REFERRAL;', ctx);
  return ctx;
}
function sectionC(cfg) {
  const R = {};
  const ok = fromTagWith(cfg, '{"src":"trainz","at":"2026-11-24","ts":1795562040000}');
  R['C1 a good note reads back as { src, at, ts }'] = [JSON.stringify(ok.__t) === '{"src":"trainz","at":"2026-11-24","ts":1795562040000}', ok.__t];
  const odd = ['{"src":"trainz","at":"2026-11-24"}', '{"src":"trainz","at":"2026-11-24","ts":"soon"}', '{"src":"trainz","at":"2026-11-24","ts":-5}'].map(v => fromTagWith(cfg, v).__t);
  R['C1b a note with no moment, or a strange one, still reads — with ts 0 (the relay then goes by the day alone)'] = [odd.every(t => t && t.src === 'trainz' && t.ts === 0), odd];
  const keep = cfg.slice(cfg.indexOf('const SIGNOUT_KEEP_KEYS'), cfg.indexOf('const SIGNOUT_KEEP_PREFIXES'));
  R['C5 the note survives a sign-out / a different account signing in on this browser (a word and a time, nobody\'s data)'] = [/'rr_from',/.test(keep), 0];
  const bad = [null, '', 'garbage', '[]', '{"src":"a b","at":"2026-11-24"}', '{"src":"trainz","at":"today"}', '{"src":"trainz"}', '{"src":"<b>","at":"2026-11-24"}', '"trainz"', 'THROW'].map(v => fromTagWith(cfg, v).__t);
  R['C2 anything else (nothing, junk, a strange word, a bad day, a blocked browser) reads as null'] = [bad.every(v => v === null), bad];
  R['C3 the app keeps NO number of its own — the days, the percentage and the partner list are the relay\'s'] =
    [!/\b(30|10|12)\b\s*,?\s*\/\/.*(day|percent|month)/i.test(cfgSlice(cfg)) && !/days\s*:|percent\s*:|partners\s*:/.test(cfgSlice(cfg)), 0];
  R['C4 the words never say "AI"'] = [!/\bAI\b/.test(cfgSlice(cfg)), 0];
  return R;
}

// ── D · the sign-in check and the checkout link ──────────────────
function vaultFns(vault, cfg, tag, email) {
  const a = vault.indexOf('function _subFrom() {'), b = vault.indexOf('function _subDate(');
  const c = vault.indexOf('// The checkout link, with the signed-in email filled in AND locked');
  if (a < 0 || c < 0) throw new Error('_subFrom / _subCheckoutUrl moved; update this test');
  const end = vault.indexOf('\n}\n', vault.indexOf('function _subCheckoutUrl(base) {')) + 3;
  const ctx = { JSON, String, Number, Math, isFinite, encodeURIComponent, state: { user: { email: email } }, localStorage: { getItem: () => tag } };
  vm.createContext(ctx);
  vm.runInContext(cfgSlice(cfg) + '\n' + vault.slice(a, end) + '\nthis._subFrom = _subFrom; this._subCheckoutUrl = _subCheckoutUrl;', ctx);
  return ctx;
}
function sectionD(vault, cfg) {
  const R = {};
  const PAY = 'https://buy.stripe.com/abc123', NOTE = '{"src":"trainz","at":"2026-11-24","ts":1795562040000}';
  const w = vaultFns(vault, cfg, NOTE, 'pat@example.com'), n = vaultFns(vault, cfg, null, 'pat@example.com');
  R['D1 no note → the checkout link is exactly what it was'] = [n._subCheckoutUrl(PAY) === PAY + '?locked_prefilled_email=pat%40example.com', n._subCheckoutUrl(PAY)];
  R['D2 a note → the same link + client_reference_id=trainz (Stripe\'s own reference on the checkout)'] =
    [w._subCheckoutUrl(PAY) === PAY + '?locked_prefilled_email=pat%40example.com&client_reference_id=trainz', w._subCheckoutUrl(PAY)];
  R['D3 a link that already carries a reference keeps its own'] = [w._subCheckoutUrl(PAY + '?client_reference_id=show') === PAY + '?client_reference_id=show&locked_prefilled_email=pat%40example.com', w._subCheckoutUrl(PAY + '?client_reference_id=show')];
  R['D4 a link with a promo code already on it gets both'] = [w._subCheckoutUrl(PAY + '?prefilled_promo_code=YORK2026') === PAY + '?prefilled_promo_code=YORK2026&locked_prefilled_email=pat%40example.com&client_reference_id=trainz', w._subCheckoutUrl(PAY + '?prefilled_promo_code=YORK2026')];
  R['D5 no link → no link'] = [w._subCheckoutUrl('') === '', 0];
  R['D6 _subFrom: the word, the day and the moment — or blanks'] = [JSON.stringify(w._subFrom()) === '{"src":"trainz","at":"2026-11-24","ts":1795562040000}' && JSON.stringify(n._subFrom()) === '{"src":"","at":"","ts":0}', [w._subFrom(), n._subFrom()]];
  const call = vault.slice(vault.indexOf("vaultPost({ action: 'sub_check'"), vault.indexOf("vaultPost({ action: 'sub_check'") + 700);
  R['D7 the sign-in check (sub_check) carries from, fromAt and fromTs'] = [/from: _subFrom\(\)\.src, fromAt: _subFrom\(\)\.at, fromTs: _subFrom\(\)\.ts,/.test(call), call.slice(0, 200)];
  const ia = vault.slice(vault.indexOf('IDENTITY_ACTIONS: ['), vault.indexOf('IDENTITY_ACTIONS: [') + 900);
  R['D8 the partner report travels with the sign-in proof (the relay lets owners only read it)'] = [/'referral_report'/.test(ia), 0];
  R['D9 every checkout button still goes through _subCheckoutUrl'] = [(vault.match(/_subCheckoutUrl\(r\.(payLink|renewLink \|\| r\.payLink)\)/g) || []).length >= 3 && !/href="' \+ _subEsc\(r\.payLink\)/.test(vault), (vault.match(/_subCheckoutUrl\(/g) || []).length];
  return R;
}

// ── E · the Office card ──────────────────────────────────────────
function ymFns(ym, cfg) {
  const ctx = { JSON, String, Number, Math, Array, Date, RegExp, isNaN, console: { log() {}, warn() {} }, setInterval: () => 0, clearInterval() {}, setTimeout: () => 0,
    document: { getElementById: () => null, createElement: () => ({ click() {} }), querySelector: () => null },
    state: { user: { email: '' } }, RR_OWNER_EMAILS: [], rrRegisterPage() {}, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cfgSlice(cfg) + '\nthis.RR_REFERRAL = RR_REFERRAL;', ctx);
  vm.runInContext(ym, ctx);
  return ctx;
}
function sectionE(ym, cfg) {
  const R = {};
  let c;
  try { c = ymFns(ym, cfg); } catch (e) { R['E0 the Office file loads'] = [false, String(e && e.message)]; return R; }
  const M = c._ymReferralMoney, L = c._ymReferralLastMonth, CSV = c._ymReferralCsv;
  R['E1 money: cents → dollars, never a rounding slip'] = [M(7500) === '$75.00' && M(600) === '$6.00' && M(5) === '$0.05' && M(0) === '$0.00' && M(123456789) === '$1,234,567.89' && M(1999) === '$19.99', [M(7500), M(5), M(123456789)]];
  R['E2 the month box starts on LAST month (January → December of the year before)'] = [L(new Date(2026, 10, 24)) === '2026-10' && L(new Date(2027, 0, 5)) === '2026-12' && L(new Date(2026, 2, 31)) === '2026-02', [L(new Date(2026, 10, 24)), L(new Date(2027, 0, 5))]];
  const rep = { month: '2026-10', percent: 10, months: 12, total: 13500, owed: 1350, lines: [
    { paidOn: '2026-10-10', email: 'c@x.com', source: 'trainz', clicked: '2026-10-03', amount: 6000, owed: 600 },
    { paidOn: '2026-10-28', email: 'smith, "pat"@x.com', source: 'trainz', clicked: '2026-10-01', amount: 7500, owed: 750 }] };
  const csv = CSV(rep).split('\r\n');
  R['E3 the file: a title row, one line per payment, the totals, and what the share is of'] =
    [csv[0] === 'Paid on,Member,Partner,Clicked,Paid,Owed' && csv[1] === '2026-10-10,c@x.com,trainz,2026-10-03,$60.00,$6.00' && csv[3] === ',,,Total,$135.00,$13.50' && /10% of what was actually paid/.test(csv[4]) && /first 12 months only/.test(csv[4]), csv];
  R['E4 a comma or a quote in a cell cannot shift the columns'] = [csv[2] === '2026-10-28,"smith, ""pat""@x.com",trainz,2026-10-01,$75.00,$7.50', csv[2]];
  const evil = CSV({ month: '2026-10', percent: 10, months: 12, total: 0, owed: 0, lines: [{ paidOn: '2026-10-10', email: '=HYPERLINK("http://x")', source: '+trainz', clicked: '-1', amount: 100, owed: 10 }, { paidOn: '2026-10-11', email: '@cmd', source: 'trainz', clicked: '2026-10-01', amount: 100, owed: 10 }] }).split('\r\n');
  R['E4b a cell that starts like a formula (= + - @) is written as text, never run by a spreadsheet'] =
    [/^2026-10-10,"'=HYPERLINK\(""http:\/\/x""\)",'\+trainz,'-1,/.test(evil[1]) && /^2026-10-11,'@cmd,trainz,/.test(evil[2]) && csv[1] === '2026-10-10,c@x.com,trainz,2026-10-03,$60.00,$6.00', evil];
  R['E5 the card asks the relay (referral_report), is for owners only, and one question at a time'] =
    [/vaultPost\(\{ action: 'referral_report', month: _ymRef\.month \}\)/.test(ym) && /if \(!_isOwner\(\) \|\| _ymRef\.busy\) return;/.test(ym), 0];
  R['E6 the card does no sums of its own — the totals are the relay\'s'] = [!/\.reduce\(/.test(ym.slice(ym.indexOf('// ── PARTNER REPORT'), ym.indexOf('window.ymBuildPage = function'))) && !/\* *(0\.1|10) *\/ *100|\* *0\.10?\b/.test(ym.slice(ym.indexOf('// ── PARTNER REPORT'), ym.indexOf('window.ymBuildPage = function'))), 0];
  return R;
}

function all(src) {
  return Object.assign({}, sectionA(src.TAG), sectionB(src.HOME), sectionC(src.CFG), sectionD(src.VAULT, src.CFG), sectionE(src.YM, src.CFG));
}
const REAL = { TAG, HOME, CFG, VAULT, YM };
console.log('== the real code ==');
const real = all(REAL);
Object.keys(real).forEach(n => T(n, real[n][0], real[n][1]));

// ── P · planted offenders ────────────────────────────────────────
console.log('\n== P · planted offenders ==');
function plant(key, from, to) {
  if (REAL[key].split(from).length !== 2) throw new Error('planted ' + key + ': the anchor moved (' + from.slice(0, 50) + ')');
  return Object.assign({}, REAL, { [key]: REAL[key].replace(from, to) });
}
const PLANTS = [
  ['any text accepted as a partner word', () => plant('TAG', '([A-Za-z0-9_-]{1,24})(?:[&#]|$)', '([^&#]*)'), /^A5 /],
  ['a visit without ?from= wipes the note', () => plant('TAG', '    if (!m) return;\n', "    if (!m) { localStorage.setItem('rr_from', ''); return; }\n"), /^A3 /],
  ['the reader sends the visitor somewhere', () => plant('TAG', '  } catch (e) {}\n})();', "    location.href = '/app/';\n  } catch (e) {}\n})();"), /^A7 /],
  ['the link is read AFTER the hop to the app', () => {
    const tag = '<script src="/site/from-tag.js"></script>\n';
    const moved = REAL.HOME.replace(tag, '').replace('<meta name="viewport"', tag + '<meta name="viewport"');
    if (moved === REAL.HOME) throw new Error('planted HOME: anchors moved');
    return Object.assign({}, REAL, { HOME: moved });
  }, /^B2 /],
  ['the link reader is deferred', () => plant('HOME', '<script src="/site/from-tag.js"></script>', '<script src="/site/from-tag.js" defer></script>'), /^B3 /],
  ['rrFromTag trusts whatever is stored', () => plant('CFG', "    if (!RR_REFERRAL.wordRe.test(src) || !RR_REFERRAL.dayRe.test(at)) return null;\n", ''), /^C2 /],
  ['the checkout link forgets the partner', () => plant('VAULT', "    url += '&' + RR_REFERRAL.stripeParam + '=' + encodeURIComponent(src);\n", ''), /^D2 /],
  ['a second reference stacked on the link', () => plant('VAULT', " && url.indexOf(RR_REFERRAL.stripeParam + '=') < 0", ''), /^D3 /],
  ['the sign-in check does not carry the tag', () => plant('VAULT', "      from: _subFrom().src, fromAt: _subFrom().at, fromTs: _subFrom().ts,", '      '), /^D7 /],
  ['the moment of the click is not kept', () => plant('TAG', ",\n      ts: d.getTime()\n", "\n"), /^A1 /],
  ['the note is wiped when another account signs in', () => plant('CFG', "  'rr_from',\n", ''), /^C5 /],
  ['a formula cell left as it is', () => plant('YM', " if (/^[=+\\-@\\t\\r]/.test(v)) v = \"'\" + v;", ''), /^E4b /],
  ['the report sent without the sign-in proof', () => plant('VAULT', "                     'referral_report',", '                     '), /^D8 /],
  ['money rounded to whole dollars', () => plant('YM', "+ '.' + ('0' + (n % 100)).slice(-2);", ';'), /^E1 /],
  ['the month box starts on THIS month', () => plant('YM', "    var y = d.getFullYear(), m = d.getMonth();           // getMonth() is last month's number, 1-based", '    var y = d.getFullYear(), m = d.getMonth() + 1;'), /^E2 /],
  ['a comma shifts the file\'s columns', () => plant('YM', "return /[\",\\n]/.test(v) ? '\"' + v.replace(/\"/g, '\"\"') + '\"' : v; };", 'return v; };'), /^E4 /],
  ['the report open to a member', () => plant('YM', '    if (!_isOwner() || _ymRef.busy) return;                       // owners only; one question at a time', '    if (_ymRef.busy) return;'), /^E5 /],
];
PLANTS.forEach((p, i) => {
  let res;
  try { res = all(p[1]()); } catch (e) { T('P' + (i + 1) + ' planted "' + p[0] + '" could be run', false, String(e && e.message)); return; }
  const hit = Object.keys(res).filter(n => p[2].test(n));
  T('P' + (i + 1) + ' planted "' + p[0] + '" turns its check red', hit.length > 0 && hit.every(n => res[n][0] === false), hit.map(n => [n.slice(0, 24), res[n][0]]));
});

console.log('\n' + (fail ? 'FAILED' : 'ALL PASSED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
