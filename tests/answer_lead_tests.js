#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// ANSWER-LEAD TESTS — v0.9.1502 (Session 79)
// Brad: "google always names the item in the first or second sentence."
// Two REAL texts from 2026-08-18 that broke the pipeline:
//   • the Lens-page Ctrl+A dump whose shopping titles (9407, 63561, 6356,
//     "SANTA FE") leaked past the old slicer and blanked a clear 6473
//   • the paid reader's definitive 6473 answer
// Run from repo root:  node tests/answer_lead_tests.js   (exit 1 = regression)
// ═══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const wp = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-photos.js'), 'utf8');
const window = {};
eval(grab(wp, '_identifySanitize'));
eval(grab(wp, 'rrSliceAiOverview'));
eval(grab(wp, '_identifyEnumCandidates'));
eval(grab(wp, 'rrAnswerLeadNumber'));
eval(grab(wp, 'extractLionelNumber'));

let fails = 0;
function T(name, got, want) {
  const ok = got === want;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + got + (ok ? '' : '  (wanted ' + want + ')'));
  if (!ok) fails++;
}

const READER = String.raw`This image features a vintage Lionel No. 6473 Operating Horse Transport Car, also famously known to collectors as the "Rodeo Car". It is an authentic O gauge model train piece produced during the Lionel postwar era. Production History Manufacturing Years: This model was originally manufactured from 1962 to 1966, with a final single-year production re-release in 1969.`;
const LENS = String.raw`Skip to main content
Accessibility help
AI Mode
All
Visual matches
Feedback
AI Overview
This image features a vintage Lionel No. 6473 Operating Horse Transport Car, also famously known to collectors as the "Rodeo Car". It is an authentic O gauge model train piece produced during the Lionel postwar era.
Production History

Manufacturing Years: This model was originally manufactured from 1962 to 1966, with a final single-year production re-release in 1969.
Design Origin: It was designed as a direct modification of Lionel's standard 9-1/4 inch slotted cattle car body style.
Animated Feature: As the car rolls down the tracks, an internal mechanism causes the four plastic horse heads inside (two white and two brown) to dynamically bob in and out of the windows, creating a lively visual effect.

Collecting Variations & Market Value
Collectors categorize the 6473 based on body plastic shade and heat-stamped text color:

Body & Text Variants: It ranges from light yellow to dark yellow bodies, paired with either red or maroon graphics.
Coupler Variants: Early production runs (1962-1963) include dual operating magnetic knuckle couplers. Later models typically feature one operating coupler and one fixed solid coupler.
Current Value: Standard loose cars in good operating condition generally trade in the $17 to $35 range across online platforms like eBay. Pristine examples accompanied by their original box (marked "Rodeo Car") command a premium.

ebay.com
Lionel Post War O Scale Horse Transport 6473 Freight Car | eBay
youtube.com
Classic Lionel Trains: Postwar Freight: Operating Box Cars Part 2 - 1958 - 1969 - YouTube
facebook.com
Lionel #6473 vintage horse transport car with bobbing horses
ebay.com
Lionel No. 6473 O Gauge Yellow Horse Transport Car Fast Express - POSTWAR - | eBay
$20
ebay.com
LIONEL #6473 HORSE TRANSPORT CAR,GOOD SHAPE | eBay
In stock
trainshoppe.com
9408 Lionel Lines Bi-Level Circus Car (9) - All Aboard Train Shoppe
ebay.com
Lionel #6473 Vintage Horse Transport Car 62-69 O Gauge Bobbing Horses excellent
discover.hubpages.com
Collecting Lionel Trains - HubPages
tandem-associates.com
LIONEL TRAINS 6473 HORSE TRANSPORT CAR
facebook.com
Displaying post-war vintage Lionel O gauge trains
etsy.com
Vintage O Gauge Train Cars, Lionel Train Cars, Peacemaker Freight Services, Lionel Horse Car, Frisco Car, Rail Box Car, and Others - Etsy Denmark

Fandom
6473 Horse Transport Car | TM books and video Wiki | Fandom
The 6473 Horse Transport Car was produced by Lionel during the postwar era between 1962 to 1966. And in 1969 it was re released ag...
Tandem Associates
LIONEL TRAINS 6473 HORSE TRANSPORT CAR
LIONEL TRAINS 6473 HORSE TRANSPORT CAR. ... This Identification Guide for Lionel Electric Trains covers the "Post-war Era" only fr...
Lionel Trains Library
6473 Horse Transport Stock Car - All Aboard Train Shoppe / LTL
Product Description * Production: 1962 - 1966 & 1969. * History. The 6473 Horse Transport Car is also known as the Rodeo Car. A pa...

AI can make mistakes, so double-check responses

eBay
Lionel Post War O Scale Horse Transport 6473 Freight Car | eBay
Facebook
Lionel #6473 vintage horse transport car with bobbing horses
YouTube
Classic Lionel Trains: Postwar Freight: Operating Box Cars Part 2 - 1958 - 1969 - YouTube
eBay
Lionel No. 6473 O Gauge Yellow Horse Transport Car Fast Express - POSTWAR - | eBay
$20
All Aboard Train Shoppe
9408 Lionel Lines Bi-Level Circus Car (9) - All Aboard Train Shoppe
Trainz
Lionel 6-9407 O Gauge Union Pacific Stock Car #9407 - Trainz
All Aboard Train Shoppe
6434 Poultry Dispatch Stock Car ( 7++/OB ) - All Aboard Train Shoppe
East Main Trains
Lionel #63561 Yellow NYC New York Central Stock Car | East Main Trains
In stock
Lionel Trains
New York Central Bi-Level Stock Car #6356
$60
Invaluable.com
Sold at Auction: Four different variations of the Lionel postwar 6473 horse transport car
Out of stock
WorthPoint
Rare UNCATALOGUED 1967 Lionel Train Set O Gauge set SANTA FE - comp. & original | #3777107555
Trainz
Lionel Vintage O Assorted Freight Cars 1877, 3509, 6017, X2454, 6473 [ - Trainz
Craigslist
boston collectibles for sale "lionel trains" - craigslist
Check website for latest pricing and availability
Results are not personalized
Bowling Green, Kentucky
 - Based on your places (Work)
Update location
Help
Send feedback
Privacy
Terms
`;

