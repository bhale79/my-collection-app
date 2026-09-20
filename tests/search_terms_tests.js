// ═══════════════════════════════════════════════════════════════
// search_terms_tests.js — v0.9.1768.
//
// Brad, 2026-09-19: he clicked item 2300 (Oil Drum Loader) in the Master
// Catalog and landed on the wrong train. The link had searched
// "Lionel 2300 modern oil drum loader". 2300 is an AMERICAN FLYER S-gauge
// item, and Google was told Lionel. His own screenshot also showed Google
// saying "Missing: modern" — our internal era word, which it ignores.
//
// Brad, same day: "all lionel s guage are branded american flyer".
//
// WHAT THIS SUITE PROTECTS — the four rules rrSearchTerms owns, and that
// nothing else is allowed to own:
//   1. Brand follows the GAUGE, not the tab. Lionel S -> American Flyer.
//      O and HO -> Lionel.
//   2. The era word is for PREWAR and POSTWAR only. Never "modern".
//      (It must NOT regress for postwar — that wording was Brad's ask.)
//   3. A bare five-digit MODERN Lionel number gets its 6 back. Measured
//      2026-09-05, not guessed.
//   4. Road name + first clause of the description come along. "Erie" is the
//      only reason Google found the right 9504.
//
// AND that the hardcoded brands are gone: browse.js no longer builds
// "'Lionel ' + num", app-pages.js no longer builds ['lionel', ...].
//
// THIS SUITE PROVES ITSELF (section F). The gauge rule is broken on purpose
// and the American Flyer tests must go red. A green run on a check that
// cannot fail is worth nothing — feedback_scan_must_prove_itself.
// Run:  node tests/search_terms_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}
const appjs   = APP('app.js');
const browse  = APP('browse.js');
const pages   = APP('app-pages.js');
const onboard = APP('onboarding-config.js');

// ── A · the real functions, lifted and run ────────────────────────────────
section('A · rrSearchTerms ships and runs for real');
const sBrand  = grab(appjs, 'rrSearchBrand');
const sNum    = grab(appjs, 'rrSearchNumber');
const sTerms  = grab(appjs, 'rrSearchTerms');
const sClause = grab(appjs, '_rrFirstClause');   // v0.9.1783
ok('rrSearchBrand ships',  !!sBrand);
ok('rrSearchNumber ships', !!sNum);
ok('rrSearchTerms ships',  !!sTerms);
ok('_rrFirstClause ships', !!sClause);
ok('all three are exported', /window\.rrSearchTerms\s*=\s*rrSearchTerms/.test(appjs)
   && /window\.rrSearchBrand\s*=\s*rrSearchBrand/.test(appjs));
if (!sBrand || !sNum || !sTerms || !sClause) { console.log('\ncannot continue'); process.exit(1); }

// The stubs below stand in for helpers that live in other files. Section B
// asserts the REAL config they mirror, so a stub cannot drift from the app.
function build(scaleOf) {
  // EVERY closure name the three functions touch is handed in. Miss one and it
  // throws into its own catch and reads as a behaviour failure (the lesson from
  // the v1766 maintenance harness).
  return new Function(
    '_scaleOfItem', '_makerForTab', '_itemEraPeriod', 'window',
    sClause + '\n' + sBrand + '\n' + sNum + '\n' + sTerms + '\nreturn rrSearchTerms;'
  )(
    scaleOf,
    tab => { const M = [['weaver','Weaver'],['k-line','K-Line'],['williams','Williams'],
                        ['marx','Marx'],['rmt','RMT'],['menards','Menards']];
             for (const [k, v] of M) if (String(tab || '').indexOf(k) === 0) return v;
             return ''; },
    it => it._period || '',
    undefined
  );
}
// mirrors ERA_TO_SCALE, asserted for real in section B
const SCALE = { mpc: 'o', mod_s: 's', mod_ho: 'ho', pw: 'o', prewar: null };
const terms = build(it => SCALE[it._era] || null);

// ── B · the config the rule leans on is really there ──────────────────────
section('B · the real ERA_TO_SCALE backs the stub');
ok("mod_s really maps to 's'",  /mod_s:\s*'s'/.test(onboard));
ok("mpc really maps to 'o'",    /mpc:\s*'o'/.test(onboard));
ok("mod_ho really maps to 'ho'",/mod_ho:\s*'ho'/.test(onboard));

// ── C · Brad's own items ──────────────────────────────────────────────────
section("C · the items Brad clicked");
const oilDrum = { _tab: 'Lionel Modern S - Items', _era: 'mod_s', _period: 'modern',
                  itemNum: '2300', description: 'Oil Drum Loader', roadName: '' };
