// type-groups.js
// Centralized type bucket configuration for The Rail Roster.
// Single source of truth for the 24 tier-1 type buckets. (Trolley added Session 123; Vat Car v0.9.1888.)
// Built and verified in Session 118 (2026-05-04) — 100% coverage of 32,571 master items.
//
// USAGE:
//   var bucket = getTypeBucket(item);            // returns canonical bucket ID, e.g. 'Steam Locomotive'
//   var label  = getTypeBucketLabel(item);       // returns short display label, e.g. 'Steam'
//
// EXTENDING:
//   * A catalog row's own Item Type decides. There is NO by-number override table (retired v0.9.1845 —
//     see the note above getTypeBucket). To re-tag an item, fix its Item Type on the master sheet.
//   * Bucket display order in dropdowns/filters is alphabetical-by-label (TYPE_BUCKETS array).
//   * If a freight description doesn't match any rule, the function falls back to 'Boxcar' (most-common default).

(function () {
  'use strict';

  // ── 24 TIER-1 BUCKETS (alphabetical by short label) — Trolley added Session 123 ──
  // v0.9.1888 ([stated] Brad: "vat cars should be their own type"): Vat Car.
  // A vat car — a flatcar deck carrying wooden vats (Lionel's 6475 Pickles,
  // Heinz, Libby's, the Modern-era brand cars) — had been read as a Tank Car
  // by every word-reader, and the 17 master rows typed "Vat Car" showed the
  // bare word with no bucket (no filter line, no dashboard count). Measured
  // on the live master 2026-10-06: 17 rows typed Vat Car (Postwar ×5, Lionel
  // Modern ×11, K-Line ×1), 34 Lionel Modern vat cars typed Tank Car on the
  // sheet (Master Version 2.23 moves them), 8 K-Line typed Rolling Stock
  // (their words file them here). Every screen reads THIS list; the only
  // other seats are the dashboard's freight roll-up (dashboard.js) and the
  // icon map below.
  var TYPE_BUCKETS = [
    { id: 'Accessory',            label: 'Accessory'    },
    { id: 'Boxcar',               label: 'Boxcar'       },
    { id: 'Caboose',              label: 'Caboose'      },
    { id: 'Diesel Locomotive',    label: 'Diesel'       },
    { id: 'Electric Locomotive',  label: 'Electric'     },
    { id: 'Flatcar',              label: 'Flatcar'      },
    { id: 'Gondola',              label: 'Gondola'      },
    { id: 'Hopper',               label: 'Hopper'       },
    { id: 'Intermodal',           label: 'Intermodal'   },
    { id: 'Motorized Unit',       label: 'Motorized'    },
    { id: 'Operating Freight',    label: 'Operating'    },
    { id: 'Paper / Box / Misc',   label: 'Paper'        },
    { id: 'Passenger Car',        label: 'Passenger'    },
    { id: 'Transformer/Power',    label: 'Power'        },
    { id: 'Science Set',          label: 'Science'      },
    { id: 'Service Station Tool', label: 'Service Tool' },
    { id: 'Set',                  label: 'Set'          },
    { id: 'Steam Locomotive',     label: 'Steam'        },
    { id: 'Stock Car',            label: 'Stock'        },
    { id: 'Tank Car',             label: 'Tank'         },
    { id: 'Tender',               label: 'Tender'       },
    { id: 'Track',                label: 'Track'        },
    { id: 'Trolley',              label: 'Trolley'      },
    { id: 'Vat Car',              label: 'Vat'          }
  ];

  // ── v0.9.1845: the by-number override table is RETIRED ──────────────────
  // Session 118 kept 109 item numbers here ("600" → Flatcar, "900" → Boxcar …)
  // for rows whose description was too vague and whose Item Type was blank. A
  // NUMBER is not an identity: Lionel, American Flyer, S-Helper, Atlas, Marx,
  // LGB, Märklin, USA Trains and Bachmann all reuse the same numbers, and the
  // table forced its word onto every tab. Measured 2026-09-30 on the live master
  // (every tab, the app's own bucketer, with and without the table): 90 of the
  // 109 numbers changed nothing — the rows carry their own type now — and the
  // other 19 changed 43 rows, every one of them for the WORSE (Lionel Pre-War
  // "600 Passenger Cars" → Flatcar, Postwar "600 NW2 Switcher" → Flatcar, S-Helper
  // "900 Santa Fe F7 ABA" → Boxcar, Bachmann's 16818 caboose → Boxcar …). No
  // row matched by the table was without a type of its own. The row's own Item
  // Type decides; a wrong or missing type is fixed on the sheet.
  // tests/type_overrides_retired_tests.js holds the rule.

  // ══ v0.9.1742 — WHAT A LOCOMOTIVE'S OWN WORDS PROVE ═══════════════════════
  // Brad, 2026-09-14, on Atlas 30138671 (an ET44 diesel showing STEAM): "we
  // have a type issue, please review the atlas tab, find out why this
  // happened and then see what other issues might be similar and fix it."
  //
  // WHY: the steam-class list below had PACIFIC, NORTHERN, ATLANTIC, TEXAS,
  // ALLEGHENY, HUDSON and SWITCHER in it and was tested BEFORE the diesel
  // model names. Every one of those is also a RAILROAD — Union Pacific,
  // Burlington Northern, Atlantic Coast Line, Texas & Pacific, Delaware &
  // Hudson — so a "Union Pacific ET44" read as a 4-6-2 Pacific. Measured on
  // the live master: 317 diesels typed Steam that way, and 201 steam engines
  // typed Diesel by the "don't know → Diesel" default (Shays, Heislers,
  // 2-10-0 Decapods, GS-4s), in Lionel Modern, Atlas O, Williams, MTH…
  //
  // THE RULE, in order of trust:
  //   1. the plain word — "steam" / "diesel" (v0.9.1528, unchanged)
  //   2. HARD steam evidence: a wheel arrangement (2-8-4), a class that is not
  //      also a railroad (Mikado, Berkshire, Shay, Heisler, Big Boy…)
  //   3. HARD diesel evidence: a builder's model (GP9, SD70MAC, ET44, ES44AC,
  //      C44-9W, F3/F7, E6, S2, VO-1000, RS-11, Genset, Train Master…)
  //   4. only then the words that double as railroad names
  // Both hard signals at once ("Alco 2-8-2") decide nothing here.
  var LOCO_STEAM_HARD = /\b(\d-\d-\d(?:-\d)?|steam|dampflok\w*|mikado|berkshire|consolidation|mogul|shay|climax|heisler|big boy|niagara|decapod|ten.?wheeler|camelback|mallet|dockside|docksider|royal hudson)\b/i;
  var LOCO_DIESEL_HARD = /\b(diesel|gp[- ]?\d+\w*|sd[- ]?\d+\w*|sdp[- ]?\d+\w*|et44\w*|es44\w*|es8|ac4400\w*|ac6000\w*|c44\w*|c40\w*|c30\w*|dash[- ]?[89]\w*|u\d{2}[bc]?|f[- ]?[379][a-c]?|fa[- ]?[12]|fb[- ]?[12]|fp[- ]?[79]|pa[- ]?[12]|pb[- ]?[12]|rs[- ]?\d+\w*|rsd[- ]?\d*|rsc[- ]?\d*|sw[- ]?\d+\w*|nw[- ]?2|mp15\w*|vo-?1000|ds-?4-?4\w*|h[- ]?\d{2}-?44|h24\w*|h16\w*|fm|train ?master|genset|gevo|bl2|b23\w*|b30\w*|b36\w*|b40\w*|c420|c424|c425|c628|c630|c636|dl109|emd|3gs21b|geep|e[- ]?[5-9](?=\s*(?:locomotive|diesel|a unit|b unit|unit))|s[- ]?[124](?=\s*(?:locomotive|diesel|switcher)))\b/i;
  // Words that name a steam class AND a railroad. Weakest evidence; last.
  var LOCO_STEAM_SOFT = /\b(hudson|pacific|atlantic|columbia|prairie|northern|texas|allegheny|challenger|switcher|no\.\s*\d+e|jenny|usra.*steam|standard gauge.*steam)\b/i;
  // v0.9.1743: the plain word ALONE — for rows that are sets. "Union Pacific
  // Alco PA AA Diesel Set" was still Steam after v1742 because set rows were
  // skipped wholesale; and 335 Lionel "Steam Freight Set" rows sat typed
  // Diesel. On a set the model names prove nothing about the set as a whole
  // (a "6-Car Box Car Set" is not a locomotive at all), but the word
  // "Diesel" or "Steam" in a set's own name says which kind of engine it is
  // built around. Measured: 426 rows move, 91 Steam→Diesel, 335 Diesel→Steam.
  function locoKindFromPlainWord(text) {
    var n = String(text || '');
    var st = /\bsteam\b/i.test(n), di = /\bdiesel\b/i.test(n);
    if (st && !di) return 'Steam';
    if (di && !st) return 'Diesel';
    return '';
  }
  // What the text PROVES: 'Steam', 'Diesel', or '' (nothing hard, or both).
  function locoKindFromWords(text) {
    var n = String(text || '');
    if (!n) return '';
    var st = LOCO_STEAM_HARD.test(n), di = LOCO_DIESEL_HARD.test(n);
    if (st && !di) return 'Steam';
    if (di && !st) return 'Diesel';
    return '';
  }

  // ── Helper: classify generic "Locomotive" itemType into Steam/Diesel/Electric ──
  function classifyLocoByName(name) {
    if (!name) return null;
    var n = name.toLowerCase();
    // v0.9.1528: the word itself outranks the model-name guesses below.
    // "GP-9 diesel switcher" was coming back STEAM, because 'switcher' is in
    // the steam list (0-6-0 switchers) and it is tested first. When a
    // description says plainly which kind it is, believe it — only when both
    // words appear, or neither, do the name patterns get a say.
    var _saysSteam = /\bsteam\b/.test(n), _saysDiesel = /\bdiesel\b/.test(n);
    if (_saysDiesel && !_saysSteam) return 'Diesel';
    if (_saysSteam && !_saysDiesel) return 'Steam';
    if (/electric|gg-?1|ep[- ]?\d|asea/.test(n)) return 'Electric';
    // v0.9.1742: hard evidence first, in both directions — see the header.
    var _hard = locoKindFromWords(n);
    if (_hard) return _hard;
    if (/^\d+e\s/.test(n) || LOCO_STEAM_SOFT.test(n)) return 'Steam';
    if (/gp[- ]?\d|sd[- ]?\d|sd-?\d|\brs[- ]?\d|sw[- ]?\d|f[- ]?\d|f-?\d|mp15|u\d{2}|fa[- ]?\d|fb[- ]?\d|emd|alco|bl-?\d|h-?\d|baldwin|fairbanks|bombardier|mlw|dash[- ]?\d|c[- ]?\d{3}|fp[- ]?\d|pa[- ]?\d|nw[- ]?\d|husky|fairmont|trainmaster|krauss|f40ph|fm erie|rsd|gp15|sd70ace|sd70|sd60|sd50|sd45|sd75/.test(n)) return 'Diesel';
    return null;
  }

  // ── MAIN: getTypeBucket(item) returns one of the 24 canonical bucket IDs ──
  // (v0.9.1275, R20: this said 22 since before Trolley was added in Session
  // 123; line 3 of this file had it right the whole time.)
  function getTypeBucket(item) {
    if (!item) return '';
    // A row the user typed themselves (personal-only, flagged by browse.js)
    // keeps the user's own word in a few places below. (v0.9.1845: the
    // by-number override that used to sit here is retired — see above.)
    var _own = !!(item._personalOnly || item._manualRow);
    var it = _rrTypeWordCanon((item.itemType || '').trim());
    var sub = (item.subType || '').trim();
    var subL = sub.toLowerCase();
    var desc = ((item.description || '') + ' ' + (item.originalDesc || '') + ' ' + (item.varDesc || '')).toLowerCase();
    var hay = subL + ' ' + desc;
    var itemNum = (item.itemNum || '').toString();

    // ── MEMORABILIA (v0.9.1843) ──
    // The fourth non-train section (EPHEMERA_TABS, config.js) writes the
    // Type "Memorabilia"; a row typed "Other Lionel" by an older release
    // is the same section. The rule below files the master catalog's OWN
    // 'Memorabilia' rows under Paper / Box / Misc (Lionel's Other tab) and
    // would turn a collector's dealer sign into "Paper" — so a row the user
    // typed themselves keeps the section's own word, as a Mock-Up always
    // has. Master rows are not touched.
    if (_own && typeof ephSectionOfType === 'function' && ephSectionOfType(it) === 'other') {
      return (typeof ephTab === 'function' && ephTab('other')) ? ephTab('other').single : it;
    }

    // ── LOCOMOTIVES ──
    // v0.9.1742: a CATALOG row's stored kind is read, not obeyed on sight.
    // 518 master rows carry the opposite kind from what their own description
    // proves (see locoKindFromWords). A row whose words are unambiguous shows
    // as what it is; a row the user typed themselves is never overridden;
    // a set row is a different question and is left alone.
    // Only the row's OWN name — sub type + description. The variation prose
    // is left out on purpose: American Flyer's 561 Billboard Horn (variation
    // "(B) Santa Fe Alco with Steam Engine on Bridge") is neither.
    // v0.9.1743: a SET row is judged by its plain word only (see
    // locoKindFromPlainWord); any other row by the full evidence.
    var _ownName = subL + ' ' + String(item.description || '').toLowerCase();
    if (!_own && (it === 'Steam Locomotive' || it === 'Diesel Locomotive')) {
      var _proved = /\bsets?\b/.test(_ownName) ? locoKindFromPlainWord(_ownName) : locoKindFromWords(_ownName);
      if (_proved === 'Diesel' && it === 'Steam Locomotive') return 'Diesel Locomotive';
      if (_proved === 'Steam' && it === 'Diesel Locomotive') return 'Steam Locomotive';
    }
    if (it === 'Steam Locomotive' || it === 'Steam Engine') return 'Steam Locomotive';
    if (it === 'Diesel Locomotive' || it === 'Diesel Engine') return 'Diesel Locomotive';
    if (it === 'Electric Locomotive' || it === 'Electric Engine') return 'Electric Locomotive';
    if (it === 'Diesel') return 'Diesel Locomotive';
    if (it === 'Steam') return 'Steam Locomotive';
    if (it === 'Electric') return 'Electric Locomotive';
    if (it === 'Motorized Unit') return 'Motorized Unit';
    if (it === 'Tender') return 'Tender';
    // v0.9.1528: the spreadsheet import's description reader says plain
    // "Engine" (and users type "Loco", "Diesel", "Steam"). Treated exactly
    // like the catalog's own vague 'Locomotive': read the words for which
    // kind, fall back to Diesel. Without this, "Engine" became its own bucket
    // sitting beside Diesel and Steam in the filter.
    if (it === 'Engine' || it === 'Loco' || it === 'Locomotive' || it === 'Engine/Locomotive') {
      var c = classifyLocoByName(sub) || classifyLocoByName(desc);
      if (c) return c + ' Locomotive';
      if (/^11-1\d{3}/.test(itemNum)) return 'Steam Locomotive';   // MPC American Flyer Standard Gauge reissues
      return 'Diesel Locomotive';                                   // default for unknown (Atlas-dominant)
    }

    // ── DIRECT itemType MATCHES ──
    // Session 154: MTH-specific freight type names. These names short-circuit
    // before the Freight body-style block, so they need explicit mapping.
    // (The Freight regex below would classify these same descriptions identically.)
    if (it === 'Operating Car') return 'Operating Freight';
    if (it === 'Crane Car') return 'Operating Freight';
    if (it === 'Auto Carrier') return 'Intermodal';
    if (it === 'Slag Car') return 'Hopper';
    if (it === 'Passenger Car') return 'Passenger Car';
    if (it === 'Caboose') return 'Caboose';
    if (it === 'Science Set') return 'Science Set';
    if (it === 'Set' || it === 'Set Box' || it === 'Construction Set' || it === 'Test Set' || it === 'Diesel Set' || it === 'Electric Set') return 'Set';   // v0.9.1875 ([stated] Brad: electric unit sets are treated like the diesel sets — listed under Set)
    if (it === 'Track' || it === 'Switches' || it === 'Crossing') return 'Track';
    if (it === 'Transformer' || it === 'Transformer/Power') return 'Transformer/Power';
    if (it === 'Service Station Tool' || it === 'Service Tool') return 'Service Station Tool';
    // Session 123: Trolley as own bucket, Interurban + Subway Car as Passenger Cars
    if (it === 'Trolley') return 'Trolley';
    if (it === 'Interurban' || it === 'Subway Car') return 'Passenger Car';
    if (it === 'Accessory' || it === 'Billboard' || it === 'Electronics' || it === 'Parts/Supplies' || it === 'Dealer Layout') return 'Accessory';
    if (it === 'Box' || it === 'Box Reference' || it === 'Form' || it === 'Magazine' || it === 'Salesman Brochure' || it === 'Catalog' || it === 'Service Manual' || it === 'Newsletter' || it === 'Stock Certificate' || it === 'Inspection Tag' || it === 'Wartime Paper' || it === 'Memorabilia' || it === 'Lionel Other' || it === 'Nabisco Promotion' || it === 'Paper') return 'Paper / Box / Misc';

    // ── FREIGHT (Freight Car / Rolling Stock) — full body-style logic from Session 118 ──
    if (it === 'Freight Car' || it === 'Rolling Stock') {
      // v0.9.1874 ([stated] Brad: "yes" to plan → workbook ROLLING_STOCK_WORDS_PLAN_2026-10-04.xlsx
      // → "yes" to build). Measured on all 164,836 master rows: 465 rows read wrong here, every
      // other row unchanged. (1) "oil car" was matched INSIDE "Coil Car" — 87 coil cars showed
      // as Tank Cars; it is now a word of its own (\boil car). (2) words the lists below never
      // had: crane / boom tender, snowplow (one word), Jordan spreader, engineering car →
      // Operating; coil, stake and logging cars → Flatcar; Märklin's "low side car" → Gondola;
      // RoadRailer and auto transport cars → Intermodal; rapid discharge cars → Hopper. All fell
      // to the Boxcar default. "freight car set" is left alone on purpose (Set vs the car type
      // is an open question). tests/rolling_stock_words_tests.js holds the real rows.
      // Pre-pass: re-route mis-tagged items to non-freight buckets
      if (/coach|observation|baggage|\brpo\b|sleeper|combine|dome car|dome chair|dining car|diner|pullman|troop|solarium state|madison|comet ii|horizon|amfleet|california zephyr|streamlined passenger|streamlined coach|streamliner.*car|streamliner.*4[- ]pack|streamliner.*add[- ]on|streamline car|streamline.*4[- ]pack|amtrak streamline|heavyweight car add|streamline car add|streamliner add|lounge car|business car|dorm[ -]buffet|state solarium|bi[ -]?level gallery|gallery car|commuter|training car|18["”] .*car|21["”] .*car|22["”] .*car|amtrak phase|doom car|doom liner|theater car|wifi theater|crew car|racing crew|auxiliary power|banquet car|sleeping car|wood chapel|rider car|exhibit car|exhibition car|m-10000|m-10001|fleet of modernism|\bb60\b|\bb60bh\b|strasburg.*b60|excursion car|kitchen car|kitchen w\//i.test(hay)) return 'Passenger Car';
      if (/^\s*tender\s*$|^crane tender$|tender car/i.test(sub) || /^\s*tender\s*$/i.test(desc)) return 'Tender';
      if (/motor car/i.test(hay)) return 'Motorized Unit';
      if (/race car track section|track section/i.test(hay)) return 'Accessory';
      if (/set expansion|train pack|3[- ]?pack|2[- ]?pack|4[- ]?pack freight|four[- ]?pack freight|consist.*pack|m-10000.*set|m-?10001.*set|rolling stock.*pack|train set|disconnect work car 4|disconnect.*4[- ]?pack/i.test(hay)) return 'Set';
      if (/caboose|\bn5 cabin|\bn8 cabin|cabin car/i.test(hay)) return 'Caboose';

      // Body-style buckets
      if (/operating|searchlight|floodlight|magnetic crane|cop and hobo|cop & hobo|hobo car|giraffe|aquarium|exploding|missile|rocket launcher|helicopter|radar|television|brakeman|coal dump|log dump|operating log|barrel car|milk car|culvert|moe|joe|merchandise car|automatic gateman|operating crane|dispatch board|news car|power shovel|generator car|mercury capsule|aerial target|capsule launching|launching car|snow plow|track maintenance|maintenance car|mine car|track cleaning car|frontier search|electric derrick|hot metal|torpedo car|bunk car|tool car|derrick car|with crane|with shovel|security car|ice car|calliope|toy soldier car|circus car|radioactive waste|condenser car|reactor fluid|mini[- ]?max|harold the helicopter|harold helicopter|tv car|television car|toxic waste|cherry picker|peekaboo|wayne enterprises|exorcist|disconnect car|fire car|fire prevention|polar express present|polar express hot chocolate|polar express transport|trailer home|halloween|christmas car|bullion car|platinum car|chicken car|poultry car|fire ladder|target launcher|fire instruction|animated|foghorn|porky pig|daffy duck|warner bros|balloon car|safes|with safes|boom car|with cannon|allis-chalmers car|space launch|sledex|hot chocolate thermos|thermos car|present unloading|present transport|christmas present|christmas music|big snow plow|j\.?p\.? holland|deep sea challenger|operation eagle|shark fin|big cannon|atomic|nuclear|nuclear waste|holland submarine|ammunition car|with safes|with dragster|skiing|ski train|ski[- ]train|exhibition car|fang.*snake|snake.*exhibition|psychedelic|m-10000.*power|fourth of july|christmas hot chocolate|space launch|capsules|capsule.*car|sub.*car|^crane[ ,]|biohazard|tie work|tie work car|\bmow\b|welding car|welding|merry.*bright|hot cocoa|hot chocolate car|north pole.*icing|santa.*favorites|hunting rabbit|sheriff.*outlaw|conductor announcement|abandoned toy|poultry dispatch|sweep car|gift car|merry.*car|fire fighting|snowplow|snow-plow|jordan spreader|engineering car|crane tender|boom tender/i.test(hay)) return 'Operating Freight';
      if (/\bdump car\b|\bcrane car\b|\bsearchlight\b/i.test(hay)) return 'Operating Freight';
      if (/cattle/i.test(hay)) {
        if (/operating|moving|automatic|3656|3356|3370|6356/i.test(hay)) return 'Operating Freight';
        return 'Stock Car';
      }
      if (/stock car|elephant car|horse car|reindeer car|vision.*horse/i.test(hay)) return 'Stock Car';
      if (/well car|twin[- ]stack|maxi[- ]?iv|maxi[- ]?stack|auto carrier|articulated auto|tractor trailer|container car|\bcontainers?\b|intermodal|piggy[- ]?back|tofc|cofc|front runner|trailer train|45ft pines|nw heritage|with .*trailers|with two trailers|husky stack|husky double|double[- ]stack|enclosed auto rack|auto rack|roadrailer|auto transport|with sears trailer|with fedex trailer|with red wing.*trailer|with armstrong.*trailer|with grumman trailer|with new holland trailer|with campbell.*trailer|with navajo trailer|45th anniversary trailer|115th anniversary trailer|ford new holland trailer|with .*trailer.*1\/48|trailer.*lcca/i.test(hay)) return 'Intermodal';
      // v0.9.1888: a vat car is its own bucket (Brad), read BEFORE the tank
      // rule that used to swallow it. The word is "vat car" — never "vat"
      // alone (Märklin's "VAT Logistics" container car is intermodal).
      if (/\bvat car\b/i.test(hay)) return 'Vat Car';
      if (/tank car|tankcar|single[ -]?dome|triple[ -]?dome|double[ -]?dome|three[ -]?dome|two[ -]?dome|four[ -]?dome|\boil car|liquefied gas|heat exchanger|helium tank load|chemical tank|ammonia|liquid oxygen|tank train car|water tank car|tanktrain|tank train intermediate|three-dome|two-dome|utlx/i.test(hay)) return 'Tank Car';
      if (/coalveyor/i.test(hay)) return 'Gondola';
      if (/hopper|ore car|coalporter|sand car|coal car|ballast car|icebreaker|ice breaker|\bslag\b|with coal load|coal load|rapid discharge/i.test(hay)) return 'Hopper';
      if (/gondola|gon car|low side car/i.test(hay)) return 'Gondola';
      if (/flat[- ]?car|flatcar|pulpwood|coil steel|coil car|stake car|logging car|bulkhead|depressed center|skeleton car|log car|crane flatcar|automobile flat|piggy[- ]?back flat|tofc flat|with trailer|with logs|with fences|with fence|with corvettes|with j\.?b\.? hunt|with stakes|with horses|with crates|with submarine|with usn|with u\.s\.n|with royal navy|with bulldozer|with scraper|with helium|with two corvettes|with wheel|with rail|with wood|with boat|with ladder|with usmc|with u\.s\.m\.c|with two u\.s\.m\.c|with two .*tank|wooden dowel logs|ramp car|center beam|barrel ramp|machine car|with motor|with snowmobile|with tank|with water tank|fire rescue|with farm tractor|with auto|with autos|with automobile|with vans|with truck|with trucks|with car|with sears|with fedex|with red wing|with new holland|with ertl|with corgi|with airplane|with beechcraft|with plymouth|with dodge viper|with caterpillar|with timbers|with bonanza|with vipers|with vw|with volkswagen|with prowler|with sedans|with coupes|with station wagons|with pickups|with auto frames|with two trucks|with two coupes|with mack truck|with tow truck|with milk truck|with load|with tractor|auto loader|boat loader|wheel car|sedan numbered|coupe numbered|with two red sedans|with two wagons|with propellers|with pickup truck|with two autos|with grumman|with campbell|with navajo|with armstrong|with cnw|with chicago.*northwestern|^fences[ ,]|\bbeechcraft\b|\bbonanzas?\b|\bvipers?\b|\bsedans?\b|\bcoupes?\b|station wagons?|\bpickups?\b|tow truck|mack truck|milk truck|touring coupes?|\bdragsters?\b|recovery with|uni[- ]?body|numbered 6411|numbered 6424|numbered 6429|numbered 9823|with a pair|with a ford|with two|wheel load|rail load|safe block|cable reel|numbered 6561|6561.*cable/i.test(hay)) return 'Flatcar';
      if (/box car|boxcar|reefer|refrigerator|express car|express reefer|merchandise|automobile car|auto car|center partition|airslide|plug door|sliding door|mint car|ammunition car|express trail|overstamped|tca .*car|lots .*car|lcca .*car|holiday boxcar|toy fair|christmas car|holiday car|hi[- ]?cube|mail car|thomas tank|hi-cube|high[- ]cube|beer car|anheuser/i.test(hay)) return 'Boxcar';

      // Item-number range fallback for Lionel 9000-series
      var n = parseInt(itemNum.replace(/^X/, ''), 10);
      if (n) {
        if (n >= 9000 && n <= 9099) return 'Flatcar';
        if (n >= 9100 && n <= 9199) return 'Flatcar';
        if (n >= 9200 && n <= 9299) return 'Boxcar';
        if (n >= 9300 && n <= 9399) return 'Flatcar';
        if (n >= 9400 && n <= 9499) return 'Boxcar';
        if (n >= 9500 && n <= 9599) return 'Passenger Car';
        if (n >= 9700 && n <= 9799) return 'Boxcar';
        if (n >= 9800 && n <= 9899) return 'Boxcar';
      }

      // Last-resort default for freight: Boxcar (most-common body)
      return 'Boxcar';
    }

    // v0.9.1528 (Brad: "your Type filter now has two vocabularies in it").
    // This used to pass the raw string straight through, which is why one
    // collection showed 80 different type strings: the catalog itself carries
    // compounds ("Flatcar - PS-4 Flatcar", "Caboose - Work Caboose"), pack
    // names ("Boxcar 2-Pack") and one-off body names ("Boom Car", "Reefer").
    // Each became its own line in the filter. Now they are folded into the 24
    // buckets; anything genuinely outside them — a user's own "Wings of
    // Texaco" — still passes through untouched, which is the point.
    return _normalizeToBucket(it) || 'Other';
  }

  // ── v0.9.1844: the master-list audit's vocabulary pass ──────────────────
  // Measured 2026-09-30 on the live master: 7,224 rows carried a type the
  // buckets did not know, 185 different words. Three shapes of miss, each
  // fixed once here rather than by 185 entries:
  //   1. the same word in another case — "Rolling stock", "diesel", "electric"
  //      — so every word a branch below compares exactly is canonised first;
  //   2. Lionel's HO rows on the O tabs, typed "HO Boxcar", "HO - Tower",
  //      "HO Caboose - Work Caboose" — the "HO " is stripped and the rest is
  //      judged like any other type;
  //   3. a maker's own name for a locomotive — "Diesel/Electric Locomotive"
  //      (MTH), "Switcher", "Diesel Superbass", "F3 Unit" — sent through the
  //      same words-decide rule as plain "Locomotive"; "Live steam" is Steam.
  // The plain synonyms are in _TYPE_SYNONYMS below. Left as their own word on
  // purpose: "Part" (parts on item tabs), "Premiums" and merchandise,
  // "Separate Sale", "MOW Car" — the app shows the word itself, ("Vat Car" left
  // this list in v0.9.1888: it is a bucket now.)
  // which is honest. (v0.9.1877: "Auto Rack" left this list — [stated] Brad:
  // "yes", an auto rack is filed with Intermodal like an auto carrier; 310
  // master rows carry the word — Atlas HO / N / Z and MTH O.)
  var _TYPE_CANON_WORDS = ['Steam Locomotive', 'Diesel Locomotive', 'Electric Locomotive', 'Steam Engine', 'Diesel Engine',
    'Electric Engine', 'Diesel', 'Steam', 'Electric', 'Motorized Unit', 'Tender', 'Engine', 'Loco', 'Locomotive',
    'Engine/Locomotive', 'Operating Car', 'Crane Car', 'Auto Carrier', 'Slag Car', 'Passenger Car', 'Caboose',
    'Science Set', 'Set', 'Set Box', 'Construction Set', 'Test Set', 'Diesel Set', 'Electric Set', 'Track', 'Switches', 'Crossing',
    'Transformer', 'Transformer/Power', 'Service Station Tool', 'Service Tool', 'Trolley', 'Interurban', 'Subway Car',
    'Accessory', 'Billboard', 'Electronics', 'Parts/Supplies', 'Dealer Layout', 'Box', 'Box Reference', 'Form',
    'Magazine', 'Salesman Brochure', 'Catalog', 'Service Manual', 'Newsletter', 'Stock Certificate', 'Inspection Tag',
    'Wartime Paper', 'Memorabilia', 'Lionel Other', 'Nabisco Promotion', 'Paper', 'Freight Car', 'Rolling Stock'];
  var _TYPE_CANON = {};
  _TYPE_CANON_WORDS.forEach(function (w) { _TYPE_CANON[w.toLowerCase()] = w; });
  // a maker's own word for an engine → the generic word, so the description decides steam / diesel / electric
  var _TYPE_LOCO_WORDS = { 'diesel/electric locomotive': 'Locomotive', 'diesel-electric locomotive': 'Locomotive',
    'switcher': 'Locomotive', 'diesel superbass': 'Diesel Locomotive', 'f3 unit': 'Diesel Locomotive',
    'live steam': 'Steam Locomotive', 'steam locomotive (live steam)': 'Steam Locomotive' };
  function _rrTypeWordCanon(raw) {
    var t = String(raw || '').trim();
    if (!t) return t;
    t = t.replace(/^HO\s*-?\s+(?=\S)/, '');          // "HO Boxcar" → "Boxcar"; "HO - Tower" → "Tower"; never "Hopper"
    var low = t.toLowerCase();
    if (_TYPE_LOCO_WORDS[low]) return _TYPE_LOCO_WORDS[low];
    return _TYPE_CANON[low] || t;
  }

  // Fold a loose type string into one of the 24 buckets. Returns the string
  // unchanged when it belongs to nobody (custom user types).
  var _BUCKET_IDS = {};
  TYPE_BUCKETS.forEach(function (b) { _BUCKET_IDS[b.id.toLowerCase()] = b.id; });
  var _TYPE_SYNONYMS = {
    // freight bodies the catalog names in its own words
    'reefer': 'Boxcar', 'refrigerator car': 'Boxcar', 'mint car': 'Boxcar',
    'ice car': 'Boxcar', 'bunk car': 'Boxcar', 'milk car': 'Operating Freight',
    'poultry car': 'Stock Car', 'auto carrier': 'Intermodal', 'auto rack': 'Intermodal', 'tank train': 'Tank Car',
    // work / operating cars
    'crane': 'Operating Freight', 'crane car': 'Operating Freight', 'boom car': 'Operating Freight',
    'derrick car': 'Operating Freight', 'dump car': 'Operating Freight', 'culvert car': 'Operating Freight',
    'log car': 'Operating Freight', 'searchlight car': 'Operating Freight', 'snowplow': 'Operating Freight',
    'brakeman car': 'Operating Freight', 'minuteman car': 'Operating Freight', 'operating car': 'Operating Freight',
    'fire car': 'Operating Freight', 'submarine car': 'Operating Freight',
    // passenger bodies
    'diner car': 'Passenger Car', 'observation car': 'Passenger Car', 'coach car': 'Passenger Car',
    'passenger coach': 'Passenger Car', 'baggage car': 'Passenger Car', 'combine': 'Passenger Car',
    // sets and packs
    'freight set': 'Set', 'passenger set': 'Set', 'multi car pack': 'Set', 'diesel aa set': 'Set',
    // accessories
    'station': 'Accessory', 'gateman': 'Accessory', 'loader': 'Accessory', 'figures': 'Accessory',
    'vehicle': 'Accessory', 'promotional': 'Accessory', 'building': 'Accessory', 'billboard': 'Accessory',
    // paper
    'catalog': 'Paper / Box / Misc', 'paper': 'Paper / Box / Misc',
    'transformer': 'Transformer/Power',
    // ── v0.9.1844: the master-list audit's words (see _rrTypeWordCanon above) ──
    // sets
    'car set': 'Set', 'train set': 'Set', 'r-t-r/speciality set': 'Set', 'r-t-r/specialty set': 'Set',
    'diesel aba set': 'Set', 'diesel ab set': 'Set', 'freight 3-pack': 'Set', 'showcase car 2 pack': 'Set',
    'support car 2 pack': 'Set', 'heavyweight car 2 pack': 'Set', 'exhibit car 4 pack': 'Set', 'trailer 2-pack': 'Set',
    // motorized units — self-propelled work and rail cars
    'powered rail car': 'Motorized Unit', 'rail car': 'Motorized Unit', 'railcar': 'Motorized Unit', 'speeder': 'Motorized Unit',
    'hand car': 'Motorized Unit', 'handcar': 'Motorized Unit', 'gang car': 'Motorized Unit', 'inspection vehicle': 'Motorized Unit',
    'jet-powered rail car': 'Motorized Unit', 'snow blower': 'Motorized Unit', 'jet blower': 'Motorized Unit',
    'tie-jector': 'Motorized Unit', 'tamper': 'Motorized Unit', 'budd car': 'Motorized Unit', 'rdc': 'Motorized Unit',
    // hoppers
    'covered hopper': 'Hopper', 'ore car': 'Hopper', 'taconite car': 'Hopper', 'coal car': 'Hopper',
    // intermodal
    'tofc flatcar': 'Intermodal', 'intermodal car': 'Intermodal', 'well car': 'Intermodal', 'stack car': 'Intermodal',
    'container car': 'Intermodal', 'piggyback': 'Intermodal',
    // passenger bodies
    'streamliner car': 'Passenger Car', 'heavyweight car': 'Passenger Car', 'heaveyweight car': 'Passenger Car',
    'vista dome car': 'Passenger Car', 'full vista dome car': 'Passenger Car', 'dome car': 'Passenger Car',
    'combination car': 'Passenger Car', 'combine car': 'Passenger Car', 'dining car': 'Passenger Car', 'diner': 'Passenger Car',
    'sleeping car': 'Passenger Car', 'sleeper car': 'Passenger Car', 'mail car': 'Passenger Car', 'express car': 'Passenger Car',
    'coach': 'Passenger Car', 'coach car': 'Passenger Car', 'baggage car': 'Passenger Car', 'observation car': 'Passenger Car',
    // operating and specialty cars
    'aquarium car': 'Operating Freight', 'barrel car': 'Operating Freight', 'missile car': 'Operating Freight',
    'cannon car': 'Operating Freight', 'launch car': 'Operating Freight', 'radar car': 'Operating Freight',
    'helicopter car': 'Operating Freight', 'generator car': 'Operating Freight', 'welding car': 'Operating Freight',
    'cleaning car': 'Operating Freight', 'voltmeter car': 'Operating Freight', 'globe car': 'Operating Freight',
    'tv car': 'Operating Freight', 'sound car': 'Operating Freight', 'security car': 'Operating Freight',
    'exhibit car': 'Operating Freight', 'instruction car': 'Operating Freight', 'test car': 'Operating Freight',
    // accessories — structures, vehicles, signals
    'bridge': 'Accessory', 'water tower': 'Accessory', 'tower': 'Accessory', 'platform': 'Accessory', 'tunnel': 'Accessory',
    'terminal': 'Accessory', 'landscape': 'Accessory', 'diorama': 'Accessory', 'display base': 'Accessory',
    'display case': 'Accessory', 'vehicles': 'Accessory', 'trucks': 'Accessory', 'truck': 'Accessory',
    'tractor and trailer': 'Accessory', 'die-cast toy': 'Accessory', 'signal': 'Accessory', 'catenary': 'Accessory',
    'figures': 'Accessory',
    // track
    'switch': 'Track', 'crossover': 'Track', 'lock-on': 'Track', 'bumpers': 'Track', 'bumper': 'Track',
    'mega track': 'Track', 'superstreets': 'Track',
    // power and control
    'controller': 'Transformer/Power', 'control': 'Transformer/Power', 'command control': 'Transformer/Power',
    // paper
    'packet': 'Paper / Box / Misc', 'manual': 'Paper / Box / Misc', 'record': 'Paper / Box / Misc',
    'sales material': 'Paper / Box / Misc', 'ephemera': 'Paper / Box / Misc', 'instruction sheet': 'Paper / Box / Misc',
    'certificate': 'Paper / Box / Misc', 'book': 'Paper / Box / Misc', 'print': 'Paper / Box / Misc',
    'note cards': 'Paper / Box / Misc', 'misc lionel': 'Paper / Box / Misc',
  };
  function _normalizeToBucket(raw) {
    var t = String(raw || '').trim();
    if (!t) return '';
    var low = t.toLowerCase();
    if (_BUCKET_IDS[low]) return _BUCKET_IDS[low];
    if (_TYPE_SYNONYMS[low]) return _TYPE_SYNONYMS[low];
    // "Boxcar 2-Pack", "Passenger Car 4-Pack", "Log Car 3-Pack" → the body,
    // not a bucket of its own. Packs of one body style are still that style.
    var pack = low.replace(/\s*\d+[- ]?pack$/, '').trim();
    if (pack !== low) {
      if (_BUCKET_IDS[pack]) return _BUCKET_IDS[pack];
      if (_TYPE_SYNONYMS[pack]) return _TYPE_SYNONYMS[pack];
    }
    // "Flatcar - PS-4 Flatcar", "Caboose - Work Caboose": the catalog's own
    // "bucket - specific model" form. The part before the dash is the bucket.
    var dash = low.split(' - ')[0].trim();
    if (dash !== low) {
      if (_BUCKET_IDS[dash]) return _BUCKET_IDS[dash];
      if (_TYPE_SYNONYMS[dash]) return _TYPE_SYNONYMS[dash];
    }
    return t;      // a real custom type — leave it exactly as the user wrote it
  }

  // ── Display label getter (short label for UI pills) ──
  function getTypeBucketLabel(item) {
    var id = getTypeBucket(item);
    for (var i = 0; i < TYPE_BUCKETS.length; i++) {
      if (TYPE_BUCKETS[i].id === id) return TYPE_BUCKETS[i].label;
    }
    return id;
  }

  // ── Wizard quick-entry icon mapping (Session 119) ──
  // Single source of truth for which app-shell icon shows next to the
  // condition slider in Quick Entry. Three icons are available:
  //   'engine'  — img/icon_engine.png   (default — locomotives, accessories, sets, etc.)
  //   'tender'  — img/icon_tender.png   (steam tenders only)
  //   'freight' — img/icon_freight.png  (rolling stock that gets pulled)
  // Buckets not listed fall through to 'engine'.
  var BUCKET_TO_ICON = {
    'Tender':     'tender',
    // Rolling stock that gets pulled by an engine
    'Boxcar':     'freight',
    'Caboose':    'freight',
    'Flatcar':    'freight',
    'Gondola':    'freight',
    'Hopper':     'freight',
    'Intermodal': 'freight',
    'Operating':  'freight',
    'Passenger':  'freight',
    'Stock':      'freight',
    'Tank':       'freight',
    'Vat':        'freight',
    'Trolley':    'freight',
  };

  function getBucketIcon(item) {
    if (typeof getTypeBucketLabel !== 'function') return 'engine';
    return BUCKET_TO_ICON[getTypeBucketLabel(item)] || 'engine';
  }

  // Expose globally
  window.TYPE_BUCKETS = TYPE_BUCKETS;
  window.rrNormalizeTypeToBucket = _normalizeToBucket;
  window.getTypeBucket = getTypeBucket;
  window.locoKindFromWords = locoKindFromWords;   // v0.9.1742: one reader for every classifier
  window.locoKindFromPlainWord = locoKindFromPlainWord;   // v0.9.1743
  window.getTypeBucketLabel = getTypeBucketLabel;
  window.BUCKET_TO_ICON = BUCKET_TO_ICON;
  window.getBucketIcon = getBucketIcon;
})();
