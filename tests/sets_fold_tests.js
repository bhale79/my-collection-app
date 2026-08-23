// ═══════════════════════════════════════════════════════════════
// sets_fold_tests.js — Session 84. SETS AUDIT steps 4+5.
//
// Brad's spec (SETS_AUDIT_2026-08-23.md, verbatim intent):
//   "when i add a set of 3 engines that are grouped, it should show just
//    the 1 row and the detail page should show the set picture … there
//    shouldn't be multiple rows like the one i tried to delete and it
//    deleted both."
//
// His four recorded decisions (do not relitigate):
//   · Folded group row's Worth = SUM of the members' Est. Worth
//   · Search un-folds — a member's number finds the member's own row
//   · Bulk tag: ticking a folded group row tags ALL pieces
//   · Delete-dialog secondary action = Break Up Group (confirmed S84)
//
// ★ His counting law (v0.9.1567, verbatim, display-independent):
//   "every item counts as one, if there are 3 items in a group, that
//    counts as 3. not 1 or 4."  The fold must NEVER change counts.
//
// Run:  node tests/sets_fold_tests.js
// Proven to FAIL on v0.9.1568 (no _grpFoldInfo, three-choice delete
// modal, companions hidden even under search) before the fix was built.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const P = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const browse = P('browse.js'), coll = P('app-collection.js'),
      tag = P('bulk-tag.js'), dash = P('dashboard.js'), appjs = P('app.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── extract a named function from source by brace counting ─────
function extract(src, name) {
  var at = src.indexOf('function ' + name + '(');
  if (at < 0) return null;
  var i = src.indexOf('{', at), depth = 0;
  for (var j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  return null;
}

// ── fixture: Brad's real 2356 ABA set, plus friends ────────────
function fixtureState() {
  return { personalData: {
    // the ABA set (GRP- engine group) — worths 100 + 50 + 40
    '278': { owned: true, itemNum: '2356-P',  variation: '1', groupId: 'GRP-2356-46257', inventoryId: '278', userEstWorth: '100', condition: '7', row: 221 },
    '279': { owned: true, itemNum: '2356C',   variation: '1', groupId: 'GRP-2356-46257', inventoryId: '279', userEstWorth: '50',  condition: '7', row: 222 },
    '280': { owned: true, itemNum: '2356T-D', variation: '1', groupId: 'GRP-2356-46257', inventoryId: '280', userEstWorth: '40',  row: 223 },
    // a grouped box — an accessory, not a piece
    '281': { owned: true, itemNum: '2356-BOX', variation: '', groupId: 'GRP-2356-46257', inventoryId: '281', row: 224 },
    // engine + tender pair
    '300': { owned: true, itemNum: '2025',    variation: '',  groupId: 'GRP-2025-40000', inventoryId: '300', userEstWorth: '80', row: 230 },
    '301': { owned: true, itemNum: '6466WX',  variation: '',  groupId: 'GRP-2025-40000', inventoryId: '301', row: 231 },
    // a group whose second member has NO recognizable suffix — the
    // safety-net case the suffix fold can never catch
    '400': { owned: true, itemNum: '2379',    variation: '',  groupId: 'GRP-2379-41000', inventoryId: '400', userEstWorth: '60', row: 240 },
    '401': { owned: true, itemNum: '2383',    variation: '',  groupId: 'GRP-2379-41000', inventoryId: '401', userEstWorth: '70', row: 241 },
    // an ungrouped single
    '500': { owned: true, itemNum: '6464-125', variation: '', groupId: '', inventoryId: '500', row: 250 },
  } };
}

// ── build the sandbox: real functions, stubbed surroundings ────
const srcFoldInfo   = extract(browse, '_grpFoldInfo');
const srcFoldActive = extract(browse, '_grpFoldActive');
const srcCompanion  = extract(browse, '_isGroupCompanionSfx');
ok('_grpFoldInfo exists in browse.js (ONE place computes a group\'s pieces/lead/worth)', !!srcFoldInfo);
ok('_grpFoldActive exists (owned view, no search, no column sort)', !!srcFoldActive);

let G = null;
if (srcFoldInfo && srcFoldActive && srcCompanion) {
  const cfgAt = appjs.indexOf('window.groupConfigLabel = function');
  const cfgEnd = appjs.indexOf('\n};', cfgAt);
  const srcCfg = appjs.slice(cfgAt, cfgEnd + 3);
  const sandboxSrc = srcCompanion + '\n' + srcFoldInfo + '\n' + srcFoldActive + '\n' + srcCfg
    + '\nreturn { info: _grpFoldInfo, active: _grpFoldActive };';
  G = new Function('state', 'window', 'isTender',
    'var groupConfigLabel;\n' + sandboxSrc.replace('window.groupConfigLabel = function', 'groupConfigLabel = function'))(
      fixtureState(), {}, function (n) { return /^6466|^2466|^6026/.test(String(n)); });
}

if (G) {
  const st = fixtureState();
  // Rebuild with the live fixture bound in (the Function above closed over its own copy)
  const infoOf = function (key) {
    const sandboxSrc = srcCompanion + '\n' + srcFoldInfo + '\n'
      + appjs.slice(appjs.indexOf('window.groupConfigLabel = function'), appjs.indexOf('\n};', appjs.indexOf('window.groupConfigLabel = function')) + 3)
        .replace('window.groupConfigLabel = function', 'var groupConfigLabel = function')
      + '\nreturn _grpFoldInfo(state.personalData[key]);';
    return new Function('state', 'key', 'window', 'isTender', sandboxSrc)(
      st, key, {}, function (n) { return /^6466|^2466|^6026/.test(String(n)); });
  };

  // ── step 4: the fold helper, driven with real data ───────────
  const aba = infoOf('278');
  ok('ABA set: 3 pieces (the box is an accessory, not a piece)', aba && aba.count === 3, aba && aba.count);
  ok('ABA set: lead is the powered unit', aba && aba.lead && aba.lead.itemNum === '2356-P', aba && aba.lead && aba.lead.itemNum);
  ok('ABA set: badge says the config AND the piece count', aba && /ABA SET · 3 pieces/.test(aba.label), aba && aba.label);
  ok('ABA set: Worth is the SUM of the pieces — Brad\'s decision', aba && aba.worthSum === 190, aba && aba.worthSum);
  ok('asking via a COMPANION returns the same group (same lead)', (function(){ const c = infoOf('279'); return c && c.lead && c.lead.itemNum === '2356-P'; })());
  const et = infoOf('300');
  ok('engine+tender: 2 pieces, engine leads', et && et.count === 2 && et.lead.itemNum === '2025', et && et.label);
  const net = infoOf('400');
  ok('safety net: a suffix-less member still makes ONE group of 2', net && net.count === 2, net && net.count);
  ok('safety net: lead is deterministic (lowest inventoryId wins when no suffix decides)', net && net.lead.itemNum === '2379', net && net.lead.itemNum);
  ok('an ungrouped single returns null (no badge, no sum)', infoOf('500') === null);
  ok('a partial worth still sums what exists (missing tender worth ≠ NaN)', et && et.worthSum === 80, et && et.worthSum);

  // ── ★ the counting law — display-independent, forever ────────
  const srcONB = extract(dash, '_ownedNonBox');
  ok('_ownedNonBox never consults the fold (counting law is structural)',
     srcONB && !/_grpFold/.test(srcONB) && !/_isCollectionCompanion/.test(srcONB));
  if (srcONB) {
    const count = new Function('state', srcONB + '\nreturn _ownedNonBox(state).length;')(st);
    ok('every piece counts: fixture counts 8 items (3 ABA + 2 E+T + 2 net + 1 single; boxes excluded)',
       count === 8, count);
  }
}

// ── step 4: the renderer honors the fold ───────────────────────
ok('the list row badge is built from _grpFoldInfo (piece count shown)',
   /_grpFoldInfo\(pd\)/.test(browse) && /_gi\.label/.test(browse));
ok('the folded row\'s Worth cell shows the SUM, and says so',
   /worthSum/.test(browse) && /Sum of/.test(browse));
ok('search/sort UN-fold: the companion filter defers to _grpFoldActive',
   /_grpFoldActive\(\)[\s\S]{0,240}_isCollectionCompanion/.test(browse) ||
   /_isCollectionCompanion[\s\S]{0,240}_grpFoldActive\(\)/.test(browse));
ok('grouped boxes stay folded even under search (accessories, not members)',
   /-\(BOX\|MBOX\|IS\)\$\/i[\s\S]{0,400}_grpFoldActive|_boxish/.test(browse));
ok('the fold block catches leftover GRP- rows (no group can ever draw two rows)',
   /GRP-/.test(browse.slice(browse.indexOf('SETS fold into one expandable row'), browse.indexOf('SETS fold into one expandable row') + 4000)));

// ── step 4: bulk tag hits all pieces ───────────────────────────
ok('rrTagApply expands a folded lead to ALL its pieces — Brad\'s decision',
   /rrTagApply[\s\S]{0,2500}_grpFoldInfo/.test(tag));
ok('...but ONLY while the fold is active (searching = tick means that row)',
   /rrTagApply[\s\S]{0,2500}_grpFoldActive/.test(tag));

// ── step 5: ONE honest delete confirm ──────────────────────────
ok('removeCollectionItem takes a scope, so member cards can remove one piece',
   /function removeCollectionItem\(itemNum, variation, row, invId, opts\)/.test(coll));
ok('scope "piece" skips the group dialog and confirms just that piece',
   /opts && opts\.scope === 'piece'/.test(coll));
ok('the old "Remove {item} only" list-level button is GONE',
   !/rm-just-one/.test(coll));
ok('the dialog names EVERY row it will take, with the count',
   /rm-all-group/.test(coll) && /ALL \$\{groupSiblings\.length\}/.test(coll));
ok('Cancel leads — the first button is the safe one (v1564\'s lesson, kept)',
   (function(){ const d = coll.indexOf('rm-cancel'), b = coll.indexOf('rm-breakup'), a = coll.indexOf('rm-all-group');
     return d > -1 && b > -1 && a > -1 && d < b && b < a; })());
ok('Break Up Group is the secondary choice (Brad, S84: confirmed)',
   /rm-breakup/.test(coll) && /_breakUpGroup\(/.test(coll));
ok('remove-all on a SET- group also removes the My Sets wrapper',
   /\^SET-\/i\.test\(String\(groupId\)\)[\s\S]{0,900}'My Sets'/.test(coll));
ok('...via the confirmed-write helper, never a blind delete',
   /removeCollectionItem[\s\S]*rrRemoveRowConfirmed\(state\.personalSheetId, 'My Sets'/.test(coll));
ok('a GRP- engine group never touches My Sets (guard is SET- only)',
   /\^SET-\/i\.test\(String\(groupId\)\)/.test(coll));

// ── step 5: per-piece removal lives on the member cards ────────
ok('member cards carry a Remove button', /_grpRemoveMember\(/.test(coll));
ok('...which removes THAT piece only (scope piece)',
   /_grpRemoveMember[\s\S]{0,900}scope: 'piece'/.test(coll));
ok('...and leaves the page sensibly after (back to list if the page\'s own item went)',
   /_grpRemoveMember[\s\S]{0,1400}(_detailBackToBrowse|showItemDetailPage)/.test(coll));

console.log('');
if (fail) { console.log(fail + ' FAILED, ' + pass + ' passed'); process.exit(1); }
console.log('ALL SETS-FOLD TESTS GREEN (' + pass + ')');