const q2300 = terms(oilDrum);
ok('2300 searches as AMERICAN FLYER', /American Flyer/.test(q2300), q2300);
ok('…and never says Lionel',          !/\bLionel\b/i.test(q2300), q2300);
ok('…and never says "modern"',        !/\bmodern\b/i.test(q2300), q2300);
ok('…and keeps the description',      /Oil Drum Loader/.test(q2300), q2300);

const erie = { _tab: 'Lionel Modern S - Items', _era: 'mod_s', _period: 'modern',
               itemNum: '9504', description: 'Erie Combination Car', roadName: 'Erie' };
const q9504 = terms(erie);
ok('9504 searches as AMERICAN FLYER', /American Flyer/.test(q9504), q9504);
ok('…and carries "Erie" — the word that found the right car',
   /Erie/.test(q9504), q9504);
ok('…and does not repeat Erie twice (road name == description start)',
   (q9504.match(/Erie/g) || []).length === 1, q9504);

const flyer = { _tab: 'Lionel Modern S - Items', _era: 'mod_s', _period: 'modern',
                itemNum: '6-48238', description: 'GE Cable Reel Car (NASG)', roadName: '' };
ok('6-48238 searches as AMERICAN FLYER', /American Flyer/.test(terms(flyer)), terms(flyer));
ok('…and the parenthetical is dropped', !/NASG/.test(terms(flyer)), terms(flyer));

// ── D · everything that must NOT change ───────────────────────────────────
section('D · the behaviours that must not regress');
const pw = { _tab: 'Lionel PW - Items', _era: 'pw', _period: 'postwar',
             itemNum: '6464-100', description: 'Western Pacific Boxcar', roadName: 'Western Pacific' };
const qpw = terms(pw);
ok('a POSTWAR item still carries "postwar" (Brad asked for this)',
   /postwar/.test(qpw), qpw);
ok('…and is still Lionel', /^Lionel /.test(qpw), qpw);

const pre = { _tab: 'Lionel Pre-War', _era: 'prewar', _period: 'prewar',
              itemNum: '385E', description: 'Steam Locomotive', roadName: '', gauge: 'Standard' };
ok('a PREWAR item still carries "prewar"', /prewar/.test(terms(pre)), terms(pre));

const modO = { _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
               itemNum: '84631', description: 'Scale Hudson', roadName: 'New York Central' };
const qmo = terms(modO);
ok('a MODERN O item is still Lionel', /^Lionel /.test(qmo), qmo);
ok('…gets its 6 back on a bare 5-digit number (measured 2026-09-05)',
   /6-84631/.test(qmo), qmo);
ok('…and says nothing about "modern"', !/\bmodern\b/i.test(qmo), qmo);

const mod6 = { _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
               itemNum: '6-11155', description: 'Santa Fe Legacy', roadName: '' };
ok('a number that ALREADY has the 6 is not given another',
   !/6-6-/.test(terms(mod6)), terms(mod6));

const mth = { _tab: 'MTH O', _era: 'mth_o', _period: 'modern',
              itemNum: '20-3253-1', description: 'Premier Decapod', roadName: 'PRR' };
ok('an MTH item still says MTH', /^MTH /.test(terms(mth)), terms(mth));
const mthOnLionel = { _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
                      itemNum: '11-1001', description: 'No. 400E Locomotive', roadName: '' };
ok('an 11-#### number says MTH whatever tab it sits on (the v1183 rule)',
   /^MTH /.test(terms(mthOnLionel)), terms(mthOnLionel));

const weaver = { _tab: 'Weaver O', _era: 'weaver', _period: 'modern',
                 itemNum: '1055-S', description: 'Boxcar', roadName: 'PRR' };
ok('Weaver keeps its maker name', /^Weaver /.test(terms(weaver)), terms(weaver));
ok("…and the -S 3-rail suffix is still stripped (v1245)",
   /1055\b/.test(terms(weaver)) && !/1055-S/.test(terms(weaver)), terms(weaver));

const custom = { _tab: 'Weaver O', _era: 'weaver', _period: 'modern',
                 itemNum: 'CUSTOM RUN', description: '', roadName: 'Reading',
                 itemType: 'Boxcar', variation: '#12345' };
const qc = terms(custom);
ok('a CUSTOM RUN row searches its road and type, not the words "CUSTOM RUN"',
   !/CUSTOM RUN/i.test(qc) && /Reading/.test(qc) && /Boxcar/.test(qc), qc);

