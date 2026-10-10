// ════════════════════════════════════════════════════════════════════════
// lens_staging_tests.js — v0.9.1835
//
// GOOGLE LENS WITHOUT THE ROUND TRIP — AND WITH THE WORDS.
//
// [stated] Brad: "when you use google lens to id something in the app, is
// there anyway to speed that up?" … "i want the words to help id so tell me
// what we can do to speed it up without losing that."
//
// Before: the Photo Inbox's Google Search button DOWNLOADED the full photo
// from Drive to the phone, UPLOADED it back into "_Lens Staging" (3–4 MB each
// way on a 12 MP shot), made it public, then stamped it — four requests, two
// of them full-size transfers — before the Lens link could open. Now Drive
// copies the photo on Google's side (one small request, stamp included),
// publishes it, and remembers it; the same photo searched again inside the
// window reuses the copy. The wizard's camera shot (not in Drive yet) is
// still uploaded once, stamp included. THE WORDS ON THE LINK ARE UNTOUCHED.
//
// These tests run the REAL staging functions (brace-matched out of drive.js)
// against a recording Drive stub, and pin the callers. Section F plants the
// old shapes and requires red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DRV = fs.readFileSync(path.join(__dirname, '..', 'app', 'drive.js'), 'utf8');
const PI = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
const WZ = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-photos.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
// the staging block: from the TTL constant to the cleanup helper
function stagingBlock(src) {
  const a = src.indexOf('var _RR_LENS_TTL_MS'), b = src.indexOf('async function driveCleanupLensStaging');
  if (a < 0 || b < a) throw new Error('staging block not found');
  return src.slice(a, b);
}

function build(opts) {
  opts = opts || {};
  const log = [];
  let now = 1000000;
  const sb = {
    console: { log() {}, warn() {}, error() {} },   // the real functions log their failures; the D cases expect them
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
    driveCache: { vaultId: 'vault1', lensStagingId: null },
    Date: { now: () => now },
    driveFindOrCreateFolder: async (name, parent) => { log.push(['folder', name, parent]); return 'staging1'; },
    driveRequest: async (m, ep, body) => {
      log.push([m, ep, body]);
      if (/\/copy\?/.test(ep)) return { id: 'copy-' + log.length };
      if (/\/permissions\?/.test(ep)) return { id: 'perm' };
      return {};
    },
    // v0.9.1911: the staging block now shrinks a big camera shot first; the
    // shrinker lives outside the block (tests/lens_speed_tests.js proves it in
    // a real browser). Here it hands the photo back unchanged.
    _rrShrinkImage: async (f) => f,
    driveUploadFile: async (file, name, folderId, extra) => { log.push(['upload', name, folderId, extra, file && file.size]); return { id: 'up-' + log.length }; },
    __tick: (ms) => { now += ms; },
  };
  vm.createContext(sb);
  vm.runInContext((opts.source || stagingBlock(DRV)) + '\nthis.copy = driveStageLensCopy; this.photo = driveStageLensPhoto; this.memo = _rrLensMemo;', sb);
  sb.log = log;
  return sb;
}
const asks = (sb) => sb.log.filter(e => e[0] !== 'folder');

