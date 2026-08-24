// ── v0.9.1419 — the number-vs-photo conflict check (Cooper's Big Boy) ─────
//
// Cooper: "photo reader said jlc bigboy, which is correct. however it said it
// was an southern enigine. two numbers different engines."
//
// The reader described a Union Pacific 4-8-8-4 Big Boy, attached 6-11122 from
// its own memory, and 6-11122 in the catalog is a Southern 0-8-0. The app
// treated "the number exists in the catalog" as "the number is right" and
// showed the two contradicting halves side by side without comparing them.
//
// Three things under test:
//   1. _pinAiRowConflict — run for REAL, extracted from the source, against
//      Cooper's exact case and the false-alarm traps (abbreviations, catalog
//      numbers that look like wheel arrangements, agreeing roads).
//   2. The reconciler no longer settles a number on existence alone.
//   3. The card warns, offers the description-matched alternative (Brad's
//      idea), and the number arrives as a tappable guess, never a pre-fill.
//
// Structural assertions are drilled: the pre-fix shape is reconstructed and
// must FAIL the same check, or the check is decoration.

const fs   = require('fs');
const path = require('path');

const APP = n => path.join(__dirname, '..', 'app', n);
const INBOX = fs.readFileSync(APP('photo-inbox.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function drilled(name, fixed, broken) {
  ok(name, fixed);
  ok('  ↳ pre-fix code fails this (drill)', !broken,
     broken ? 'the old code passed too — this assertion has no teeth' : '');
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ══ 1. The conflict detector, run for real ═════════════════════════════════
section('_pinAiRowConflict — Cooper’s case and the traps around it');

const fnSrc = (() => {
  const a = INBOX.indexOf('function _pinAiRowConflict(ai, aiText, row)');
  if (a < 0) throw new Error('_pinAiRowConflict not found');
  const b = INBOX.indexOf('\n  function _pinLookup', a);
  return INBOX.slice(a, b);
})();
const conflict = new Function(fnSrc + '; return _pinAiRowConflict;')();

// Cooper's exact case, from his screenshot.
const bigBoyAi = {
  roadName: 'Union Pacific',
  description: 'Lionel Union Pacific LEGACY Scale 4-8-8-4 Big Boy #4024',
  subType: 'Engine',
};
const southernRow = {
  roadName: 'Southern',
  description: 'Southern 0-8-0 Locomotive "6535," TrainSounds',
  itemType: 'Steam Engine',
};
const cooper = conflict(bigBoyAi, 'Union Pacific 4-8-8-4 Big Boy with Legacy (2007) — No. 6-11122', southernRow);
ok("COOPER'S BUG: Big Boy vs Southern 0-8-0 IS a conflict", !!cooper, JSON.stringify(cooper));
ok('...and the reason names both wheel arrangements',
   /4-8-8-4/.test(cooper) && /0-8-0/.test(cooper), cooper);

// Road-name conflict with no wheels anywhere.
const roadOnly = conflict({ roadName: 'Union Pacific', description: 'Big Boy diesel' }, '',
                          { roadName: 'Southern', description: 'Locomotive TrainSounds', itemType: 'Steam Engine' });
ok('different railroads with no wheel info still conflict', !!roadOnly, JSON.stringify(roadOnly));

// The false-alarm traps — each of these MUST stay silent.
ok('same road, same engine → no quarrel',
   conflict(bigBoyAi, '', { roadName: 'Union Pacific', description: '4-8-8-4 Big Boy JLC', itemType: 'Steam Engine' }) === '');
ok('"New York Central" vs catalog "NYC" is the SAME railroad (initials guard)',
   conflict({ roadName: 'New York Central', description: 'Hudson' }, '',
            { roadName: 'NYC', description: 'Hudson J-1e', itemType: 'Steam Engine' }) === '');
ok('catalog "New York Central" vs photo "NYC" agrees the other way too',
   conflict({ roadName: 'NYC', description: 'Hudson' }, '',
            { roadName: 'New York Central', description: 'Hudson', itemType: 'Steam Engine' }) === '');
ok('a catalog number like 6464-275 is never read as a wheel arrangement',
   conflict({ roadName: 'State of Maine', description: 'Boxcar 6464-275' }, '',
            { roadName: 'State of Maine', description: 'Boxcar', itemType: 'Boxcar' }) === '');
ok('road named on one side only → no quarrel (nothing to compare)',
   conflict({ roadName: '', description: 'Big Boy' }, '',
            { roadName: 'Southern', description: 'Locomotive', itemType: 'Steam Engine' }) === '');
ok('empty row → no quarrel', conflict(bigBoyAi, 'text', null) === '');
// The road appearing in the other side's DESCRIPTION counts as agreement —
// reissues often carry the road in the text but not the road column.
ok('road found in the other side’s description text → no quarrel',
   conflict({ roadName: 'Union Pacific', description: 'Big Boy' }, '',
            { roadName: 'UP', description: 'Union Pacific 4-8-8-4 Big Boy', itemType: 'Steam Engine' }) === '');
// Wheels win before roads: same road, different machine is still a conflict.
ok('same railroad but different wheel arrangement IS a conflict',
   /4-8-8-4/.test(conflict({ roadName: 'Union Pacific', description: '4-8-8-4 Big Boy' }, '',
            { roadName: 'Union Pacific', description: '0-8-0 switcher', itemType: 'Steam Engine' })));

// ══ 2. The reconciler doubts existence ═════════════════════════════════════
section('Reconciler — "in the catalog" is no longer "the right item"');

const rec = INBOX.slice(INBOX.indexOf('function _pinReconcileAiNum'),
                        INBOX.indexOf('function _pinReconcileAiNum') + 4000);
drilled('the settled-number early return now runs the conflict check first',
        /if \(out\.num && inEra\(out\.num\)\) \{[\s\S]{0,900}_pinAiRowConflict/.test(rec),
        /if \(out\.num && inEra\(out\.num\)\) return out;/.test(rec));
ok('on conflict, the reader’s words get their turn via the SAME _pinDescMatch',
   /out\.conflict = _setCf;[\s\S]{0,600}_pinDescMatch\(/.test(rec));
ok('a words-found swap is FLAGGED (viaDesc), never silent',
   /dmCf\.row\.itemNum[\s\S]{0,400}out\.viaDesc = \(dmCf\.words \|\| \[\]\)\.join/.test(rec));
ok('...and only a candidate that does NOT itself conflict may swap in',
   /String\(dmCf\.row\.itemNum\) !== out\.num\s*\n\s*&& !_pinAiRowConflict\(meta, aiText \|\| '', dmCf\.row\)/.test(rec));
ok('no candidate → the number stays but carries the conflict out',
   /out\.conflict = _setCf;/.test(rec) && /return out;\s*\n\s*\}\s*\n\n?\s*\/\/ Candidates/.test(rec));

// ══ 3. The stored read is hedged, so the card offers instead of filling ════
section('_pinApplyMeta — a contradicted number is a guess again');

const apply = INBOX.slice(INBOX.indexOf('function _pinApplyMeta'),
                          INBOX.indexOf('function _pinApplyMeta') + 3500);
drilled('a conflicted, unswapped number is hedged',
        /_rc0 && _rc0\.conflict && _rc0\.num === meta\.itemNum[\s\S]{0,120}meta\._hedge = 1;/.test(apply),
        // pre-fix: no conflict handling existed in apply at all
        !/_rc0\.conflict/.test(apply));
// Session 85: the ternary was reformatted onto its own line when the
// prev-guess fallback arrived — same feed, new line breaks.
ok('...and the hedge is what feeds the stored guess flag',
   /guess:[\s\S]{0,120}?meta\.itemNum \? \(meta\._hedge \? 1 : 0\)/.test(INBOX));

// ══ 4. The card — warn, then offer what actually matches ═══════════════════
section('Review card — the two halves are finally compared');

const card = INBOX.slice(INBOX.indexOf('window._pinReviewLookup = function'),
                         INBOX.indexOf('window._pinReviewLookup = function') + 6000);
drilled('the resolved-row branch runs the conflict check against the read',
        /lk\.master\)[\s\S]{0,1600}_pinAiRowConflict\(_cfAi, _rvAiRec\.aiRaw \|\| '', lk\.master\)/.test(card),
        // pre-fix: the lk.master branch had no conflict check at all
        false);
ok('a conflict paints a warning that says the number may be wrong',
   /This number may be wrong/.test(card));
ok('the catalog is searched BY THE READER’S WORDS (Brad’s idea) for the offer',
   /_pinDescMatch\(_rvAiRec\.aiRaw \|\| _rvAiRec\.desc \|\| '', _rvPrefer\(\)\)/.test(card));
ok('the matching entry is offered as a tap through the normal pick path',
   /This catalog entry DOES match the photo/.test(card) && /_pinPickNum\(/.test(card));
ok('an offered candidate must not itself conflict with the photo',
   /!_pinAiRowConflict\(_cfAi, _rvAiRec\.aiRaw \|\| '', _dm\.row\)/.test(card));
ok('no match → honesty, pointing at the printed number',
   /Nothing in the catalog matches the photo/.test(card));

// The record the card reads must follow the photo on screen.
ok('the full read record is stashed when the card opens',
   /_rvAiRec = s0 \|\| null;/.test(INBOX));
ok('...and re-stashed when the review steps to another photo',
   /_rvAiRec = _e \|\| null;/.test(INBOX));
ok('...and cleared with the maker hint when the card rebuilds',
   /_rvAiMfr = '';\s*\n\s*_rvAiRec = null;/.test(INBOX));

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
