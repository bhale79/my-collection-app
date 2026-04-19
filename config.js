// ═══════════════════════════════════════════════════════════════
// config.js — Shared constants (loaded before all other scripts)
// If more than one file needs a constant, it goes HERE.
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = 'v0.9.124';
const APP_DATE    = 'April 2026';

// ── Master catalog sheet ID (read-only, shared across all users) ──
const MASTER_SHEET_ID = '1Y9-cg8C1CkIqy0RQ66DfP7fmGrE3IGBpyJbtdfYx8q0';

// ── Admin config ──
const ADMIN_EMAIL  = 'bhale@ipd-llc.com';
const ADMIN_EMAILS = ['bhale@ipd-llc.com'];

// ── Era definitions ──
const ERAS = {
  prewar: { id: 'prewar', label: 'Pre-War',     years: '1901-1942',  prefix: 'Lionel Pre-War', manufacturer: 'Lionel' },
  pw:     { id: 'pw',     label: 'Postwar',     years: '1945-1969',  prefix: 'Lionel PW',      manufacturer: 'Lionel' },
  mpc:    { id: 'mpc',    label: 'MPC/Modern',  years: '1970-Today', prefix: 'Lionel',         manufacturer: 'Lionel' },
  atlas:  { id: 'atlas',  label: 'Atlas O',     years: 'All',        prefix: 'Atlas O',        manufacturer: 'Atlas' },
};

// ── Master sheet tab names per era ──
const ERA_TABS = {
  prewar: {
    items:    'Pre-War',
    catalogs: 'Lionel Pre-War - Catalogs',
  },
  pw: {
    items:        'Lionel PW - Items',
    boxes:        'Lionel PW - Boxes',
    science:      'Lionel PW - Science',
    construction: 'Lionel PW - Construction',
    paper:        'Lionel PW - Paper',
    other:        'Lionel PW - Other',
    serviceTools: 'Lionel PW - Service Tools',
    catalogs:     'Lionel PW - Catalogs',
    companions:   'Lionel PW - Companions',
    sets:         'Lionel PW - Sets',
    instrSheets:  'Lionel PW - Instruction Sheets',
  },
  mpc: {
    items:    'MPC-Modern',
    catalogs: 'MPC-Modern - Catalogs',
  },
  atlas: {
    items:    'Atlas O',
  },
};

// ── Keys that hold browseable master inventory (not catalogs/companions/sets/IS) ──
const MASTER_TAB_KEYS = ['items','boxes','science','construction','paper','other','serviceTools'];

// ── Default wizard category visibility ──
const DEFAULT_WIZARD_CATEGORIES = {
  lionel: true,
  set: true,
  paper: true,
  mockups: false,
  other: false,
  manual: true,
};


// ── Search aliases: abbreviations & nicknames → canonical road names ──
// Bidirectional: typing the key OR any value will match all entries in the group.
// Each array is a group of terms that should all match each other.
const SEARCH_ALIAS_GROUPS = [
  ['prr', 'pennsylvania', 'pennsy'],
  ['nyc', 'new york central'],
  ['b&o', 'bo', 'b and o', 'baltimore and ohio'],
  ['c&o', 'co', 'c and o', 'chesapeake and ohio'],
  ['at&sf', 'atsf', 'santa fe'],
  ['up', 'union pacific'],
  ['sp', 'southern pacific'],
  ['np', 'northern pacific'],
  ['gn', 'great northern'],
  ['bn', 'burlington northern'],
  ['bnsf', 'burlington northern santa fe'],
  ['fm', 'fairbanks-morse', 'fairbanks morse'],
  ['mkt', 'katy', 'missouri-kansas-texas', 'missouri kansas texas'],
  ['nkp', 'nickel plate', 'nickel plate road'],
  ['drgw', 'd&rgw', 'denver and rio grande western', 'rio grande'],
  ['dlw', 'dl&w', 'lackawanna', 'delaware lackawanna'],
  ['l&n', 'ln', 'louisville and nashville'],
  ['n&w', 'nw', 'norfolk and western'],
  ['ns', 'norfolk southern'],
  ['cn', 'canadian national'],
  ['cp', 'canadian pacific'],
  ['cpr', 'cp rail'],
  ['ic', 'illinois central'],
  ['icg', 'illinois central gulf'],
  ['ri', 'rock island'],
  ['wp', 'western pacific'],
  ['wm', 'western maryland'],
  ['acl', 'atlantic coast line'],
  ['fec', 'florida east coast'],
  ['gm&o', 'gmo', 'gulf mobile and ohio'],
  ['el', 'erie-lackawanna', 'erie lackawanna'],
  ['nh', 'new haven'],
  ['pc', 'penn central'],
  ['cr', 'conrail'],
  ['csx'],
  ['mp', 'missouri pacific', 'mopac'],
  ['tp&w', 'tpw', 'tp and w', 'toledo peoria and western'],
  ['dt&i', 'dti', 'dt and i', 'detroit toledo and ironton'],
  ['dm&ir', 'dmir', 'dm and ir', 'duluth missabe and iron range'],
  ['rea', 'railway express agency'],
  ['pfe', 'pacific fruit express'],
  ['milw', 'milwaukee road'],
  ['soo', 'soo line'],
  ['frisco', 'slsf'],
  ['cnw', 'c&nw', 'chicago and northwestern'],
  ['cb&q', 'cbq', 'burlington'],
  ['l&n', 'ln', 'louisville and nashville'],
  ['gg1', 'gg-1'],
  ['usmc', 'united states marine corps', 'u.s. marines', 'us marines'],
  ['usn', 'u.s. navy', 'us navy'],
  ['usa', 'u.s. army', 'us army'],
];

// Build a fast lookup: lowercase term → set of all terms in its group
var SEARCH_ALIASES = {};
(function() {
  SEARCH_ALIAS_GROUPS.forEach(function(group) {
    var allTerms = group.map(function(t) { return t.toLowerCase(); });
    allTerms.forEach(function(term) {
      SEARCH_ALIASES[term] = allTerms;
    });
  });
})();

// Right-side-view placeholder image (base64 PNG) — used in wizard photo steps, dashboard, reports
const _RSV_PLACEHOLDER_PNG = 'data:image/png;base64,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';
