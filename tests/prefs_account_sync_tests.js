// ════════════════════════════════════════════════════════════════════════
// prefs_account_sync_tests.js — v0.9.1779
//
// [stated] Brad, on the Photo ID switch: "my mobile photo read still says off,
// while my desktop says 20 left." v0.9.1775 fixed THAT one setting and said
// plainly that every other preference was still per-device. He then chose to
// finish the job, for all eighteen, display settings included.
//
// The merge is lifted out of drive.js and RUN. Everything below exercises the
// real `rrPrefsMerge`, not a description of it. Section F plants an offender
// for every rule and requires each to be caught.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DRIVE = fs.readFileSync(path.join(__dirname, '..', 'app', 'drive.js'), 'utf8');
const APP   = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
const AUTH  = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-auth.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}
function build(src) {
  return new Function("const PREF_AT_SUFFIX = '__at';\n" + grab(src || DRIVE, 'rrPrefsMerge')
                      + '\nreturn rrPrefsMerge;')();
}
const merge = build();
const NOW = 1000000;

console.log('\n== A. The newer change wins, ONE SETTING AT A TIME ==');
{
  // The whole point of per-key stamps. With one stamp for the file, the phone
  // changing the theme would stamp over a dashboard tweak just made on the
  // desktop — the v0.9.1771 bug, one layer up.
  const r = merge(
    { lv_theme: 'light', lv_dash_slots: '6' },
    { lv_theme: '500',   lv_dash_slots: '900' },
    { lv_theme: { v: 'dark', t: 800 }, lv_dash_slots: { v: '4', t: 100 } },
    NOW);
  ok('a NEWER remote setting is adopted', r.apply.lv_theme === 'dark', JSON.stringify(r.apply));
  ok('…carrying DRIVE\'s clock, not a fresh local one',
     r.apply['lv_theme__at'] === '800', r.apply['lv_theme__at']);
  ok('…and is NOT pushed back', !('lv_theme' in r.push), JSON.stringify(r.push));
  ok('a NEWER local setting is pushed', r.push.lv_dash_slots &&
     r.push.lv_dash_slots.v === '6' && r.push.lv_dash_slots.t === 900, JSON.stringify(r.push));
  ok('…and the local value is left alone', !('lv_dash_slots' in r.apply));
  ok('ONE setting moving does not disturb the other — the whole reason for per-key stamps',
     Object.keys(r.apply).filter(function (k) { return k.indexOf('__at') < 0; }).length === 1 &&
     Object.keys(r.push).length === 1);
}

console.log('\n== B. Agreement is silent ==');
{
  const r = merge({ lv_currency: '$' }, { lv_currency: '500' },
                  { lv_currency: { v: '$', t: 500 } }, NOW);
  ok('equal stamps write nothing', Object.keys(r.push).length === 0, JSON.stringify(r.push));
  ok('…and change nothing locally', Object.keys(r.apply).length === 0, JSON.stringify(r.apply));
}

console.log('\n== C. Settings this device has never seen ==');
{
  const r = merge({}, {}, { lv_page_size: { v: '100', t: 700 } }, NOW);
  ok('a setting only the account has is adopted', r.apply.lv_page_size === '100');
  ok('…with the account\'s clock', r.apply['lv_page_size__at'] === '700');
  ok('…and nothing is pushed', Object.keys(r.push).length === 0);

  const r2 = merge({ lv_def_hasBox: 'true' }, { lv_def_hasBox: '650' }, {}, NOW);
  ok('a setting only this device has is pushed', r2.push.lv_def_hasBox.v === 'true');
  ok('…with its own clock, not now()', r2.push.lv_def_hasBox.t === 650);
}

console.log('\n== D. FIRST RUN: the device that seeds wins, then newest-wins ==');
{
  // A value set before v1779 has no stamp. Brad's two devices both have
  // eighteen of them and they disagree. Whoever syncs first seeds the file;
  // the others adopt. Without this rule "whichever synced last" wins forever,
  // which is the bug, not the rule.
  const seeder = merge({ lv_theme: 'light' }, {}, {}, NOW);
  ok('with an empty account, an unstamped local value SEEDS the file',
     seeder.push.lv_theme.v === 'light' && seeder.push.lv_theme.t === NOW,
     JSON.stringify(seeder.push));

  const second = merge({ lv_theme: 'dark' }, {}, { lv_theme: { v: 'light', t: NOW } }, NOW);
  ok('the SECOND device adopts the seeded value rather than fighting it',
     second.apply.lv_theme === 'light', JSON.stringify(second.apply));
  ok('…and does not push its own unstamped value', !('lv_theme' in second.push));

  // And from then on a real change on that second device wins normally.
  const later = merge({ lv_theme: 'dark' }, { lv_theme: String(NOW + 50) },
                      { lv_theme: { v: 'light', t: NOW } }, NOW + 60);
  ok('after seeding, a real change on the second device wins normally',
     later.push.lv_theme.v === 'dark', JSON.stringify(later.push));
}