(async () => {
  section('A. A photo already in Drive: copied on Google\'s side, nothing through the phone');
  {
    const sb = build();
    const r = await sb.copy('inbox-photo-1');
    const a = asks(sb);
    ok('two small requests and no transfer: a copy, then the permission', a.length === 2 && a[0][0] === 'POST' && /^\/files\/inbox-photo-1\/copy\?fields=id$/.test(a[0][1]) && a[1][0] === 'POST' && /^\/files\/copy-2\/permissions\?fields=id$/.test(a[1][1]), JSON.stringify(a.map(x => x.slice(0, 2))));
    ok('nothing was downloaded or uploaded', !sb.log.some(e => e[0] === 'upload') && !a.some(e => /alt=media/.test(e[1])));
    ok('the copy lands in the staging folder, named as a Lens copy', a[0][2] && Array.isArray(a[0][2].parents) && a[0][2].parents[0] === 'staging1' && /^lens_\d+_copy\.jpg$/.test(a[0][2].name), JSON.stringify(a[0][2]));
    ok('the cleanup stamp rides the SAME request (rrShared + a ten-minute expiry)', a[0][2].appProperties && a[0][2].appProperties.rrShared === '1' && a[0][2].appProperties.rrShareExp === String(1000000 + 10 * 60 * 1000), JSON.stringify(a[0][2].appProperties));
    ok('…so the file is stamped before it is public', a.findIndex(e => /\/copy\?/.test(e[1])) < a.findIndex(e => /\/permissions\?/.test(e[1])));
    ok('anyone with the link may read — what Lens needs', a[1][2] && a[1][2].role === 'reader' && a[1][2].type === 'anyone', JSON.stringify(a[1][2]));
    ok('Lens is handed the 1600-px thumbnail of the copy (small stampings stay legible)', r.url === 'https://drive.google.com/thumbnail?id=copy-2&sz=w1600' && r.id === 'copy-2', JSON.stringify(r));
    ok('a fresh copy says so (the caller arms its cleanup timer)', r.reused === false);
  }

  section('B. Reuse: the same photo searched again inside the window opens at once');
  {
    const sb = build();
    const r1 = await sb.copy('inbox-photo-1');
    sb.__tick(3 * 60 * 1000);
    const r2 = await sb.copy('inbox-photo-1');
    ok('the second search made NO Drive request', asks(sb).length === 2, String(asks(sb).length));
    ok('…and got the same copy back, marked reused (the caller leaves the timer alone)', r2.id === r1.id && r2.url === r1.url && r2.reused === true, JSON.stringify(r2));
    const r3 = await sb.copy('inbox-photo-2');
    ok('a different photo is its own copy', r3.id !== r1.id && asks(sb).length === 4);
    sb.__tick(7 * 60 * 1000);   // 10 minutes after the first copy: past reuse (9) — the timer trashes it at 10
    const r4 = await sb.copy('inbox-photo-1');
    ok('past the reuse window a new copy is made (never a link to a trashed file)', r4.reused === false && r4.id !== r1.id && asks(sb).length === 6, JSON.stringify(r4));
    ok('the reuse window is a full minute shorter than the copy\'s life', /var _RR_LENS_REUSE_MS = 9 \* 60 \* 1000;/.test(DRV) && /var _RR_LENS_TTL_MS = 10 \* 60 \* 1000;/.test(DRV));
  }

  section('C. A camera shot (not in Drive yet): uploaded once, stamp folded in, reused too');
  {
    const sb = build();
    const file = { name: 'IMG_0042.jpg', size: 3400000, lastModified: 1700000000000, type: 'image/jpeg' };
    const r = await sb.photo(file);
    const a = sb.log.filter(e => e[0] !== 'folder');
    ok('one upload, then the permission — no separate stamp call', a.length === 2 && a[0][0] === 'upload' && a[1][0] === 'POST' && /permissions/.test(a[1][1]), JSON.stringify(a.map(x => x.slice(0, 2))));
    ok('the stamp rides the upload\'s own metadata', a[0][3] && a[0][3].appProperties && a[0][3].appProperties.rrShared === '1' && /^\d+$/.test(a[0][3].appProperties.rrShareExp), JSON.stringify(a[0][3]));
    ok('it goes to the staging folder under a Lens name', a[0][2] === 'staging1' && /^lens_\d+_IMG_0042\.jpg$/.test(a[0][1]), a[0][1]);
    ok('Lens gets the 1600-px thumbnail', /sz=w1600$/.test(r.url) && r.reused === false);
    const r2 = await sb.photo(file);
    ok('the same shot searched again reuses the upload (no second transfer)', r2.reused === true && r2.id === r.id && sb.log.filter(e => e[0] === 'upload').length === 1);
    const r3 = await sb.photo({ name: 'IMG_0042.jpg', size: 3400001, lastModified: 1700000000000, type: 'image/jpeg' });
    ok('a different shot (even with the same name) is uploaded on its own', r3.reused === false && sb.log.filter(e => e[0] === 'upload').length === 2);
  }

  section('D. Failure shapes');
  {
    const sb = build();
    let threw = '';
    sb.driveRequest = async (m, ep, body) => { if (/\/copy\?/.test(ep)) return {}; return { id: 'x' }; };
    try { await sb.copy('p'); } catch (e) { threw = e.message; }
    ok('a copy that comes back without an id is an error, not a link to nothing', /Lens staging copy failed/.test(threw), threw);
    const sb2 = build();
    sb2.driveRequest = async (m, ep, body) => { if (/\/copy\?/.test(ep)) return { id: 'c1' }; throw new Error('403'); };
    threw = '';
    try { await sb2.copy('p'); } catch (e) { threw = e.message; }
    ok('a copy nobody can reach is a failed search — the permission error is raised, not swallowed', /Could not make photo public for Lens/.test(threw), threw);
    ok('…and a failed copy is not remembered (the next tap tries again)', !sb2.memo['drive:p']);
    const sb3 = build();
    threw = '';
    try { await sb3.copy(''); } catch (e) { threw = e.message; }
    ok('no photo id → a plain error', /No photo to send to Lens/.test(threw), threw);
  }

  section('E. The callers: the words stay on the link');
  {
    const inbox = grab(PI, 'window._pinLensSearch = async function ()');
    ok('the inbox button asks for the server-side copy of the photo it has', /var staged = await driveStageLensCopy\(gs\[0\]\.files\[0\]\.id\);/.test(inbox));
    ok('…and no longer downloads the bytes to re-upload them', !/_pinBytes\(/.test(inbox) && !/new File\(/.test(inbox) && !/driveStageLensPhoto/.test(inbox));
    ok('the Lens link still carries the picture AND the words (q= + multisearch mode)', /'https:\/\/lens\.google\.com\/uploadbyurl\?url=' \+ encodeURIComponent\(staged\.url\)\n\s*\+ \(_hint \? '&q=' \+ encodeURIComponent\(_hint\) \+ '&lns_mode=mu' : ''\);/.test(inbox));
    ok('…built from the photo\'s tag and settings as before (maker, era, years, gauge, type)', /_lh\.mfrs/.test(inbox) && /_lh\.eraLabel/.test(inbox) && /_lh\.eraYears/.test(inbox) && /_lh\.scale/.test(inbox) && /_lh\.type \|\| 'model train'/.test(inbox));
    ok('a fresh copy arms the ten-minute cleanup; a reused one leaves the running timer alone', /if \(!staged\.reused\) setTimeout\(function \(\) \{ try \{ driveCleanupLensStaging\(staged\.id\); \} catch \(e\) \{\} \}, 10 \* 60 \* 1000\);/.test(inbox));
    ok('the button says what is happening in plain words', /'Sending to Google…'/.test(inbox) && !/Staging photo/.test(inbox));
    const wiz = grab(WZ, 'async function _identifyOpenLens()');   // the Lens half of the wizard's search (the reader-first half hands off to it)
    ok('the wizard still uploads its camera shot (it is not in Drive yet)', /const staged = await driveStageLensPhoto\(_identifyPhotoFile(?:, function \(n, ms\) \{ _lensSteps\.push\(\[n, ms\]\); \})?\);/.test(wiz));   // v0.9.1911: may carry the step timer
    ok('…and its link still carries the words', /uploadbyurl\?url=' \+ encodeURIComponent\(staged\.url\)\n\s*\+ \(_hint \? '&q=' \+ encodeURIComponent\(_hint\) \+ '&lns_mode=mu' : ''\);/.test(wiz));
    ok('…arming its cleanup only for a fresh upload', /if \(!staged\.reused\) \{\n\s*_identifyStagedFileId = staged\.id;/.test(wiz));
    ok('driveUploadFile grew an OPTIONAL fourth argument — every other caller is unchanged', /async function driveUploadFile\(file, name, folderId, extraMeta\)/.test(DRV) && /Object\.assign\(\{ name, parents: \[folderId\], mimeType: file\.type \}, extraMeta \|\| \{\}\)/.test(DRV));
    ok('the sweeper still looks for the stamp the copy carries', /appProperties has \{ key='rrShared' and value='1' \}/.test(fs.readFileSync(path.join(__dirname, '..', 'app', 'share.js'), 'utf8')));
  }

  section('F. THE OFFENDERS, require red');
  {
    // 1. the stamp as a separate PATCH after publishing (the v1324 shape)
    const src = stagingBlock(DRV);
    const o1 = src.replace("{ name: 'lens_' + Date.now() + '_copy.jpg', parents: [stagingId], appProperties: _rrLensStamp() });\n  if (!copied || !copied.id) throw new Error('Lens staging copy failed');\n  await _rrLensPublish(copied.id);",
      "{ name: 'lens_' + Date.now() + '_copy.jpg', parents: [stagingId] });\n  if (!copied || !copied.id) throw new Error('Lens staging copy failed');\n  await _rrLensPublish(copied.id);\n  try { await driveRequest('PATCH', '/files/' + copied.id, { appProperties: _rrLensStamp() }); } catch (eS) {}");
    ok('offender 1 changed the source', o1 !== src);
    const sb1 = build({ source: o1 });
    await sb1.copy('p');
    const a1 = asks(sb1);
    ok('OFFENDER 1: a separate stamp call → "two requests" and "stamped before public" red', !(a1.length === 2) && !(a1[0][2] && a1[0][2].appProperties), JSON.stringify(a1.map(x => x.slice(0, 2))));
    // 2. no reuse (every tap copies again)
    const o2 = src.replace("  var alive = _rrLensAlive(key);\n  if (alive) return alive;\n  var stagingId = await _rrLensFolder();\n  var copied", "  var stagingId = await _rrLensFolder();\n  var copied");
    ok('offender 2 changed the source', o2 !== src);
    const sb2 = build({ source: o2 });
    await sb2.copy('p'); await sb2.copy('p');
    ok('OFFENDER 2: without the memo the second search copies again → B red', asks(sb2).length === 4);
    // 3. the inbox button going back to download + upload
    const oldInbox = PI.replace('var staged = await driveStageLensCopy(gs[0].files[0].id);', "var blob = await _pinBytes(gs[0].files[0].id);\n      var file = new File([blob], 'inbox-photo.jpg', { type: blob.type || 'image/jpeg' });\n      var staged = await driveStageLensPhoto(file);");
    ok('offender 3 changed the source', oldInbox !== PI);
    const oi = grab(oldInbox, 'window._pinLensSearch = async function ()');
    ok('OFFENDER 3: the round trip is back → E red', !(/driveStageLensCopy\(/.test(oi)) && /_pinBytes\(/.test(oi));
    // 4. the words dropped from the link
    const noWords = PI.replace("+ (_hint ? '&q=' + encodeURIComponent(_hint) + '&lns_mode=mu' : '');\n      if (tab)", ";\n      if (tab)");
    ok('offender 4 changed the source', noWords !== PI);
    ok('OFFENDER 4: a link without the words → E red', !/&q=' \+ encodeURIComponent\(_hint\) \+ '&lns_mode=mu/.test(grab(noWords, 'window._pinLensSearch = async function ()')));
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