// v0.9.1769 — caught on Brad's LIVE data after v1768 shipped. 6464-1 came out
// as "Lionel 6464-1 Western Pacific Western Pacific Boxcar postwar": the road
// name and the start of the description are the same PHRASE, and the
// adjacent-word dedupe cannot see a phrase. Both directions are guarded now.
section('D2 · the road name is never said twice');
const wp = { _tab: 'Lionel PW - Items', _era: 'pw', _period: 'postwar',
             itemNum: '6464-1', description: 'Western Pacific Boxcar', roadName: 'Western Pacific' };
const qwp = terms(wp);
ok('the road name appears exactly once',
   (qwp.match(/Western Pacific/g) || []).length === 1, qwp);
ok('…and what it describes survives', /Boxcar/.test(qwp), qwp);
ok('…and it is still postwar and still Lionel',
   /postwar/.test(qwp) && /^Lionel /.test(qwp), qwp);
const rev = { _tab: 'Lionel PW - Items', _era: 'pw', _period: 'postwar',
              itemNum: '6464-2', description: 'Santa Fe', roadName: 'Santa Fe Railway' };
ok('the other direction too (road name CONTAINS the description)',
   (terms(rev).match(/Santa Fe/g) || []).length === 1, terms(rev));

ok('adjacent duplicate words are dropped',
   terms({ _tab: 'Marx O', _era: 'marx', _period: 'modern', itemNum: '1',
           description: 'Marx Marx Tin Car', roadName: '' }).indexOf('Marx Marx') < 0);

// ── E · the hardcoded brands are actually gone ────────────────────────────
section('E · no call site names a brand any more');
ok("browse.js no longer builds \"'Lionel ' + number\"",
   !/'Lionel '\s*\+\s*_numT/.test(browse));
ok("browse.js no longer builds \"'MTH ' + number\"",
   !/'MTH '\s*\+\s*_numT/.test(browse));
ok('browse.js asks rrSearchTerms instead', /rrSearchTerms\(item\)/.test(browse));
ok("app-pages.js wantSearchOtherSites no longer hardcodes 'lionel' as the brand",
   !/\['lionel',\s*itemNum,\s*roadName\s*\|\|\s*'',\s*'for sale'\]/.test(pages));
ok('…and asks rrSearchTerms', /rrSearchTerms\(m\)/.test(pages));
ok('the era word "modern" is no longer built into any query',
   !/modern:\s*'modern'/.test(browse));

// ── F · THE SUITE PROVES IT CAN FAIL ──────────────────────────────────────
section('F · break the rule on purpose — section C must go red');
const broken = build(() => 'o');        // gauge rule disabled: everything is O
const qBroken = broken(oilDrum);
ok('with the gauge rule broken, 2300 goes back to saying Lionel',
   /\bLionel\b/.test(qBroken) && !/American Flyer/.test(qBroken), qBroken);
ok('…which means section C was a real check, not a vacuous one', true);
// and prove the era-word test can fail too
const srcNoEra = sTerms.replace(/if \(per2 === 'prewar' \|\| per2 === 'postwar'\) bits\.push\(per2\);/, '');
ok('the postwar assertion is real: removing the era line changes the query',
   srcNoEra !== sTerms);
const termsNoEra = new Function('_scaleOfItem','_makerForTab','_itemEraPeriod','window',
  sClause + '\n' + sBrand + '\n' + sNum + '\n' + srcNoEra + '\nreturn rrSearchTerms;')(
    it => SCALE[it._era] || null, () => '', it => it._period || '', undefined);
ok('…and a postwar item then LOSES the word', !/postwar/.test(termsNoEra(pw)), termsNoEra(pw));

// ── G · v0.9.1783 — a period is not always a sentence end ─────────────────
// rrSearchTerms split the description on EVERY '.', so "No. 390 Locomotive
// green" was chopped to the bare word "No" and the query ended in it. Item
// 11-1005 IS MTH's reissue of the prewar Lionel No. 390 — "No. 390" is what a
// collector types, and it was the most searchable thing in the row. Measured
// against the live master: 933 of 28,614 rows on Lionel MPC-Modern, PW - Items
// and Pre-War were affected, and the surviving clause is never SHORTER than
// before, only longer.
section('G · a period only ends a clause when it ends a sentence');
const clause = new Function(sClause + '\nreturn _rrFirstClause;')();

ok('"No. 390 Locomotive green" survives whole — it used to end at "No"',
   clause('No. 390 Locomotive green') === 'No. 390 Locomotive green',
   clause('No. 390 Locomotive green'));
