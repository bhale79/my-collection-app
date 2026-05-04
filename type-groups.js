// type-groups.js
// Centralized type bucket configuration for The Rail Roster.
// Single source of truth for the 22 tier-1 type buckets.
// Built and verified in Session 118 (2026-05-04) — 100% coverage of 32,571 master items.
//
// USAGE:
//   var bucket = getTypeBucket(item);            // returns canonical bucket ID, e.g. 'Steam Locomotive'
//   var label  = getTypeBucketLabel(item);       // returns short display label, e.g. 'Steam'
//
// EXTENDING:
//   * To re-tag a specific item by its item number, add an entry to MANUAL_TYPE_OVERRIDES below.
//   * Bucket display order in dropdowns/filters is alphabetical-by-label (TYPE_BUCKETS array).
//   * If a freight description doesn't match any rule, the function falls back to 'Boxcar' (most-common default).

(function () {
  'use strict';

  // ── 22 TIER-1 BUCKETS (alphabetical by short label, per design choice in Session 118) ──
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
    { id: 'Track',                label: 'Track'        }
  ];

  // ── MANUAL OVERRIDES — item numbers where the description is too vague to bucket via rules ──
  // 109 entries confirmed via web research + reasoning in Session 118.
  var MANUAL_TYPE_OVERRIDES = {
    // Pre-War overrides
    '600': 'Flatcar', '900': 'Boxcar', '1519': 'Passenger Car', '1520': 'Passenger Car',
    // Post-War overrides
    '2957': 'Caboose', 'X2758': 'Boxcar', 'X2954': 'Boxcar',
    // MPC web-confirmed
    '6112': 'Hopper', '6515': 'Tank Car', '6564': 'Flatcar', '6574': 'Operating Freight', '6575': 'Flatcar',
    '15395': 'Passenger Car', '16173': 'Flatcar', '16181': 'Tank Car', '16390': 'Flatcar',
    '17888': 'Intermodal', '17913': 'Flatcar', '17914': 'Flatcar',
    '19445': 'Tank Car', '19479': 'Flatcar', '19483': 'Flatcar', '19669': 'Boxcar', '19671': 'Boxcar',
    '19867': 'Operating Freight',
    '21757': 'Set', '21766': 'Set', '21778': 'Set',
    '26111': 'Flatcar', '26112': 'Flatcar', '26113': 'Flatcar',
    '26934': 'Tank Car', '26936': 'Tank Car', '26941': 'Tank Car', '26942': 'Tank Car', '26943': 'Tank Car',
    '26947': 'Tank Car', '26951': 'Intermodal', '26973': 'Tank Car', '26977': 'Tank Car',
    '26978': 'Tank Car', '26979': 'Tank Car', '26980': 'Tank Car', '26981': 'Tank Car',
    '29282': 'Set',
    '36006': 'Operating Freight', '36030': 'Boxcar', '36031': 'Boxcar', '36040': 'Flatcar',
    '39210': 'Operating Freight', '39447': 'Flatcar',
    '52040': 'Intermodal', '52042': 'Intermodal', '52101': 'Boxcar', '52120': 'Operating Freight',
    '52137': 'Tank Car', '52183': 'Passenger Car', '52185': 'Passenger Car', '52193': 'Operating Freight',
    '72512': 'Boxcar', '84309': 'Accessory', '99013': 'Boxcar',
    // Modern era
    '1901310': 'Boxcar', '1928590': 'Operating Freight',
    '1933561': 'Passenger Car', '1933562': 'Passenger Car', '1933563': 'Passenger Car', '1933564': 'Passenger Car',
    '2026760': 'Boxcar',
    '2028100': 'Operating Freight', '2028110': 'Operating Freight', '2028150': 'Operating Freight',
    '2028270': 'Operating Freight', '2028430': 'Operating Freight', '2028530': 'Operating Freight',
    '2228270': 'Operating Freight', '2243150': 'Set',
    // K-Line scale boxcars
    '3002955': 'Boxcar', '3002956': 'Boxcar', '3002957': 'Boxcar', '3002958': 'Boxcar', '3002959': 'Boxcar', '3002960': 'Boxcar',
    '3009984': 'Boxcar', '3009985': 'Boxcar', '3009986': 'Boxcar', '3009987': 'Boxcar', '3009988': 'Boxcar',
    '3009989': 'Boxcar', '3009990': 'Boxcar', '3009991': 'Boxcar', '3009992': 'Boxcar', '3009993': 'Boxcar',
    '3009994': 'Boxcar', '3009995': 'Boxcar',
    // Truly opaque MPC items — defaulted to Boxcar (most-common freight body)
    '780': 'Boxcar', '16606': 'Boxcar', '16642': 'Boxcar', '16725': 'Boxcar', '16818': 'Boxcar', '16819': 'Boxcar',
    '19819': 'Boxcar', '19822': 'Boxcar', '19853': 'Boxcar', '19913': 'Boxcar',
    '26120': 'Boxcar', '26122': 'Boxcar', '26740': 'Boxcar', '52160': 'Boxcar'
  };

  // ── Helper: classify generic "Locomotive" itemType into Steam/Diesel/Electric ──
  function classifyLocoByName(name) {
    if (!name) return null;
    var n = name.toLowerCase();
    if (/no\.\s*\d+e\b|^\d+e\s|hudson|pacific|berkshire|mikado|atlantic|columbia|prairie|consolidation|mogul|0-\d-\d|2-\d-\d|4-\d-\d|switcher|northern|niagara|big boy|challenger|dock side|royal hudson|allegheny|texas|jenny|usra.*steam|standard gauge.*steam/.test(n)) return 'Steam';
    if (/electric|gg-?1|ep[- ]?\d|asea/.test(n)) return 'Electric';
    if (/gp[- ]?\d|sd[- ]?\d|sd-?\d|\brs[- ]?\d|sw[- ]?\d|f[- ]?\d|f-?\d|mp15|u\d{2}|fa[- ]?\d|fb[- ]?\d|emd|alco|bl-?\d|h-?\d|baldwin|fairbanks|bombardier|mlw|dash[- ]?\d|c[- ]?\d{3}|fp[- ]?\d|pa[- ]?\d|nw[- ]?\d|husky|fairmont|trainmaster|krauss|f40ph|fm erie|rsd|gp15|sd70ace|sd70|sd60|sd50|sd45|sd75/.test(n)) return 'Diesel';
    return null;
  }

  // ── MAIN: getTypeBucket(item) returns one of the 22 canonical bucket IDs ──
  function getTypeBucket(item) {
    if (!item) return '';
    if (MANUAL_TYPE_OVERRIDES[item.itemNum]) return MANUAL_TYPE_OVERRIDES[item.itemNum];
    var it = (item.itemType || '').trim();
    var sub = (item.subType || '').trim();
    var subL = sub.toLowerCase();
    var desc = ((item.description || '') + ' ' + (item.originalDesc || '') + ' ' + (item.varDesc || '')).toLowerCase();
    var hay = subL + ' ' + desc;
    var itemNum = (item.itemNum || '').toString();

    // ── LOCOMOTIVES ──
    if (it === 'Steam Locomotive' || it === 'Steam Engine') return 'Steam Locomotive';
    if (it === 'Diesel Locomotive' || it === 'Diesel Engine') return 'Diesel Locomotive';
    if (it === 'Electric Locomotive') return 'Electric Locomotive';
    if (it === 'Motorized Unit') return 'Motorized Unit';
    if (it === 'Tender') return 'Tender';
    if (it === 'Locomotive') {
      var c = classifyLocoByName(sub) || classifyLocoByName(desc);
      if (c) return c + ' Locomotive';
      if (/^11-1\d{3}/.test(itemNum)) return 'Steam Locomotive';   // MPC American Flyer Standard Gauge reissues
      return 'Diesel Locomotive';                                   // default for unknown (Atlas-dominant)
    }

    // ── DIRECT itemType MATCHES ──
    if (it === 'Passenger Car') return 'Passenger Car';
    if (it === 'Caboose') return 'Caboose';
    if (it === 'Science Set') return 'Science Set';
    if (it === 'Set' || it === 'Set Box' || it === 'Construction Set' || it === 'Test Set') return 'Set';
    if (it === 'Track') return 'Track';
    if (it === 'Transformer' || it === 'Transformer/Power') return 'Transformer/Power';
    if (it === 'Service Station Tool' || it === 'Service Tool') return 'Service Station Tool';
    if (it === 'Accessory' || it === 'Billboard' || it === 'Electronics' || it === 'Parts/Supplies' || it === 'Dealer Layout') return 'Accessory';
    if (it === 'Box' || it === 'Box Reference' || it === 'Form' || it === 'Magazine' || it === 'Salesman Brochure' || it === 'Catalog' || it === 'Service Manual' || it === 'Newsletter' || it === 'Stock Certificate' || it === 'Inspection Tag' || it === 'Wartime Paper' || it === 'Memorabilia' || it === 'Lionel Other' || it === 'Nabisco Promotion' || it === 'Paper') return 'Paper / Box / Misc';

    // ── FREIGHT (Freight Car / Rolling Stock) — full body-style logic from Session 118 ──
    if (it === 'Freight Car' || it === 'Rolling Stock') {
      // Pre-pass: re-route mis-tagged items to non-freight buckets
      if (/coach|observation|baggage|\brpo\b|sleeper|combine|dome car|dome chair|dining car|diner|pullman|troop|solarium state|madison|comet ii|horizon|amfleet|california zephyr|streamlined passenger|streamlined coach|streamliner.*car|streamliner.*4[- ]pack|streamliner.*add[- ]on|streamline car|streamline.*4[- ]pack|amtrak streamline|heavyweight car add|streamline car add|streamliner add|lounge car|business car|dorm[ -]buffet|state solarium|bi[ -]?level gallery|gallery car|commuter|training car|18["”] .*car|21["”] .*car|22["”] .*car|amtrak phase|doom car|doom liner|theater car|wifi theater|crew car|racing crew|auxiliary power|banquet car|sleeping car|wood chapel|rider car|exhibit car|exhibition car|m-10000|m-10001|fleet of modernism|\bb60\b|\bb60bh\b|strasburg.*b60|excursion car|kitchen car|kitchen w\//i.test(hay)) return 'Passenger Car';
      if (/^\s*tender\s*$|^crane tender$|tender car/i.test(sub) || /^\s*tender\s*$/i.test(desc)) return 'Tender';
      if (/motor car/i.test(hay)) return 'Motorized Unit';
      if (/race car track section|track section/i.test(hay)) return 'Accessory';
      if (/set expansion|train pack|3[- ]?pack|2[- ]?pack|4[- ]?pack freight|four[- ]?pack freight|consist.*pack|m-10000.*set|m-?10001.*set|rolling stock.*pack|train set|disconnect work car 4|disconnect.*4[- ]?pack/i.test(hay)) return 'Set';
      if (/caboose|\bn5 cabin|\bn8 cabin|cabin car/i.test(hay)) return 'Caboose';

      // Body-style buckets
      if (/operating|searchlight|floodlight|magnetic crane|cop and hobo|cop & hobo|hobo car|giraffe|aquarium|exploding|missile|rocket launcher|helicopter|radar|television|brakeman|coal dump|log dump|operating log|barrel car|milk car|culvert|moe|joe|merchandise car|automatic gateman|operating crane|dispatch board|news car|power shovel|generator car|mercury capsule|aerial target|capsule launching|launching car|snow plow|track maintenance|maintenance car|mine car|track cleaning car|frontier search|electric derrick|hot metal|torpedo car|bunk car|tool car|derrick car|with crane|with shovel|security car|ice car|calliope|toy soldier car|circus car|radioactive waste|condenser car|reactor fluid|mini[- ]?max|harold the helicopter|harold helicopter|tv car|television car|toxic waste|cherry picker|peekaboo|wayne enterprises|exorcist|disconnect car|fire car|fire prevention|polar express present|polar express hot chocolate|polar express transport|trailer home|halloween|christmas car|bullion car|platinum car|chicken car|poultry car|fire ladder|target launcher|fire instruction|animated|foghorn|porky pig|daffy duck|warner bros|balloon car|safes|with safes|boom car|with cannon|allis-chalmers car|space launch|sledex|hot chocolate thermos|thermos car|present unloading|present transport|christmas present|christmas music|big snow plow|j\.?p\.? holland|deep sea challenger|operation eagle|shark fin|big cannon|atomic|nuclear|nuclear waste|holland submarine|ammunition car|with safes|with dragster|skiing|ski train|ski[- ]train|exhibition car|fang.*snake|snake.*exhibition|psychedelic|m-10000.*power|fourth of july|christmas hot chocolate|space launch|capsules|capsule.*car|sub.*car|^crane[ ,]|biohazard|tie work|tie work car|\bmow\b|welding car|welding|merry.*bright|hot cocoa|hot chocolate car|north pole.*icing|santa.*favorites|hunting rabbit|sheriff.*outlaw|conductor announcement|abandoned toy|poultry dispatch|sweep car|gift car|merry.*car|fire fighting/i.test(hay)) return 'Operating Freight';
      if (/\bdump car\b|\bcrane car\b|\bsearchlight\b/i.test(hay)) return 'Operating Freight';
      if (/cattle/i.test(hay)) {
        if (/operating|moving|automatic|3656|3356|3370|6356/i.test(hay)) return 'Operating Freight';
        return 'Stock Car';
      }
      if (/stock car|elephant car|horse car|reindeer car|vision.*horse/i.test(hay)) return 'Stock Car';
      if (/well car|twin[- ]stack|maxi[- ]?iv|maxi[- ]?stack|auto carrier|articulated auto|tractor trailer|container car|\bcontainers?\b|intermodal|piggy[- ]?back|tofc|cofc|front runner|trailer train|45ft pines|nw heritage|with .*trailers|with two trailers|husky stack|husky double|double[- ]stack|enclosed auto rack|auto rack|with sears trailer|with fedex trailer|with red wing.*trailer|with armstrong.*trailer|with grumman trailer|with new holland trailer|with campbell.*trailer|with navajo trailer|45th anniversary trailer|115th anniversary trailer|ford new holland trailer|with .*trailer.*1\/48|trailer.*lcca/i.test(hay)) return 'Intermodal';
      if (/tank car|tankcar|single[ -]?dome|triple[ -]?dome|double[ -]?dome|three[ -]?dome|two[ -]?dome|four[ -]?dome|vat car|oil car|liquefied gas|heat exchanger|helium tank load|chemical tank|ammonia|liquid oxygen|tank train car|water tank car|tanktrain|tank train intermediate|three-dome|two-dome|utlx/i.test(hay)) return 'Tank Car';
      if (/coalveyor/i.test(hay)) return 'Gondola';
      if (/hopper|ore car|coalporter|sand car|coal car|ballast car|icebreaker|ice breaker|\bslag\b|with coal load|coal load/i.test(hay)) return 'Hopper';
      if (/gondola|gon car/i.test(hay)) return 'Gondola';
      if (/flat[- ]?car|flatcar|pulpwood|coil steel|bulkhead|depressed center|skeleton car|log car|crane flatcar|automobile flat|piggy[- ]?back flat|tofc flat|with trailer|with logs|with fences|with fence|with corvettes|with j\.?b\.? hunt|with stakes|with horses|with crates|with submarine|with usn|with u\.s\.n|with royal navy|with bulldozer|with scraper|with helium|with two corvettes|with wheel|with rail|with wood|with boat|with ladder|with usmc|with u\.s\.m\.c|with two u\.s\.m\.c|with two .*tank|wooden dowel logs|ramp car|center beam|barrel ramp|machine car|with motor|with snowmobile|with tank|with water tank|fire rescue|with farm tractor|with auto|with autos|with automobile|with vans|with truck|with trucks|with car|with sears|with fedex|with red wing|with new holland|with ertl|with corgi|with airplane|with beechcraft|with plymouth|with dodge viper|with caterpillar|with timbers|with bonanza|with vipers|with vw|with volkswagen|with prowler|with sedans|with coupes|with station wagons|with pickups|with auto frames|with two trucks|with two coupes|with mack truck|with tow truck|with milk truck|with load|with tractor|auto loader|boat loader|wheel car|sedan numbered|coupe numbered|with two red sedans|with two wagons|with propellers|with pickup truck|with two autos|with grumman|with campbell|with navajo|with armstrong|with cnw|with chicago.*northwestern|^fences[ ,]|\bbeechcraft\b|\bbonanzas?\b|\bvipers?\b|\bsedans?\b|\bcoupes?\b|station wagons?|\bpickups?\b|tow truck|mack truck|milk truck|touring coupes?|\bdragsters?\b|recovery with|uni[- ]?body|numbered 6411|numbered 6424|numbered 6429|numbered 9823|with a pair|with a ford|with two|wheel load|rail load|safe block|cable reel|numbered 6561|6561.*cable/i.test(hay)) return 'Flatcar';
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

    // Anything else: pass through itemType so synthetic sub-tab items still render correctly
    return it || 'Other';
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
  };

  function getBucketIcon(item) {
    if (typeof getTypeBucketLabel !== 'function') return 'engine';
    return BUCKET_TO_ICON[getTypeBucketLabel(item)] || 'engine';
  }

  // Expose globally
  window.TYPE_BUCKETS = TYPE_BUCKETS;
  window.MANUAL_TYPE_OVERRIDES = MANUAL_TYPE_OVERRIDES;
  window.getTypeBucket = getTypeBucket;
  window.getTypeBucketLabel = getTypeBucketLabel;
  window.BUCKET_TO_ICON = BUCKET_TO_ICON;
  window.getBucketIcon = getBucketIcon;
})();
