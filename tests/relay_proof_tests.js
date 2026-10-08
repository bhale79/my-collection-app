// ════════════════════════════════════════════════════════════════════════
// relay_proof_tests.js — v0.9.1894 (security review findings #2 + #3)
//
// WHO IS ASKING IS CHECKED WITH GOOGLE. Relay v4.4 no longer believes the
// email a call carries: it takes the Google sign-in proof (gtoken), asks
// Google whose it is, and uses THAT email — for the subscription check and
// for every photo read (counted per account, under one overall daily
// ceiling). This suite holds the APP's half:
//   A. every relay call is in exactly ONE list — IDENTITY (carries the proof)
//      or ANONYMOUS (never does; the Privacy page promises the daily ping,
//      Market contributions and barcode suggestions are not tied to you).
//      A new call that is in neither list fails here.
//   B. the REAL vaultPost: proof on identity calls only; a caller can never
//      smuggle one onto an anonymous call; an expired proof is renewed once
//      and the call retried once — never a loop.
//   C. the photo reader tells "the overall daily ceiling" (busy) apart from
//      "your reads are used up" (quota).
//   D. the guards can fail: v0.9.1892's vaultPost (no proof) goes red, and a
//      planted unlisted call goes red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const APPDIR = path.join(__dirname, '..', 'app');
const VAULT_SRC = fs.readFileSync(path.join(APPDIR, 'vault.js'), 'utf8');
const AIID = fs.readFileSync(path.join(APPDIR, 'ai-id.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
function vaultConfig(src) {
  const box = {};
  vm.createContext(box);
  vm.runInContext(grab(src, 'const VAULT = {').replace('const VAULT =', 'this.VAULT =') + ';', box);
  return box.VAULT;
}
// every action the app sends to the relay: action:'x' in a vaultPost(...) / vaultGet(...) call
function sentActions(files) {
  const out = {};
  files.forEach(f => {
    const src = typeof f === 'string' ? fs.readFileSync(path.join(APPDIR, f), 'utf8') : f.src;
    const re = /vault(?:Post|Get)\(\s*\{\s*action:\s*'([a-z_0-9]+)'/g;
    let m;
    while ((m = re.exec(src))) (out[m[1]] = out[m[1]] || []).push(typeof f === 'string' ? f : f.name);
  });
  return out;
}
const APP_FILES = fs.readdirSync(APPDIR).filter(f => f.endsWith('.js'));

// ── A. one list per call ────────────────────────────────────────────────
section('A. every relay call is in exactly one list');
const V = vaultConfig(VAULT_SRC);
const IDS = V.IDENTITY_ACTIONS || [], ANON = V.ANONYMOUS_ACTIONS || [];
ok('both lists exist', IDS.length > 0 && ANON.length > 0, { IDS, ANON });
ok('no call is in both lists', IDS.every(a => ANON.indexOf(a) < 0), IDS.filter(a => ANON.indexOf(a) >= 0));
const sent = sentActions(APP_FILES);
const actions = Object.keys(sent).sort();
ok('found the app\'s relay calls (scan sanity)', actions.length >= 14, actions);
actions.forEach(a => ok('"' + a + '" is classified', IDS.indexOf(a) >= 0 || ANON.indexOf(a) >= 0, sent[a]));
['heartbeat', 'submit', 'get_market', 'get_counts', 'delete_token', 'barcode_pair', 'image_wanted']
  .forEach(a => ok('"' + a + '" stays ANONYMOUS (Privacy page)', ANON.indexOf(a) >= 0));
['sub_check', 'ai_identify', 'ai_identify2', 'ai_verify_photo', 'ref_photo', 'ai_card', 'ai_quota', 'import_map']
  .forEach(a => ok('"' + a + '" carries the sign-in proof', IDS.indexOf(a) >= 0));
ok('no listed call is dead (each list entry is really sent)', IDS.concat(ANON).every(a => sent[a]), IDS.concat(ANON).filter(a => !sent[a]));

// ── B. the REAL vaultPost ───────────────────────────────────────────────
section('B. the real vaultPost');
function build(src, opts) {
  opts = opts || {};
  const posts = [];
  const answers = (opts.answers || []).slice();
  const sb = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Object, String, Promise,
    setTimeout: (fn) => { sb.ticks = (sb.ticks || 0) + 1; if (opts.renewAfterTicks && sb.ticks === opts.renewAfterTicks) sb.accessToken = opts.newToken; fn(); },
    accessToken: opts.token === undefined ? 'ya29.first' : opts.token,
    rrEnsureFreshToken: (why) => { sb.renewCalls = (sb.renewCalls || 0) + 1; sb.renewWhy = why; },
    fetch: async (url, o) => { posts.push(JSON.parse(o.body)); const a = answers.length ? answers.shift() : { status: 200 }; return { json: async () => a }; },
  };
  vm.createContext(sb);
  let code = grab(src, 'const VAULT = {') + ';\n';
  ['function _vaultNeedsProof(', 'function _vaultProof(', 'async function _vaultFreshProof('].forEach(sig => { if (src.indexOf(sig) >= 0) code += grab(src, sig) + '\n'; });
  code += grab(src, 'async function vaultPost(payload)') + '\nthis.vaultPost = vaultPost;';
  vm.runInContext(code, sb);
  sb.posts = posts;
  return sb;
}
async function runB(src) {
  const r = {};
  let sb = build(src);
  await sb.vaultPost({ action: 'sub_check', email: 'a@x.com' });
  r.subProof = sb.posts[0] && sb.posts[0].gtoken;
  await sb.vaultPost({ action: 'ai_identify', token: 'tkt', image: 'x' });
  r.aiProof = sb.posts[1] && sb.posts[1].gtoken;
  await sb.vaultPost({ action: 'heartbeat', v: '1' });
  r.hbProof = sb.posts[2] && ('gtoken' in sb.posts[2]);
  await sb.vaultPost({ action: 'submit', token: 'tkt', items: [], gtoken: 'smuggled' });
  r.smuggled = sb.posts[3] && ('gtoken' in sb.posts[3]);
  // expired proof → renewed once, retried once with the new one
  sb = build(src, { answers: [{ status: 401, message: 'proof' }, { status: 200, sub: 'beta' }], renewAfterTicks: 3, newToken: 'ya29.second' });
  const out = await sb.vaultPost({ action: 'sub_check', email: 'a@x.com' });
  r.retryCount = sb.posts.length; r.retryToken = sb.posts[1] && sb.posts[1].gtoken; r.retryOut = out && out.sub; r.renewCalls = sb.renewCalls;
  // no fresh proof arrives → the 401 comes back, no loop
  sb = build(src, { answers: [{ status: 401, message: 'proof' }, { status: 200 }] });
  const out2 = await sb.vaultPost({ action: 'ai_quota', token: 'tkt' });
  r.noFreshPosts = sb.posts.length; r.noFreshOut = out2 && out2.status;
  // a 401 that is not about the proof, and a 401 on an anonymous call: never retried
  sb = build(src, { answers: [{ status: 401, message: 'other' }], renewAfterTicks: 1, newToken: 'ya29.x' });
  await sb.vaultPost({ action: 'sub_check', email: 'a@x.com' });
  r.otherPosts = sb.posts.length;
  sb = build(src, { answers: [{ status: 401, message: 'proof' }], renewAfterTicks: 1, newToken: 'ya29.x' });
  await sb.vaultPost({ action: 'heartbeat' });
  r.anonPosts = sb.posts.length;
  // not signed in → the identity call goes with an empty proof (relay answers 401 → app fails open)
  sb = build(src, { token: null });
  await sb.vaultPost({ action: 'sub_check', email: 'a@x.com' });
  r.noTokenProof = sb.posts[0] && sb.posts[0].gtoken;
  return r;
}

(async function main() {
  const r = await runB(VAULT_SRC);
  ok('sub_check carries the sign-in proof', r.subProof === 'ya29.first', r.subProof);
  ok('a photo read carries the sign-in proof', r.aiProof === 'ya29.first', r.aiProof);
  ok('the daily ping carries NO proof', r.hbProof === false);
  ok('a proof passed by a caller is stripped from an anonymous call', r.smuggled === false);
  ok('expired proof → renewed through rrEnsureFreshToken once', r.renewCalls === 1, r.renewCalls);
  ok('…and the call retried ONCE with the new proof', r.retryCount === 2 && r.retryToken === 'ya29.second' && r.retryOut === 'beta', r);
  ok('no fresh proof arrives → one try only, the 401 comes back (no loop)', r.noFreshPosts === 1 && r.noFreshOut === 401, r);
  ok('a 401 that is not about the proof is not retried', r.otherPosts === 1, r.otherPosts);
  ok('an anonymous call is never retried for a proof', r.anonPosts === 1, r.anonPosts);
  ok('not signed in → empty proof (the relay refuses, the app fails open as before)', r.noTokenProof === '', r.noTokenProof);

  // ── C. busy vs quota ──────────────────────────────────────────────────
  section('C. the overall ceiling reads as "busy", not "no reads left"');
  const quotaLines = AIID.split('\n').map((l, i) => ({ l, i })).filter(x => /status === 429\) return \{ ok: false, reason: 'quota' \}/.test(x.l));
  ok('three photo-read paths answer quota', quotaLines.length === 3, quotaLines.length);
  const lines = AIID.split('\n');
  quotaLines.forEach(x => ok('line ' + (x.i + 1) + ': a busy 429 is caught first', /status === 429 && res\.busy\) return \{ ok: false, reason: 'busy' \}/.test(lines[x.i - 1]), lines[x.i - 1]));

  // ── D. the guards can fail ───────────────────────────────────────────
  section('D. the guards can fail');
  let old = null;
  try { old = execSync('git show 5e77095:app/vault.js', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) {}
  if (old) {
    const ro = await runB(old.replace('async function vaultPost(payload)', 'async function vaultPost(payload)'));
    ok('v0.9.1893 vaultPost sends NO proof → this suite would be red', ro.subProof === undefined && ro.aiProof === undefined, ro);
  } else {
    ok('old vaultPost available from git (5e77095) — skipped in a shallow clone', true);
  }
  const planted = sentActions([{ name: 'planted.js', src: "vaultPost({ action: 'mystery_call', x: 1 })" }]);
  ok('a planted unlisted call is caught by A', Object.keys(planted).length === 1 && IDS.indexOf('mystery_call') < 0 && ANON.indexOf('mystery_call') < 0);

  console.log('\n' + pass + ' passed, ' + fail + ' failed  (relay_proof_tests)');
  process.exit(fail ? 1 : 0);
})();