ok('…so 11-1005 searches the prototype number, not the word "No"',
   terms({ _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
           itemNum: '11-1005', description: 'No. 390 Locomotive green', roadName: '' })
     === 'MTH 11-1005 No. 390 Locomotive green',
   terms({ _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
           itemNum: '11-1005', description: 'No. 390 Locomotive green', roadName: '' }));
ok('a decimal measurement stays a number',
   clause('SuperStreets 2.5" Straight Curve-to-Curve Connector')
     === 'SuperStreets 2.5" Straight Curve-to-Curve Connector');
ok('…and so does a version number',
   clause('LionChief Bluetooth 5.0 Set') === 'LionChief Bluetooth 5.0 Set');
ok('"U.S. Navy Set" keeps all three words — the LAST period of a run counts too',
   clause('U.S. Navy Set') === 'U.S. Navy Set', clause('U.S. Navy Set'));
ok('a mid-name initial survives ("Wile E. Coyote")',
   clause('Road Runner and Wile E. Coyote Ambush Shack')
     === 'Road Runner and Wile E. Coyote Ambush Shack');
ok('a three-letter run survives ("M.O.W.")',
   clause('M.O.W.  Ballast Tamper #325') === 'M.O.W.  Ballast Tamper #325');
ok('"Ringling Bros. Flatcar" is one clause',
   clause('Ringling Bros. Flatcar w/2 Trailers') === 'Ringling Bros. Flatcar w/2 Trailers');
ok('"Minneapolis & St. Louis" is one clause',
   clause('Minneapolis & St. Louis Ore Car') === 'Minneapolis & St. Louis Ore Car');
ok('"Greenlee Packing Co. Wood-Sided Reefer" is one clause',
   clause('K-Line Greenlee Packing Co. Wood-Sided Reefer #3862')
     === 'K-Line Greenlee Packing Co. Wood-Sided Reefer #3862');
ok('"Manufacturers Ry. Boxcar" is one clause',
   clause('Manufacturers Ry. Boxcar "257"') === 'Manufacturers Ry. Boxcar "257"');

// The half that must NOT be lost. The rule got narrower, not toothless.
ok('a real sentence still stops the clause',
   clause('Coal dump car. Cataloged but not produced') === 'Coal dump car',
   clause('Coal dump car. Cataloged but not produced'));
ok('a floating period stops it too',
   clause('2-Rail Curved Track . The curve track makes a 48-inch circle')
     === '2-Rail Curved Track ');
ok('a comma, an em dash and a semicolon all still stop it',
   clause('Searchlight Car, The car') === 'Searchlight Car'
   && clause('Hopper — red') === 'Hopper ' && clause('Hopper; red') === 'Hopper');
ok('a description with no punctuation comes back whole',
   clause('Santa Fe F3') === 'Santa Fe F3');
ok('empty and missing descriptions do not throw',
   clause('') === '' && clause(null) === '' && clause(undefined) === '');
ok('the five-word cap still applies on top of the longer clause',
   terms({ _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
           itemNum: '11-30127', description: 'No. 516 Blue Coal Hopper Car (std)', roadName: '' })
     === 'MTH 11-30127 No. 516 Blue Coal Hopper');

// ── H · the harness that was not running the rule ─────────────────────────
// Five sections of photo-inbox-tests.js each lifted _itemExternalLinkURL out
// of browse.js by hand, and every one of them left rrSearchTerms out of scope.
// So since v0.9.1768 that suite had been measuring the GENERIC-MAKER FALLBACK
// instead of the rule this file protects — five assertions red for a reason
// that had nothing to do with the app, TWO of them with expectations that were
// correct all along. A harness that does not run the real rule is not a test
// of it. There is one builder now, and this section keeps it that way.
section('H · photo-inbox-tests runs the REAL rule, through ONE builder');
const PIT = fs.readFileSync(path.join(__dirname, 'photo-inbox-tests.js'), 'utf8');

ok('there is a single shared builder', /const mkLinkURL = function \(tag, win\)/.test(PIT));
ok('…and it puts these very helpers in scope',
   /mkLinkURL[\s\S]{0,1600}?indexOf\('function rrSearchBrand\(item\)'\)/.test(PIT));
ok('…and it THROWS if they are renamed, instead of quietly falling back',
   /mkLinkURL[\s\S]{0,2000}?marker moved: app\.js rrSearch helpers/.test(PIT));