// ── the Lens page dump ──────────────────────────────────────────────────
const sliced = rrSliceAiOverview(_identifySanitize(LENS));
T('lens slice: 6473 present', sliced.indexOf('6473') >= 0, true);
T('lens slice: 9407 gone', sliced.indexOf('9407') < 0, true);
T('lens slice: 63561 gone', sliced.indexOf('63561') < 0, true);
T('lens slice: 1877 gone', sliced.indexOf('1877') < 0, true);
T('lens slice: SANTA FE gone', !/santa fe/i.test(sliced), true);
T('lens slice: shopping enum cannot blank (fewer than 2 junk)', _identifyEnumCandidates(sliced).length < 2, true);
T('lens lead: 6473', rrAnswerLeadNumber(sliced), '6473');
T('lens extract: 6473', extractLionelNumber(sliced), '6473');

// ── the paid reader's answer ────────────────────────────────────────────
T('reader lead: 6473', rrAnswerLeadNumber(READER), '6473');
T('reader extract: 6473', extractLionelNumber(READER), '6473');

// ── hedged leads keep the v0.9.1490 pick-one behavior ───────────────────
const HEDGE = 'The locomotive appears to be a Lionel 2333, 2344, or 2354 F3 diesel. These share the same body.';
T('hedged lead: no pick', rrAnswerLeadNumber(HEDGE), '');
T('hedged enum: all three offered', _identifyEnumCandidates(HEDGE).length >= 3, true);
const HEDGE2 = 'This is likely a No. 6464 boxcar. Variations abound.';
T('softened lead ("likely"): no pick', rrAnswerLeadNumber(HEDGE2), '');

// ── a bare year never wins ──────────────────────────────────────────────
T('year is not an answer', rrAnswerLeadNumber('This set was made in 1962. It is a Lionel product.'), '');

console.log(fails ? ('\n' + fails + ' ANSWER-LEAD FAILURE(S).') : '\nALL ANSWER-LEAD TESTS GREEN');
process.exit(fails ? 1 : 0);