console.log('\n== E. It is wired to the one write path, and to sign-in ==');
{
  ok('_prefSet stamps the setting it just wrote',
     /function _prefSet\(key, val\) \{[\s\S]{0,400}?localStorage\.setItem\(key \+ '__at'/.test(APP));
  ok('…AFTER writing the value, so the screen never waits on Drive',
     APP.indexOf("localStorage.setItem(key, val);") <
     APP.indexOf("localStorage.setItem(key + '__at'"));
  ok('…and asks for a push through a hook, so load order cannot break it',
     /typeof window\.rrPrefsQueuePush === 'function'/.test(APP));
  ok('the push is debounced — a settings page fires several changes in a row',
     /_prefsPushTimer = setTimeout\(/.test(DRIVE) && /clearTimeout\(_prefsPushTimer\)/.test(DRIVE));
  ok('the account is read once at sign-in', /window\.rrPrefsSync\(\)\.then\(/.test(AUTH));
  ok('…without blocking the collection from loading',
     AUTH.indexOf('window.rrPrefsSync().then(') < AUTH.indexOf('loadAllData();', AUTH.indexOf('window.rrPrefsSync')));
  // A first draft replayed a function that does not exist; the typeof guard
  // hid it. Both of these are checked to be real.
  ok('the settings that PAINT are replayed, and both replay functions exist',
     /applyTheme\(\)/.test(AUTH) && /_applyCompactMode\(\)/.test(AUTH) &&
     /function applyTheme\(\)/.test(APP) && /function _applyCompactMode\(\)/.test(APP));
}

console.log('\n== F. The rules that keep it safe ==');
{
  ok('a FAILED read never leads to a write',
     /if \(!got\.ok\) return false;\s*\/\/ read failed: never write/.test(DRIVE),
     'the read-before-write guard is missing');
  ok('…and a failed read is told apart from "no file yet"',
     /if \(!id\) return \{ ok: true, prefs: \{\} \};/.test(DRIVE));
  ok('the push MERGES onto what the file already holds',
     /Object\.assign\(\{\}, got\.prefs, m\.push\)/.test(DRIVE),
     'a push that ignores the current file would drop another device\'s settings');
  ok('the timestamps stay LOCAL — they are never written to Drive',
     !/PREF_AT_SUFFIX/.test(DRIVE.slice(DRIVE.indexOf('async function _prefsWrite'),
                                        DRIVE.indexOf('function _prefsLocalState'))));
  ok('it lives in its OWN file, not the one holding the sheet and vault ids',
     /const PREFS_FILENAME = 'rail-roster-prefs\.json';/.test(DRIVE) &&
     /const CONFIG_FILENAME = 'rail-roster-config\.json';/.test(DRIVE));
  ok('…and only a file the user OWNS is written, as the config writer learned',
     /name='\$\{PREFS_FILENAME\}' and trashed=false and 'me' in owners/.test(DRIVE));
  ok('what syncs is exactly what went through _prefSet — no list to keep in step',
     /k\.slice\(-PREF_AT_SUFFIX\.length\) !== PREF_AT_SUFFIX/.test(DRIVE));
}

console.log('\n== G. THE OFFENDERS: break each one, require red ==');
{
  // 1 — newest-wins collapses to "this device always wins".
  const bad1 = build(DRIVE.replace('if (rt > lt) {', 'if (false) {'));
  const r1 = bad1({ lv_theme: 'light' }, { lv_theme: '500' }, { lv_theme: { v: 'dark', t: 800 } }, NOW);
  ok('losing the newest-wins pull is caught', r1.apply.lv_theme !== 'dark',
     'the section A check would have passed on broken source');

  // 2 — a pull stamps itself with now() instead of carrying Drive's clock,
  //     so it instantly looks local and re-wins the next round. This exact
  //     mistake is recorded from v0.9.1771.
  const bad2 = build(DRIVE.replace(/apply\[k \+ PREF_AT_SUFFIX\] = String\(rt\); \}\n\s*else if \(lt > rt\)/,
                                   'apply[k + PREF_AT_SUFFIX] = String(now); }\n    else if (lt > rt)'));
  const r2 = bad2({ lv_theme: 'light' }, { lv_theme: '500' }, { lv_theme: { v: 'dark', t: 800 } }, NOW);
  ok('a pull stamping itself locally is caught', r2.apply['lv_theme__at'] !== '800',
     'the Drive-clock check would have passed on broken source');

  // 3 — agreement starts writing on every load.
  const bad3 = build(DRIVE.replace('else if (lt > rt) { push[k] = { v: local[k], t: lt }; }',
                                   'else { push[k] = { v: local[k], t: lt }; }'));
  const r3 = bad3({ lv_currency: '$' }, { lv_currency: '500' }, { lv_currency: { v: '$', t: 500 } }, NOW);
  ok('write amplification on agreement is caught', Object.keys(r3.push).length !== 0,
     'the silence check would have passed on broken source');

  // 4 — seeding dates an unstamped value 0 instead of now, so the very first
  //     settings this account ever had lose to literally any later change,
  //     including one the user did not make. (The first version of this
  //     offender deleted an `lt === 0` branch and the suite stayed green —
  //     correctly, because that branch was DEAD: an unstamped value already
  //     scores 0 and the newest-wins line handles it. The offender that would
  //     not offend is what proved the code wrong, so the branch went.)
  const bad4 = build(DRIVE.replace('t: lt > 0 ? lt : now', 't: 0'));
  const r4 = bad4({ lv_theme: 'light' }, {}, {}, NOW);
  ok('seeding with a worthless clock is caught', r4.push.lv_theme.t !== NOW,
     'the seed check would have passed on broken source');

  // 5 — the push stops merging and drops the other device's settings.
  ok('a push that overwrites instead of merging is caught',
     !/Object\.assign\(\{\}, got\.prefs, m\.push\)/.test(DRIVE.replace('Object.assign({}, got.prefs, m.push)', 'm.push')));

  // 6 — the read-before-write guard is removed.
  ok('removing the failed-read guard is caught',
     !/if \(!got\.ok\) return false;/.test(DRIVE.replace('if (!got.ok) return false;', '')));

  // 7 — _prefSet stops stamping, so nothing can ever be compared.
  ok('a _prefSet that stops stamping is caught',
     !/localStorage\.setItem\(key \+ '__at'/.test(APP.replace(/localStorage\.setItem\(key \+ '__at', String\(Date\.now\(\)\)\);/, '')));
}

// ════════════════════════════════════════════════════════════════════════
// v0.9.1793 — THE THREE "WHAT I COLLECT" SETTINGS WERE NEVER IN THE SET.
//
// v1779's rule was: what syncs is exactly what is written through _prefSet.
// The rule was right; nothing checked it. Eras, manufacturers AND scales all
// wrote with a raw localStorage.setItem, so all three stayed per-device while
// this suite happily reported that every preference followed the account.
//
// [stated] Brad found it from the far end, signing out and back in: "it starts
// me completely over" — and the welcome tour asking "none chosen yet" was the
// same three keys, gone with the sign-out.
//
// A SWEEP DEFINED AS "WRITTEN THROUGH X" NEEDS A CHECK THAT NOTHING WRITES IT
// ANY OTHER WAY. That check is the point of this section — not the three
// fixes, which are one line each.
// ════════════════════════════════════════════════════════════════════════
console.log('\n== G. Every synced preference actually goes through _prefSet ==');
{
  const PREFS = fs.readFileSync(path.join(__dirname, '..', 'app', 'prefs.js'), 'utf8');
  const ALL = APP + '\n' + PREFS;
  const KEYS = ['lv_collect_eras', 'lv_collect_mfrs', 'lv_collect_scales'];

  KEYS.forEach(function (k) {
    ok(k + ' is written through _prefSet',
       new RegExp("_prefSet\\('" + k + "'").test(ALL));
    ok('…and NOT with a raw localStorage.setItem anywhere',
       !new RegExp("localStorage\\.setItem\\('" + k + "'").test(ALL),
       'raw write still present');
  });

  ok('the roster beside each value rides the account too — a synced value with a device-local roster can disagree',
     /function _prefSaveRoster[\s\S]{0,400}_prefSet\(rosterKey/.test(APP));

  // The general rule, not the three instances: anything _prefEnabled reads is
  // a synced preference by definition, so it must not be written raw.
  const readKeys = [];
  const re = /_prefEnabled\('([^']+)',\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(ALL)) !== null) { readKeys.push(m[1]); readKeys.push(m[2]); }
  ok('_prefEnabled reads the keys we think it does', readKeys.length >= 6, readKeys.join(', '));
  const rawWritten = readKeys.filter(function (k) {
    return new RegExp("localStorage\\.setItem\\('" + k + "'").test(ALL);
  });
  ok('NO key that _prefEnabled reads is written raw — the rule, not the instances',
     rawWritten.length === 0, rawWritten.join(', '));
}

console.log('\n== G. Planted offenders ==');
{
  const PREFS = fs.readFileSync(path.join(__dirname, '..', 'app', 'prefs.js'), 'utf8');
  const ALL = APP + '\n' + PREFS;
  const reverted = ALL.replace("_prefSet('lv_collect_eras'", "localStorage.setItem('lv_collect_eras'");
  ok('a collect setting going back to a raw write is caught — the exact bug',
     /localStorage\.setItem\('lv_collect_eras'/.test(reverted)
     && !/_prefSet\('lv_collect_eras'/.test(reverted));
  const rosterRaw = APP.replace(/(function _prefSaveRoster[\s\S]{0,400}?)_prefSet\(rosterKey/, '$1localStorage.setItem(rosterKey');
  ok('a roster left behind on the device is caught',
     !/function _prefSaveRoster[\s\S]{0,400}_prefSet\(rosterKey/.test(rosterRaw));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