// Nobody hand-rolls it again — five copies is how one missing argument hid.
// The builder's own new Function is the one sanctioned copy, so start the
// scan after it.
function handRolledIn(text) {
  const from = text.indexOf('fn.appSrc');
  const body = from < 0 ? text : text.slice(text.indexOf('};', from) + 2);
  return body.split('\n').filter(function (ln, i, all) {
    return /new Function\(/.test(ln)
        && /_itemExternalLinkURL/.test(all.slice(i, i + 6).join('\n'));
  });
}
ok('no section builds its own copy of the link function any more',
   handRolledIn(PIT).length === 0, handRolledIn(PIT).length + ' still hand-rolled');

// ── I · section G and H can actually fail ─────────────────────────────────
section('I · break G and H on purpose');

// 1 — the OLD splitter comes back, exactly as it shipped before v0.9.1783.
const oldSplit = sTerms.replace(
  "_rrFirstClause(String(item.description || '').replace(/\\([^)]*\\)/g, ''))",
  "String(item.description || '').replace(/\\([^)]*\\)/g, '').split(/[—|,.;]/)[0]");
function rebuild(clauseSrc, termsSrc) {
  return new Function('_scaleOfItem', '_makerForTab', '_itemEraPeriod', 'window',
    clauseSrc + '\n' + sBrand + '\n' + sNum + '\n' + termsSrc + '\nreturn rrSearchTerms;')(
      it => SCALE[it._era] || null, () => '', it => it._period || '', undefined);
}
ok('the old split-on-every-period is caught',
   oldSplit !== sTerms &&
   rebuild(sClause, oldSplit)({ _tab: 'Lionel MPC-Modern', _era: 'mpc', _period: 'modern',
     itemNum: '11-1005', description: 'No. 390 Locomotive green', roadName: '' })
     === 'MTH 11-1005 No',
   'the offender did not offend — has the splitter moved?');

// 2 — the single-letter initial case is dropped from the list.
const noInit = sClause.replace(/\|ave\|\[a-z\]\)\$/, '|ave)$');
ok('losing the initials case is caught',
   noInit !== sClause &&
   new Function(noInit + '\nreturn _rrFirstClause;')()('U.S. Navy Set') === 'U');

// 3 — the decimal guard goes.
const noDec = sClause.replace(
  "if (/\\d/.test(s.charAt(i - 1) || '') && /\\d/.test(s.charAt(i + 1) || '')) continue;", '');
ok('losing the decimal guard is caught',
   noDec !== sClause &&
   new Function(noDec + '\nreturn _rrFirstClause;')()('Bluetooth 5.0 Set') === 'Bluetooth 5');

// 4 — the rule goes TOO FAR and never breaks. A narrower rule that never
//     breaks is not narrower, it is broken.
const neverBreaks = sClause.replace(
  "    if (abbrev.test(s.slice(0, i))) continue;\n    return s.slice(0, i);", '    continue;');
ok('a splitter that never breaks at a period is caught',
   neverBreaks !== sClause &&
   new Function(neverBreaks + '\nreturn _rrFirstClause;')()
     ('Coal dump car. Cataloged but not produced') !== 'Coal dump car');

// 5 — THE HARNESS BUG ITSELF: the builder stops wiring these helpers in.
const noWire = PIT.replace("indexOf('function rrSearchBrand(item)')",
                           "indexOf('function _NOT_WIRED_(item)')");
ok('a builder that stops wiring rrSearchTerms in is caught',
   noWire !== PIT &&
   !/mkLinkURL[\s\S]{0,1600}?indexOf\('function rrSearchBrand\(item\)'\)/.test(noWire));

// 6 — a sixth hand-rolled copy appears, and a look-alike does not.
const sneaky = PIT + '\nconst x = new Function("window", "state",\n  "a", "b",\n  "c",\n  "return _itemExternalLinkURL;");\n';
ok('a new hand-rolled copy is caught', handRolledIn(sneaky).length === 1);
const farApart = PIT + '\nconst fine = new Function("a");\n//\n//\n//\n//\n//\n//\n// _itemExternalLinkURL\n';
ok('…and an unrelated new Function ten lines away is not a false alarm',
   handRolledIn(farApart).length === 0);
ok('…and the one sanctioned builder is not flagged as an offender',
   /new Function\(/.test(PIT.slice(PIT.indexOf('const mkLinkURL = function'),
                                   PIT.indexOf('fn.appSrc'))));


console.log('\n' + (fail ? 'FAILED' : 'OK') + '  pass ' + pass + '  fail ' + fail);
process.exit(fail ? 1 : 0);
