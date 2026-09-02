// ============================================================
//  maintenance.js — 🔧 Maintenance panel (v0.9.1639, Session 90)
//  OWNER-ONLY (admin preview): the button renders only when the
//  signed-in email is on MAINT.OWNER_EMAILS. Everyone else's app
//  is untouched — delete this ONE file + its index.html line to
//  remove the feature.
//
//  Phase 1 of MAINTENANCE_SUITE_SPEC_2026-09-01.md:
//    • Docs — parts diagrams / service manuals search links per maker
//    • Videos — YouTube search builder w/ favorite channels
//    • Parts search — dealer-neutral Google query w/ favorite dealers
//  NO sheet writes of any kind. Favorites live in localStorage via
//  _prefGet/_prefSet (per-device — fine for the admin preview; they
//  move to the personal sheet if this ever ships to users).
// ============================================================
(function () {
  'use strict';

  var MAINT = {
    OWNER_EMAILS: ['bhale@ipd-llc.com', 'support@therailroster.com'],
    PREF_CHANNELS: 'maint_yt_channels',   // JSON array of channel names
    PREF_DEALERS:  'maint_parts_dealers', // JSON array of dealer names
  };

  function _isOwner() {
    try {
      var em = window.state && state.user && String(state.user.email || '').toLowerCase();
      return !!em && MAINT.OWNER_EMAILS.indexOf(em) >= 0;
    } catch (e) { return false; }
  }
  window._maintIsOwner = _isOwner;   // app-collection.js gates the button on this

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── favorites (per-device prefs) ─────────────────────────────
  function _favs(key) {
    try {
      var v = (typeof _prefGet === 'function') ? _prefGet(key, '[]') : '[]';
      var a = JSON.parse(v);
      return Array.isArray(a) ? a.filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function _saveFavs(key, arr) {
    try { if (typeof _prefSet === 'function') _prefSet(key, JSON.stringify(arr)); }
    catch (e) { /* prefs unavailable — favorites just don't persist */ }
  }

  // ── v0.9.1638: LCCA Postwar Service Manual — item → PDF map ──
  // Harvested 2026-09-01 from the LCCA members' archive INDEX pages
  // (books 1-4) through Brad's member session: file → the catalog
  // numbers its section covers. We store ONLY links; the PDFs live on
  // lionelcollectors.org behind LCCA's own member login.
  var PWSM_BASE = 'https://www.lionelcollectors.org/docs/default-source/hda/holtmann2/pwsm/';   // v0.9.1639: the pwsm/ folder was missing -> every PDF 404'd
  var PWSM_HOME = 'https://www.lionelcollectors.org/hda/holtmann2/vols/pwsm';
  var PWSM_FILES = {
    'acc_1047': '1047',
    'acc_114': '114',
    'acc_115': '115',
    'acc_118': '118',
    'acc_125': '125',
    'acc_128': '128',
    'acc_132': '132',
    'acc_133': '133',
    'acc_138': '138',
    'acc_140': '140',
    'acc_145': '145',
    'acc_147': '147',
    'acc_151': '151',
    'acc_153': '153',
    'acc_154': '154',
    'acc_155': '155',
    'acc_157': '157',
    'acc_161': '161',
    'acc_163': '163',
    'acc_167': '167C',
    'acc_175': '175',
    'acc_182': '182',
    'acc_192': '192',
    'acc_193': '193',
    'acc_195': '195',
    'acc_197': '197',
    'acc_199': '199',
    'acc_252': '252',
    'acc_253': '253',
    'acc_256': '256',
    'acc_257': '257',
    'acc_262': '262',
    'acc_264': '264',
    'acc_282': '282',
    'acc_299': '299',
    'acc_30': '30',
    'acc_313': '313',
    'acc_334': '334',
    'acc_342': '342',
    'acc_345': '345',
    'acc_346': '346',
    'acc_35': '35',
    'acc_350': '350',
    'acc_352': '352',
    'acc_353': '353',
    'acc_356': '356',
    'acc_362': '362',
    'acc_364': '364',
    'acc_365': '365',
    'acc_375': '375',
    'acc_394': '394',
    'acc_395': '395',
    'acc_397': '397',
    'acc_410': '410',
    'acc_413': '413-1,419',
    'acc_415': '415',
    'acc_445': '445',
    'acc_448': '0480,448',
    'acc_450': '450',
    'acc_452': '452',
    'acc_455': '455',
    'acc_456': '456',
    'acc_460': '460',
    'acc_462': '462',
    'acc_464': '464',
    'acc_465': '465',
    'acc_470': '470',
    'acc_494': '494',
    'acc_497': '497',
    'acc_50': '50',
    'acc_52': '52',
    'acc_60': '60',
    'acc_6827': '6827-100',
    'acc_69': '69',
    'acc_70': '70,71',
    'acc_89': '89',
    'acc_91': '91',
    'acc_943': '943',
    'acc_97': '97',
    'ho_acc_0050': '0050',
    'ho_acc_0114': '0114,0118',
    'ho_acc_0117': '0117',
    'ho_acc_0140': '0140',
    'ho_acc_0145': '0145',
    'ho_acc_0197': '0197',
    'ho_acc_0282': '0282',
    'ho_acc_0300': '0300,0301',
    'ho_acc_0494': '0494',
    'ho_acc_0900': '0900',
    'ho_acc_0922': '0922,0923',
    'ho_loc_0054': '0054,0055,0057,0058,0561',
    'ho_loc_0056': '0056',
    'ho_loc_0059': '0059,0568',
    'ho_loc_0068': '0068,0068-100,0068-50',
    'ho_loc_0500': '0500',
    'ho_loc_0501': '0501,0504',
    'ho_loc_0502': '0502,0505',
    'ho_loc_0503': '0503',
    'ho_loc_0535': '0535W',
    'ho_loc_0536': '0536P,0555P,0569P,0571P',
    'ho_loc_0545': '0545',
    'ho_loc_0561': '0561-1',
    'ho_loc_0564': '0564,0565,0566,0567',
    'ho_loc_0581': '0581,0591,0593,0595,0596,0597,0598',
    'ho_loc_0600': '0600',
    'ho_loc_0602': '0602',
    'ho_loc_0605': '0605',
    'ho_loc_0610': '0610',
    'ho_loc_0625': '0625',
    'ho_loc_0626': '0626',
    'ho_loc_0635': '0635',
    'ho_loc_0642': '0642',
    'ho_noc_0700': '0700',
    'ho_noc_0723': '0723,0725',
    'ho_noc_0800': '0800-200,0801-200,0806-10,0807-1',
    'ho_noc_0805': '0805-1',
    'ho_noc_0808': '0808-1,0875-1',
    'ho_noc_0810': '0810,0815-50,0815-85',
    'ho_noc_0813': '0813',
    'ho_noc_0815': '0815-200,0834-1,0836-1',
    'ho_noc_0816': '0816,0836-110,0837-100,0838-100',
    'ho_noc_0817': '0817',
    'ho_noc_0819': '0819',
    'ho_noc_0821': '0821,0823,0842',
    'ho_noc_0836': '0836-100,0861-100,0865-350,0865-375,0865-400',
    'ho_noc_0841': '0841-150,0845-1,0847-100,0847-110,0850-100',
    'ho_noc_0847': '0847',
    'ho_noc_0850': '0850,0861,0863',
    'ho_noc_0860': '0860-200,0866-200',
    'ho_noc_0862': '0862-200,0865-200,0865-225,0865-250',
    'ho_noc_0864': '0864-300,0864-325,0864-350,0864-400,0864-900',
    'ho_noc_0870': '0870-1',
    'ho_noc_0872': '0872-200',
    'ho_noc_0880': '0880',
    'ho_noc_0889': '0889',
    'ho_oc_0039': '0039',
    'ho_oc_0319': '0319',
    'ho_oc_0333': '0333',
    'ho_oc_0337': '0337',
    'ho_oc_0349': '0349,0370',
    'ho_oc_0357': '0357',
    'ho_oc_0365': '0365',
    'ho_oc_0366': '0366',
    'ho_ps_0100': '0100',
    'ho_ps_0101': '0101,0103,0121',
    'ho_ps_0102': '0102',
    'ho_ps_0104': '0104',
    'ho_ps_0106': '0106',
    'ho_ps_0150': '0150',
    'ho_ps_0181': '0181',
    'loc_1050': '1050',
    'loc_1055': '1055-1',
    'loc_1060': '1060',
    'loc_1061': '1061',
    'loc_1061-50': '1061-50,1062-60',
    'loc_1062': '1062',
    'loc_1066': '1066',
    'loc_1101': '1101',
    'loc_1110': '1110',
    'loc_1120': '1120,6110',
    'loc_1615': '1615,1625',
    'loc_1654': '1654',
    'loc_1655': '1655',
    'loc_1656': '1656',
    'loc_1665': '1665',
    'loc_1666': '1666',
    'loc_1666e': '1666E',
    'loc_1862': '1862,1872,1882',
    'loc_200': '200',
    'loc_200c': '218C,224C,266C',
    'loc_200p': '202A,204A,205A,208A,209A,210A,212A,216A',
    'loc_200t': '204T,205T,208T,209T,210T',
    'loc_2016': '2016,2018',
    'loc_2023': '2023',
    'loc_2023p': '2023A,2031A,2032A,2033A',
    'loc_2023t': '2023T,2031T,2032T,2033T',
    'loc_2026': '2026',
    'loc_2029': '2029',
    'loc_2034': '1130,2034',
    'loc_2035': '2035',
    'loc_2036': '2036,2037',
    'loc_2056': '2056',
    'loc_211': '211',
    'loc_212p': '212P',
    'loc_212t': '212T',
    'loc_213p': '213P,215P',
    'loc_213t': '213T,239,240',
    'loc_217c': '217C,226C',
    'loc_217p': '1055,217P,218P,219P,220P,224P,225P,226P,227P,228P',
    'loc_217t': '218T,219',
    'loc_2200': '2240,2242,2243,2245',
    'loc_2200t': '2240C,2242C,2243C',
    'loc_220t': '220T',
    'loc_221': '221',
    'loc_221p': '221P',
    'loc_222p': '222P',
    'loc_223p': '223P,229C',
    'loc_224': '224',
    'loc_2245': '2245C',
    'loc_224e': '224E',
    'loc_2300': '2363,2368,2373,2378,2379,2383',
    'loc_2321': '2321,2331,2341',
    'loc_2328': '2028,2328,2337,2338,2339,2348',
    'loc_2329': '2329',
    'loc_232p': '232P',
    'loc_233': '233,235,236',
    'loc_2330': '2330,2340,2360',
    'loc_2332': '2332',
    'loc_2333': '2333,2334',
    'loc_2343c': '2343C,2344C',
    'loc_2343p': '2343P,2344P,2345P',
    'loc_2343t': '2343T,2344T,2345T',
    'loc_2350': '2350,2351,2352,2358',
    'loc_2353p': '2353P,2355P,2356P,2454P',
    'loc_2356c': '2356C',
    'loc_2363c': '2363C,2368C,2378C,2379C',
    'loc_2363p': '2363P,2367P,2368P,2373P,2378P,2379P,2383P',
    'loc_2363t': '2373T,2383T',
    'loc_2365': '2365',
    'loc_237': '237,238',
    'loc_242': '242',
    'loc_243': '243,244',
    'loc_245': '245',
    'loc_246': '246',
    'loc_247': '247',
    'loc_249': '249,250',
    'loc_400': '400,404',
    'loc_41': '41,42,51,53,56',
    'loc_44': '44,45',
    'loc_520': '520',
    'loc_54': '54',
    'loc_55': '55',
    'loc_58': '58',
    'loc_59': '59-1',
    'loc_600': '600,601,602,610,611,613,614,616,621',
    'loc_617': '617',
    'loc_622': '622,6220',
    'loc_623': '623,624,6250',
    'loc_625': '625,626,627,629',
    'loc_633': '633',
    'loc_634': '634',
    'loc_646': '2046,646',
    'loc_65': '65',
    'loc_665': '2055,2065,665,685',
    'loc_671': '2020,671,671R,681',
    'loc_675': '2025,675',
    'loc_68': '68',
    'loc_726': '726',
    'loc_736': '736',
    'loc_746': '746',
    'loc_773': '773',
    'noc_1800': '1800',
    'noc_1887': '1887,6219',
    'noc_2400': '2400',
    'noc_2500': '2500',
    'noc_2550': '2550,2559',
    'noc_3460': '3460',
    'noc_6014': '6014,6024,6044',
    'noc_6014-325': '6014-325',
    'noc_6014-335': '6014-335',
    'noc_6015': '6015,6025,6045,6315',
    'noc_6017': '6017,6027,6047,6057,6257',
    'noc_6050': '6050,6058,6059,6067,6130,6343,6404,6405,6406,6416',
    'noc_6111': '6111,6121,6175,6262',
    'noc_6119': '6119',
    'noc_6120': '6119-110,6120',
    'noc_6121': '6121-60',
    'noc_6142-100': '6142,6142-100,6142-125,6142-150,6142-175,6142-75',
    'noc_6162': '6162,6162-100,6167-100,6167-125,6167-150,6176-25',
    'noc_6167': '6167-25,6167-50,6315-60,6407-1',
    'noc_6176': '6176-50,6176-75,6401-1,6401-50,6402-50',
    'noc_6264': '6264,6311,6342',
    'noc_6357': '6357',
    'noc_6361': '6361,6428,6475',
    'noc_6362': '6362,6418',
    'noc_6376': '6376',
    'noc_6408': '6408,6414-150,6436-110',
    'noc_6413': '6413,6437,6463',
    'noc_6414-85': '6414-85,6437-25,6476-125,6476-135,6502-75',
    'noc_6415': '6415,6465,6555',
    'noc_6415a': '6425',
    'noc_6417': '6417,6427',
    'noc_6419': '6419',
    'noc_6424': '6424,6467,6477',
    'noc_6430': '6430',
    'noc_6434': '6434',
    'noc_6440': '6440,6445',
    'noc_6440-50': '6440-50,6465-150,6469-1,6469-50',
    'noc_6446': '6436,6446',
    'noc_6447': '6429,6447',
    'noc_6448': '6448,6480',
    'noc_6456': '6456,6476,6536,6636',
    'noc_6460': '2460,6460,6560',
    'noc_6464': '6464',
    'noc_6468': '6468',
    'noc_6470': '6470',
    'noc_6482': '6352,6482,6572',
    'noc_6500': '6500-1,6501,6502',
    'noc_6502': '6502-50,6536-25',
    'noc_6511': '6511,6518,6519,6561',
    'noc_6517': '6517,6527',
    'noc_6519-1': '6519-1',
    'noc_6530': '6530,6736',
    'noc_6536-1': '6536-1',
    'noc_6556': '6556',
    'noc_6557': '6557,6657',
    'noc_6646': '6646',
    'noc_6650': '6630,6640,6650',
    'noc_6660': '6660',
    'noc_6672': '6672',
    'noc_6800': '6800,6801,6802,6803,6804,6806,6807,6808,6809,6810,6812,6816,6817,6818,6819,6821,6823,6825,6826,6844',
    'noc_6805': '6805',
    'noc_6814': '6814-1',
    'noc_6820': '6820,6824',
    'noc_6822': '6822',
    'noc_6827': '6827,6828',
    'oc_3309': '3309',
    'oc_3330': '3330',
    'oc_3356': '3356',
    'oc_3357': '3357',
    'oc_3359': '3359',
    'oc_3360': '3360',
    'oc_3361': '3361',
    'oc_3362': '3362',
    'oc_3366': '3366',
    'oc_3370': '3370',
    'oc_3376': '3376,3386',
    'oc_3409': '3409,3410,3419,3429',
    'oc_3413': '3413',
    'oc_3424': '3424',
    'oc_3428': '3428',
    'oc_3434': '3434',
    'oc_3435': '3435',
    'oc_3444': '3444',
    'oc_3456': '3456',
    'oc_3461': '3451,3461',
    'oc_3462': '3462',
    'oc_3464': '3464,3474,3484',
    'oc_3469': '3459,3469',
    'oc_3472': '3472',
    'oc_3482': '3482',
    'oc_3496': '3494',
    'oc_3509': '3509,3519',
    'oc_3512': '3512',
    'oc_3520': '3520,3620',
    'oc_3530': '3530',
    'oc_3535': '3535',
    'oc_3540': '3540',
    'oc_3545': '3545',
    'oc_3562': '3562',
    'oc_3619': '3619',
    'oc_3656': '3656',
    'oc_3662': '3662',
    'oc_3665': '3665',
    'oc_3927': '3927',
    'oc_6512': '6512',
    'oc_6544': '6544',
    'phono_12': '12,14',
    'phono_39': '39A,700,710',
    'ps_1010': '1010,1025',
    'ps_1011': '1011,1012,1014',
    'ps_1015': '1015,1016,1026',
    'ps_1032': '1032,1032M,1033,1232',
    'ps_1034': '1034',
    'ps_1041': '1041',
    'ps_1043': '1043,1043M,1073',
    'ps_1044': '1044',
    'ps_1053': '1053,1063',
    'ps_1144': '1144',
    'ps_a': 'A',
    'ps_kw': 'KW',
    'ps_lw': 'LW',
    'ps_r': 'R',
    'ps_rw': 'RW',
    'ps_rx': 'RX',
    'ps_s': 'S',
    'ps_sw': 'SW',
    'ps_tw': 'TW',
    'ps_v': 'V',
    'ps_vw': 'VW',
    'ps_zwr': 'ZW,ZWR',
    'rac_5200': '5200',
    'rac_5201': '5201',
    'rac_5202': '5202',
    'rac_5210': '5210,5211',
    'rac_5501': '5501',
    'rac_5502': '5502',
    'rac_acc_5151': '5151,5155,5450',
    'rac_acc_5425': '5135-25,5425-25',
    'rac_acc_5451': '5451',
    'rac_ps_5300': '5300',
    'rac_ps_5301': '5301,5302',
    'rac_ps_5303': '5303',
    'stc_022': '022',
    'stc_042': '042',
    'stc_1022': '1022',
    'stc_1024': '1024',
    'stc_112': '112',
    'stc_1121': '1121',
    'stc_1122': '1122',
    'stc_1122e': '1122E',
    'stc_112r': '112R',
    'stc_142': '142,142R',
    'te_5c': '5C',
    'te_5d': '5D',
    'te_5f': '5F',
    'ten_1862t': '1862T,1872T',
    'ten_234w': '234W',
    'ten_242t': '1061T-50,1062T-25,242T',
    'ten_243w': '243W,736W',
    'ten_244t': '1060T,1882T,244T',
    'ten_2671w': '2671W',
    'ten_6026': '6026T,6026W',
    'ten_b': '2403B,6403B',
    'ten_t': '1001T,1130T,1615T,247T,250T,6001T,6066T',
    'ten_w': '1654W,2020W,2046W,221W,2426W,2466W,6020W,6466W,6654W,671W,746W',
  };
  var _pwsmLookup = null;
  function _pwsmFile(num) {
    if (!_pwsmLookup) {
      _pwsmLookup = {};
      Object.keys(PWSM_FILES).forEach(function (f) {
        PWSM_FILES[f].split(',').forEach(function (n) {
          if (n && _pwsmLookup[n] == null) _pwsmLookup[n] = f;
        });
      });
    }
    var n = String(num == null ? '' : num).trim().toUpperCase().replace(/^X/, '');
    if (!n) return null;
    if (_pwsmLookup[n]) return _pwsmLookup[n];                      // exact (protects 2343C etc.)
    var noSub = n.replace(/-\d+$/, '');                             // 6142-75 → 6142
    if (noSub !== n && _pwsmLookup[noSub]) return _pwsmLookup[noSub];
    var noSuf = noSub.replace(/[A-Z]+$/, '');                       // 2046W → 2046 (only after exact miss)
    if (noSuf && noSuf !== noSub && _pwsmLookup[noSuf]) return _pwsmLookup[noSuf];
    return null;
  }

  // ── which maker's docs? (era key → docs route) ───────────────
  // Era stamps are facts (see _itemEraKey); numbers are not identities.
  function _docsRoute(eraKey) {
    var e = String(eraKey || '').toLowerCase();
    // v0.9.1636 (Brad): postwar/prewar docs are NOT on lionelsupport (it
    // skews modern) — they live in the LCCA members' digital archive
    // (Postwar Service Manual 1945-69). LCCA handles its own login; the
    // browser's cookie keeps members signed in. We never store credentials.
    if (e === 'pw' || e === 'prewar') return 'lcca';
    if (e === 'mpc' || e === 'mod' || e === 'kline') return 'lionel';
    if (e.indexOf('mth') === 0) return 'mth';
    if (e.indexOf('atlas') === 0) return 'atlas';
    return 'generic';
  }
  function _makerName(item, eraKey) {
    try {
      if (typeof _manufacturerOfItem === 'function') {
        var m = _manufacturerOfItem(item);
        if (m) return String(m);
      }
    } catch (e) { /* fall through */ }
    var r = _docsRoute(eraKey);
    if (r === 'lionel') return 'Lionel';
    if (r === 'mth') return 'MTH';
    if (r === 'atlas') return 'Atlas';
    return '';
  }

  // ── the item's search-friendly name ──────────────────────────
  // Video titles say "lionel 665 steam engine", never "6-XXXXX" —
  // so use baseItemNum + the first clause of the description.
  function _shortName(item) {
    var d = String(item && (item.description || item.itemName || item.name) || '')
      .replace(/\([^)]*\)/g, '').split(/[—|,.;]/)[0].trim()
      .split(/\s+/).slice(0, 5).join(' ');
    return d;
  }
  function _baseNum(item) {
    var n = String(item && item.itemNum || '').trim();
    try { if (typeof baseItemNum === 'function') return baseItemNum(n) || n; } catch (e) {}
    return n;
  }

  // ── URL builders (all open in a new tab; no API keys anywhere) ─
  function _docsUrl(route, item) {
    var num = String(item && item.itemNum || '').trim();
    if (route === 'lcca') {
      var pf = _pwsmFile(num);
      return pf ? (PWSM_BASE + pf + '.pdf') : PWSM_HOME;
    }
    if (route === 'lionel')
      return 'https://www.lionelsupport.com/service-documents/index.cfm?doAction=search&keywords=' + encodeURIComponent(num);
    if (route === 'mth')
      return 'https://mthpartsandsales.com/search?q=' + encodeURIComponent(num);
    if (route === 'atlas')
      return 'https://shop.atlasrr.com/t-partsdiagrams.aspx';
    // generic: a plain web search for this maker's docs
    var maker = _makerName(item, null);
    return 'https://www.google.com/search?q=' + encodeURIComponent(
      [maker, num, 'parts diagram OR service manual'].filter(Boolean).join(' '));
  }
  function _ytUrl(channel, item, part, action) {
    var q = ['"' + (_makerName(item, item && item._era) + ' ' + _baseNum(item)).trim() + '"',
             _shortName(item), part, action].filter(Boolean).join(' ').trim();
    if (channel) {
      // channel-scoped search: youtube.com/@Channel/search — real filtering,
      // no API. Channel handles have no spaces; strip them.
      var h = String(channel).replace(/^@/, '').replace(/\s+/g, '');
      return 'https://www.youtube.com/@' + encodeURIComponent(h) + '/search?query=' + encodeURIComponent(q);
    }
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }
  function _partsUrl(dealer, item, part) {
    // Brad 2026-09-01: NO dealer hardcoded — the user names favorites and
    // the query is just quoted pieces: "dealer" "maker" "number" "part".
    var bits = [dealer, _makerName(item, item && item._era), String(item && item.itemNum || '').trim(), part]
      .filter(Boolean).map(function (b) { return '"' + String(b).trim() + '"'; });
    return 'https://www.google.com/search?q=' + encodeURIComponent(bits.join(' '));
  }

  // ── favorites row (shared by Videos + Parts sections) ────────
  function _favRow(prefKey, selectId, label) {
    var favs = _favs(prefKey);
    var opts = '<option value="">' + _esc(label) + '</option>'
      + favs.map(function (f) { return '<option value="' + _esc(f) + '">' + _esc(f) + '</option>'; }).join('');
    return '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">'
      + '<select id="' + selectId + '" style="flex:1;min-width:130px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">' + opts + '</select>'
      + '<button onclick="_maintAddFav(\'' + prefKey + '\',\'' + selectId + '\')" title="Add a favorite" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-size:0.82rem">+ Add</button>'
      + '<button onclick="_maintDelFav(\'' + prefKey + '\',\'' + selectId + '\')" title="Remove the selected favorite" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-size:0.82rem">&minus;</button>'
      + '</div>';
  }
  window._maintAddFav = function (prefKey, selectId) {
    var name = prompt(prefKey === MAINT.PREF_CHANNELS
      ? 'YouTube channel name or @handle (e.g. @TrainRepairGuy):'
      : 'Parts dealer name (e.g. Joe\'s Train Shop):');
    if (!name || !String(name).trim()) return;
    name = String(name).trim();
    var favs = _favs(prefKey);
    if (favs.indexOf(name) < 0) { favs.push(name); _saveFavs(prefKey, favs); }
    var sel = document.getElementById(selectId);
    if (sel) {
      var o = document.createElement('option');
      o.value = name; o.textContent = name; sel.appendChild(o); sel.value = name;
    }
  };
  window._maintDelFav = function (prefKey, selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || !sel.value) return;
    var favs = _favs(prefKey).filter(function (f) { return f !== sel.value; });
    _saveFavs(prefKey, favs);
    sel.remove(sel.selectedIndex);
    sel.value = '';
  };

  // ── the panel ────────────────────────────────────────────────
  var _panelItem = null;

  window._maintOpenPanel = function (idx, itemNum, variation, invId) {
    // invId = Brad's OWNED copy (inventoryId — the per-unit identity that
    // phase 2's parts/history will key on). itemNum+variation = the CATALOG
    // identity (catalog rows have no inventoryId; docs/videos live there).
    if (!_isOwner()) return;
    // v0.9.1637 (Brad's No. 53 opening as an MTH 30-1469-1): the panel was
    // trusting the POSITIONAL idx — stability rule #4 says identity, never
    // position. The number+variation is the identity; idx is only a hint
    // that must AGREE with it, or it is ignored.
    var want = String(itemNum == null ? '' : itemNum).trim();
    var wantVar = String(variation == null ? '' : variation).trim();
    var item = null;
    var cand = (window.state && state.masterData && idx >= 0) ? state.masterData[idx] : null;
    if (cand && (!want || String(cand.itemNum || '').trim() === want)) item = cand;
    if (!item && want && window.state && state.masterData) {
      item = state.masterData.find(function (m) {
        return m && String(m.itemNum || '').trim() === want
            && (!wantVar || String(m.variation || '').trim() === wantVar);
      }) || state.masterData.find(function (m) {
        return m && String(m.itemNum || '').trim() === want;
      }) || null;
    }
    if (!item && window._lastDetailPdKey && state.personalData) item = state.personalData[window._lastDetailPdKey];
    if (!item) { if (typeof showToast === 'function') showToast('Could not find this item.', 3000, true); return; }
    _panelItem = item;
    window._maintPanelInvId = String(invId == null ? '' : invId);   // phase 2 hook

    var eraKey = null;
    try { eraKey = (typeof _itemEraKey === 'function') ? _itemEraKey(item) : (item._era || item.era || null); } catch (e) {}
    var route = _docsRoute(eraKey);
    var _pwsmHit = (route === 'lcca') ? _pwsmFile(String(item.itemNum || '')) : null;
    var routeLabel = route === 'lcca' ? (_pwsmHit ? 'Service Manual pages for ' + _esc(String(item.itemNum || '')) + ' (LCCA members)' : 'LCCA Postwar Service Manual archive (members)')
                   : route === 'lionel' ? 'Lionel Support (manuals & parts diagrams)'
                   : route === 'mth' ? 'MTH Parts & Sales (diagrams & parts)'
                   : route === 'atlas' ? 'Atlas parts diagrams'
                   : 'Search the web for docs';

    var old = document.getElementById('maint-overlay');
    if (old) old.remove();

    var sec = function (title, inner) {
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1rem;margin-bottom:0.8rem">'
        + '<div style="font-family:var(--font-head);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.6rem">' + title + '</div>'
        + inner + '</div>';
    };
    var linkBtn = 'padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:var(--bg-card);color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600';

    var html = '<div id="maint-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9500;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem" onclick="if(event.target===this)this.remove()">'
      + '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;max-width:560px;width:100%;padding:1.25rem 1.4rem;margin-bottom:2rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.9rem">'
      +   '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;color:var(--text)">🔧 Maintenance — ' + _esc(item.itemNum || '') + (item.roadName ? ' · ' + _esc(item.roadName) : '') + '</div>'
      +   '<button onclick="document.getElementById(\'maint-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer;line-height:1">&times;</button>'
      + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.8rem">Owner preview — only you can see this button.</div>'

      // Docs
      + sec('Manuals &amp; Parts Diagrams',
          '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" style="' + linkBtn + '">' + _esc(routeLabel) + ' →</button>'
          + (route === 'lcca'
            ? ((_pwsmHit ? '<div style="margin-top:0.5rem"><button onclick="window.open(\'' + PWSM_HOME + '\',\'_blank\')" style="padding:0.4rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.78rem;cursor:pointer">Browse the whole archive →</button></div>' : '')
              + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">' + (_pwsmHit ? 'Opens the manual section covering this item straight from the LCCA members\' archive.' : 'No direct section mapped for ' + _esc(String(item.itemNum || '')) + ' — browse the archive volumes.') + ' Requires LCCA membership; sign in once and your browser remembers.</div>')
            : route !== 'generic'
            ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Opens a search for ' + _esc(String(item.itemNum || '')) + ' — pick the parts list or owner\'s manual there.</div>'
            : ''))

      // Videos
      + sec('Repair Videos (YouTube)',
          _favRow(MAINT.PREF_CHANNELS, 'maint-yt-channel', 'All of YouTube')
          + '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">'
          +   '<input id="maint-yt-part" placeholder="part (e.g. e-unit)" style="flex:1;min-width:120px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          +   '<select id="maint-yt-action" style="padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          +     ['repair','replacement','clean','lubricate','troubleshoot','disassemble',''].map(function (a) {
                  return '<option value="' + a + '"' + (a === 'repair' ? ' selected' : '') + '>' + (a || '(no action word)') + '</option>';
                }).join('')
          +   '</select>'
          +   '<button onclick="_maintSearchYt()" style="' + linkBtn + '">Search →</button>'
          + '</div>')

      // Parts search
      + sec('Find a Part (your favorite dealers)',
          _favRow(MAINT.PREF_DEALERS, 'maint-dealer', 'Any dealer')
          + '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">'
          +   '<input id="maint-part-desc" placeholder="part number / description" style="flex:1;min-width:150px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          +   '<button onclick="_maintSearchParts()" style="' + linkBtn + '">Search →</button>'
          + '</div>'
          + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Searches Google as: &quot;dealer&quot; &quot;maker&quot; &quot;item number&quot; &quot;part&quot;</div>')

      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  };

  window._maintSearchYt = function () {
    if (!_panelItem) return;
    var ch = (document.getElementById('maint-yt-channel') || {}).value || '';
    var part = (document.getElementById('maint-yt-part') || {}).value || '';
    var act = (document.getElementById('maint-yt-action') || {}).value || '';
    window.open(_ytUrl(ch, _panelItem, part.trim(), act), '_blank');
  };
  window._maintSearchParts = function () {
    if (!_panelItem) return;
    var dealer = (document.getElementById('maint-dealer') || {}).value || '';
    var part = (document.getElementById('maint-part-desc') || {}).value || '';
    window.open(_partsUrl(dealer, _panelItem, part.trim()), '_blank');
  };
})();
