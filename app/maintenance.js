// ============================================================
//  maintenance.js — 🔧 Maintenance panel (v0.9.1644, Session 91)
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
  // v0.9.1640: per-file sfvrsn version tokens (harvested with the index).
  // Brad's confirmed-working URL form carries the token; token-less
  // navigations from outside the site hit LCCA's login redirect loop.
  var PWSM_TOK = {
    'acc_1047': '4fea6cf0_1',
    'acc_114': '6c61865a_1',
    'acc_115': '8f7419e7_1',
    'acc_118': 'a46441d3_1',
    'acc_125': 'd647fdda_1',
    'acc_128': '827c6ea0_1',
    'acc_132': 'ef30b3b7_1',
    'acc_133': '4d9c2196_1',
    'acc_138': '7a13a019_1',
    'acc_140': 'c302cd36_1',
    'acc_145': 'd4915ce2_1',
    'acc_147': 'f75b4c1_1',
    'acc_151': '6d68c47a_1',
    'acc_153': '1276961b_1',
    'acc_154': 'cb7a9562_1',
    'acc_155': '80f7c7f3_1',
    'acc_157': '114c74fc_1',
    'acc_161': '41a72759_1',
    'acc_163': '7ff8614d_1',
    'acc_167': 'e395031a_1',
    'acc_175': '86322229_1',
    'acc_182': '86f31439_1',
    'acc_192': 'bd953a1_1',
    'acc_193': 'befb417b_1',
    'acc_195': '2b870b8b_1',
    'acc_197': '42024d2d_1',
    'acc_199': 'a8e3552f_1',
    'acc_252': 'ead89feb_1',
    'acc_253': '388e33e4_1',
    'acc_256': '7b021c3a_1',
    'acc_257': 'eba43c31_1',
    'acc_262': '86198816_1',
    'acc_264': '449297e7_1',
    'acc_282': '7c44a1f8_1',
    'acc_299': 'a4c8a51f_1',
    'acc_30': '34e86493_1',
    'acc_313': '32bbc80b_1',
    'acc_334': 'c19c0d92_1',
    'acc_342': '91177955_1',
    'acc_345': 'e5e87091_1',
    'acc_346': '3f9e04d5_1',
    'acc_35': 'd0bed4d0_1',
    'acc_350': 'a4c30b60_1',
    'acc_352': 'aa0cdffd_1',
    'acc_353': '449cfd06_1',
    'acc_356': '4b65fb8a_1',
    'acc_362': '5035a4be_1',
    'acc_364': 'a2c47941_1',
    'acc_365': 'c14f9f4c_1',
    'acc_375': '8c3bdd2d_1',
    'acc_394': '642b744f_1',
    'acc_395': '6c6cc62a_1',
    'acc_397': 'e29cdc08_1',
    'acc_410': '86cecb0d_1',
    'acc_413': 'a297ddfe_1',
    'acc_415': '9343c001_1',
    'acc_445': '2e33034f_1',
    'acc_448': '1a5b240b_1',
    'acc_450': '15246a6a_1',
    'acc_452': '85553863_1',
    'acc_455': '2614e2fb_1',
    'acc_456': '463e566c_1',
    'acc_460': '638321df_1',
    'acc_462': '5d5b7795_1',
    'acc_464': 'e1e419e8_1',
    'acc_465': 'a0133502_1',
    'acc_470': '98aa1071_1',
    'acc_494': '2aa557a4_1',
    'acc_497': '572df134_1',
    'acc_50': '46e5e4d3_1',
    'acc_52': '4f651d26_1',
    'acc_60': 'd68e0490_1',
    'acc_6827': '87c9778f_1',
    'acc_69': '1aa15ba5_1',
    'acc_70': '37fa14f5_1',
    'acc_89': '2c1036db_1',
    'acc_91': '1bb8d8f8_1',
    'acc_943': '87c2f2f5_1',
    'acc_97': 'cbc74cb5_1',
    'ho_acc_0050': '1906b27c_1',
    'ho_acc_0114': '3884ef92_1',
    'ho_acc_0117': 'fd5dcb5f_1',
    'ho_acc_0140': '282d1ce0_1',
    'ho_acc_0145': '15a1acbf_1',
    'ho_acc_0197': '2e916621_1',
    'ho_acc_0282': '30cfe5f4_1',
    'ho_acc_0300': 'e103214a_1',
    'ho_acc_0494': 'fdac52d8_1',
    'ho_acc_0900': '61aeb9b7_1',
    'ho_acc_0922': '176fcb4e_1',
    'ho_loc_0054': 'dce55d73_1',
    'ho_loc_0056': 'e56c0c5_1',
    'ho_loc_0059': '124f8ee6_1',
    'ho_loc_0068': '7d422cd7_1',
    'ho_loc_0500': '677732db_1',
    'ho_loc_0501': '1499d569_1',
    'ho_loc_0502': 'd1b188ea_1',
    'ho_loc_0503': '3e4a9d4e_1',
    'ho_loc_0535': 'f01ba468_1',
    'ho_loc_0536': 'b02fad3e_1',
    'ho_loc_0545': '3af24271_1',
    'ho_loc_0561': '4d461651_1',
    'ho_loc_0564': '21399565_1',
    'ho_loc_0581': '6b4d5174_1',
    'ho_loc_0600': 'c3f5d217_1',
    'ho_loc_0602': 'f9334f77_1',
    'ho_loc_0605': '6f43193d_1',
    'ho_loc_0610': '54d8c118_1',
    'ho_loc_0625': '994470a8_1',
    'ho_loc_0626': 'c787c4e8_1',
    'ho_loc_0635': 'd75940_1',
    'ho_loc_0642': '8bd96294_1',
    'ho_noc_0700': '69078dce_1',
    'ho_noc_0723': '1d7de4d_1',
    'ho_noc_0800': 'f37a15be_1',
    'ho_noc_0805': '1836a221_1',
    'ho_noc_0808': 'b6a7e67c_1',
    'ho_noc_0810': 'f453d4db_1',
    'ho_noc_0813': '87e78086_1',
    'ho_noc_0815': 'bdc25c5f_1',
    'ho_noc_0816': '6dcb1f71_1',
    'ho_noc_0817': '9db78d2c_1',
    'ho_noc_0819': 'd10efc39_1',
    'ho_noc_0821': 'd2aca137_1',
    'ho_noc_0836': '51bd052a_1',
    'ho_noc_0841': '178201d3_1',
    'ho_noc_0847': 'efcf1be6_1',
    'ho_noc_0850': '36770e77_1',
    'ho_noc_0860': '2724020f_1',
    'ho_noc_0862': '33a4da37_1',
    'ho_noc_0864': 'a769b9ac_1',
    'ho_noc_0870': '86177595_1',
    'ho_noc_0872': '186005f5_1',
    'ho_noc_0880': '238eeae2_1',
    'ho_noc_0889': '9f3667c8_1',
    'ho_oc_0039': 'ebf87d50_1',
    'ho_oc_0319': '16155c7f_1',
    'ho_oc_0333': 'b453861c_1',
    'ho_oc_0337': '74d34613_1',
    'ho_oc_0349': 'f316f42f_1',
    'ho_oc_0357': '860a503_1',
    'ho_oc_0365': '57745460_1',
    'ho_oc_0366': '45e4f4a7_1',
    'ho_ps_0100': 'b2f3cb12_1',
    'ho_ps_0101': '7a9572fb_1',
    'ho_ps_0102': '64f6fb0d_1',
    'ho_ps_0104': '20078921_1',
    'ho_ps_0106': '60f8aa54_1',
    'ho_ps_0150': 'd307a8f7_1',
    'ho_ps_0181': 'd29527cf_1',
    'loc_1050': '673aa0ab_1',
    'loc_1055': '38835ff8_1',
    'loc_1060': '1c7eecc7_1',
    'loc_1061': 'dcb1c119_1',
    'loc_1061-50': '94cf378b_1',
    'loc_1062': '68fd4b2b_1',
    'loc_1066': 'f3a2f47a_1',
    'loc_1101': '3ceb786e_1',
    'loc_1110': '1465a192_1',
    'loc_1120': 'b6934d81_1',
    'loc_1615': '5cc00593_1',
    'loc_1654': '957a5825_1',
    'loc_1655': '8ff97a53_1',
    'loc_1656': '4dec0cbb_1',
    'loc_1665': '87f2b87a_1',
    'loc_1666': '188f1068_1',
    'loc_1666e': '1b971bf5_1',
    'loc_1862': 'f6d7fa6c_1',
    'loc_200': 'e8243c2_1',
    'loc_200c': 'afc30125_1',
    'loc_200p': '6439cf41_1',
    'loc_200t': 'a808a57e_1',
    'loc_2016': '859a6696_1',
    'loc_2023': '5f4607f9_1',
    'loc_2023p': '422af51_1',
    'loc_2023t': '27d7e66b_1',
    'loc_2026': 'c703cda4_1',
    'loc_2029': '62012d4f_1',
    'loc_2034': 'f4497c94_1',
    'loc_2035': '9785d0bc_1',
    'loc_2036': 'd0215cbd_1',
    'loc_2056': '610e8af3_1',
    'loc_211': '3c1a0fd7_1',
    'loc_212p': '75177feb_1',
    'loc_212t': '288d9901_1',
    'loc_213p': '7bb2abb2_1',
    'loc_213t': 'e05e63be_1',
    'loc_217c': 'ef2a8d06_1',
    'loc_217p': '239fafb8_1',
    'loc_217t': '6b5bc5b9_1',
    'loc_2200': 'eee94525_1',
    'loc_2200t': '7a8b9eea_1',
    'loc_220t': '94694bd1_1',
    'loc_221': '5a664a55_1',
    'loc_221p': '9b31e597_1',
    'loc_222p': '795001ee_1',
    'loc_223p': '794d427e_1',
    'loc_224': 'a1bf9bfb_1',
    'loc_2245': '7c1be416_1',
    'loc_224e': 'e7e5dc20_1',
    'loc_2300': 'e47a8c38_1',
    'loc_2321': 'e1d73785_1',
    'loc_2328': '70c30b07_1',
    'loc_2329': 'bc9a3ce1_1',
    'loc_232p': 'e296bdc6_1',
    'loc_233': '9d279492_1',
    'loc_2330': 'fd7ae2cd_1',
    'loc_2332': 'fbc63950_1',
    'loc_2333': '72c78760_1',
    'loc_2343c': '4c92ad23_1',
    'loc_2343p': 'a19b4057_1',
    'loc_2343t': '6c06f3a1_1',
    'loc_2350': '8ca8d2ef_1',
    'loc_2353p': '75d58d97_1',
    'loc_2356c': 'a3a01f0e_1',
    'loc_2363c': '2a630d6f_1',
    'loc_2363p': '8270c027_1',
    'loc_2363t': 'b7e61833_1',
    'loc_2365': '519c31d2_1',
    'loc_237': 'b12a38ef_1',
    'loc_242': '1da700a1_1',
    'loc_243': '1653acf0_1',
    'loc_245': '17785292_1',
    'loc_246': 'dceb695a_1',
    'loc_247': '765b24c1_1',
    'loc_249': 'b5fdedea_1',
    'loc_400': 'e4f38ae5_1',
    'loc_41': '7af5e8a4_1',
    'loc_44': '6c6436c8_1',
    'loc_520': 'd7ffe422_1',
    'loc_54': '34031f1e_1',
    'loc_55': 'a9bcb0d4_1',
    'loc_58': '3bf621c0_1',
    'loc_59': '8cf2042d_1',
    'loc_600': '7657022_1',
    'loc_617': '3f9455ec_1',
    'loc_622': '84c1358b_1',
    'loc_623': 'db7af1f9_1',
    'loc_625': 'ee99f730_1',
    'loc_633': '2dc9cdd3_1',
    'loc_634': '55c6e19f_1',
    'loc_646': '9715b111_1',
    'loc_65': 'bb9a5edc_1',
    'loc_665': 'c089241c_1',
    'loc_671': '360a3d5_1',
    'loc_675': '318447cd_1',
    'loc_68': '5a1b4765_1',
    'loc_726': '5e89b38a_1',
    'loc_736': '24e7777c_1',
    'loc_746': '16489541_1',
    'loc_773': '34d560f4_1',
    'noc_1800': '61e88fcb_1',
    'noc_1887': 'e6c8fda3_1',
    'noc_2400': 'c969562f_1',
    'noc_2500': 'bf5fbefc_1',
    'noc_2550': 'e93954a8_1',
    'noc_3460': 'ee776402_1',
    'noc_6014': 'c085a4d2_1',
    'noc_6014-325': '8570c22d_1',
    'noc_6014-335': 'b2656ba9_1',
    'noc_6015': '61de5d5e_1',
    'noc_6017': 'ffc1d8d1_1',
    'noc_6050': '71060c35_1',
    'noc_6111': '525aee41_1',
    'noc_6119': '49b12b5b_1',
    'noc_6120': '2cfdd9d3_1',
    'noc_6121': 'cf9846f8_1',
    'noc_6142-100': 'fded1dc2_1',
    'noc_6162': 'cea3c76b_1',
    'noc_6167': '56a24d1_1',
    'noc_6176': 'e02f88d4_1',
    'noc_6264': 'f595e324_1',
    'noc_6357': '20dfe388_1',
    'noc_6361': '3007dfd4_1',
    'noc_6362': 'd3234e3f_1',
    'noc_6376': 'b3c93e09_1',
    'noc_6408': '9fa26965_1',
    'noc_6413': 'ec26adaa_1',
    'noc_6414-85': 'c43a86a3_1',
    'noc_6415': 'f9496a8a_1',
    'noc_6415a': '8c62ff5c_1',
    'noc_6417': '524470b0_1',
    'noc_6419': 'fbcb1010_1',
    'noc_6424': '274dc091_1',
    'noc_6430': '65c6f689_1',
    'noc_6434': '23035b26_1',
    'noc_6440': '53076f8b_1',
    'noc_6440-50': '59b5747d_1',
    'noc_6446': 'ad933c5a_1',
    'noc_6447': '5845e0af_1',
    'noc_6448': '6c8d4808_1',
    'noc_6456': 'a26960fd_1',
    'noc_6460': '689fb417_1',
    'noc_6464': 'eb65b612_1',
    'noc_6468': '57b38e69_1',
    'noc_6470': 'a3172bcc_1',
    'noc_6482': '54070e5e_1',
    'noc_6500': 'd15dd165_1',
    'noc_6502': '33daa6fe_1',
    'noc_6511': 'b3bbc806_1',
    'noc_6517': '6dc53740_1',
    'noc_6519-1': '5efa00d2_1',
    'noc_6530': 'f4c54d2c_1',
    'noc_6536-1': '789b7fd2_1',
    'noc_6556': '6c70b2bc_1',
    'noc_6557': 'df07be03_1',
    'noc_6646': '54cc4a7e_1',
    'noc_6650': '224f448_1',
    'noc_6660': '7e6146ee_1',
    'noc_6672': '3e43f265_1',
    'noc_6800': 'a5345389_1',
    'noc_6805': '3c010605_1',
    'noc_6814': '3f9fdfdd_1',
    'noc_6820': '12033f1c_1',
    'noc_6822': 'bd65dd20_1',
    'noc_6827': '5e200011_1',
    'oc_3309': '14aef413_1',
    'oc_3330': '8efd89d3_1',
    'oc_3356': 'c54bf93c_1',
    'oc_3357': '93d35731_1',
    'oc_3359': '755bc092_1',
    'oc_3360': '78510881_1',
    'oc_3361': '8ff0ebe9_1',
    'oc_3362': 'cd3fd27_1',
    'oc_3366': '64db7f5d_1',
    'oc_3370': '7fbd4d3c_1',
    'oc_3376': 'e09ef38f_1',
    'oc_3409': '97398688_1',
    'oc_3413': 'b9c7a0bd_1',
    'oc_3424': 'ac8b3504_1',
    'oc_3428': '6860f545_1',
    'oc_3434': '88c66316_1',
    'oc_3435': 'c241f10d_1',
    'oc_3444': '6b20fd63_1',
    'oc_3456': '9b90a26f_1',
    'oc_3461': 'c7a0077d_1',
    'oc_3462': '8c8715dd_1',
    'oc_3464': 'd99f926b_1',
    'oc_3469': '7381194c_1',
    'oc_3472': '3dce6386_1',
    'oc_3482': 'f1240c5c_1',
    'oc_3496': 'd9e5d08f_1',
    'oc_3509': 'e46c1364_1',
    'oc_3512': '793137b5_1',
    'oc_3520': '59052924_1',
    'oc_3530': '95a02b8e_1',
    'oc_3535': '77dd0929_1',
    'oc_3540': '14d46579_1',
    'oc_3545': '8fad5987_1',
    'oc_3562': '1e69e5f9_1',
    'oc_3619': '1a21d669_1',
    'oc_3656': 'a7c02644_1',
    'oc_3662': '1332d912_1',
    'oc_3665': 'a572c085_1',
    'oc_3927': 'ae61f92b_1',
    'oc_6512': 'c3bb2295_1',
    'oc_6544': '8f0a92cb_1',
    'phono_12': '19f821c1_1',
    'phono_39': '409d598f_1',
    'ps_1010': 'f980dd2e_1',
    'ps_1011': 'e1c56b38_1',
    'ps_1015': 'd43cd3c_1',
    'ps_1032': 'b6d031a7_1',
    'ps_1034': '71a659dc_1',
    'ps_1041': 'f87d500d_1',
    'ps_1043': 'be6a9cb8_1',
    'ps_1044': '238c29f3_1',
    'ps_1053': '554f9312_1',
    'ps_1144': '65c82b45_1',
    'ps_a': '53c575c7_1',
    'ps_kw': '6b861eec_1',
    'ps_lw': 'b935003e_1',
    'ps_r': '2834525a_1',
    'ps_rw': '110440f5_1',
    'ps_rx': '3dd518d8_1',
    'ps_s': '47bfadc_1',
    'ps_sw': 'da5d4c4_1',
    'ps_tw': 'e61ecdc5_1',
    'ps_v': '9179b6f5_1',
    'ps_vw': '1cbd8b8c_1',
    'ps_zwr': '40cf2bb7_1',
    'rac_5200': 'a018f8b1_1',
    'rac_5201': '83482061_1',
    'rac_5202': '4d96e348_1',
    'rac_5210': 'bfbdf650_1',
    'rac_5501': 'eee3d8c_1',
    'rac_5502': '93b96f13_1',
    'rac_acc_5151': 'a8e9dd82_1',
    'rac_acc_5425': 'df208a72_1',
    'rac_acc_5451': '63f530b6_1',
    'rac_ps_5300': '267e534a_1',
    'rac_ps_5301': 'd4e50ed1_1',
    'rac_ps_5303': '35f14b26_1',
    'stc_022': '2f13a5af_1',
    'stc_042': '5eaaf5ab_1',
    'stc_1022': 'dbbc9e33_1',
    'stc_1024': '6166f545_1',
    'stc_112': '79222181_1',
    'stc_1121': 'f6a48125_1',
    'stc_1122': '63b4a93b_1',
    'stc_1122e': '5e011dbe_1',
    'stc_112r': '22c123d9_1',
    'stc_142': '4744cd48_1',
    'te_5c': '31c99c55_1',
    'te_5d': '756fb3c3_1',
    'te_5f': 'a48e6f96_1',
    'ten_1862t': '9c3df8c3_1',
    'ten_242t': '3fe6ef22_1',
    'ten_243w': '1b1ebc6a_1',
    'ten_244t': '5575d37e_1',
    'ten_2671w': 'a3540615_1',
    'ten_6026': '2a2f05eb_1',
    'ten_b': 'fe4f6a6a_1',
    'ten_t': '248017d3_1',
    'ten_w': '947d2ac8_1',
  };
  // ── v0.9.1643: Atlas parts diagrams — PUBLIC PDFs by loco family ──
  // Harvested from shop.atlasrr.com/t-partsdiagrams.aspx (no login).
  // Matched at runtime against the item DESCRIPTION (the master rows say
  // "GP15T", "SD40" etc.), scale from the era, 3-rail preferred on O.
  var ATLAS_DL = 'https://download.atlasrr.com';
  var ATLAS_PAGE = 'https://shop.atlasrr.com/t-partsdiagrams.aspx';
  var ATLAS_DOCS = [
    {s:'N',m:'260',r:'',t:'N 2-6-0 Mogul Steam Locomotive',u:'/PartsPDF/NScale/n260mogul.pdf'},
    {s:'N',m:'440',r:'',t:'N 4-4-0 Steam Locomotive',u:'/PartsPDF/NScale/n440loco.pdf'},
    {s:'N',m:'840b|dash840b',r:'',t:'N DASH 8-40B Loco',u:'/PartsPDF/NScale/NDASH840B-1.pdf'},
    {s:'N',m:'840bw|dash840bw',r:'',t:'N DASH 8-40BW/BHW Loco',u:'/PartsPDF/NScale/NDASH840BWBHWLoco-1.pdf'},
    {s:'N',m:'840c|dash840c',r:'',t:'N DASH 8-40C Loco',u:'/PartsPDF/NScale/NDash840C.pdf'},
    {s:'N',m:'840cw|dash840cw',r:'',t:'N DASH 8-40CW Loco',u:'/PartsPDF/NScale/NDash840CW.pdf'},
    {s:'N',m:'e7a',r:'',t:'N E7A Loco - Austria',u:'/pdf/N%20E7A%20LOCO%20AUSTRIA.pdf'},
    {s:'N',m:'fa1',r:'',t:'N FA-1 Loco - Austria',u:'/pdf/N%20FA-1%20LOCO%20AUSTRIA.pdf'},
    {s:'N',m:'b237',r:'',t:'N B23-7 High Hood Loco',u:'/PartsPDF/NScale/N%20B23-7%20HI-HOOD%20LOCO%20CHINA.pdf'},
    {s:'N',m:'b237',r:'',t:'N B23-7 Chassis',u:'/PartsPDF/NScale/N%20B23-7%20LOCO%20CHASSIS%20CHINA.pdf'},
    {s:'N',m:'b237',r:'',t:'N B23-7 Loco',u:'/PartsPDF/NScale/N%20GE%20B23-7%20DIESEL%20LOCO%20A.pdf'},
    {s:'N',m:'c420',r:'',t:'N C420 Loco',u:'/PartsPDF/NScale/NC420Loco.pdf'},
    {s:'N',m:'c420',r:'',t:'N C420 Ph. 1 Locomotive',u:'/PartsPDF/NScale/NC420Ph1Loco.pdf'},
    {s:'N',m:'c628',r:'',t:'N C628 Loco',u:'/PartsPDF/NScale/NC628Loco.pdf'},
    {s:'N',m:'c630',r:'',t:'N C630 Loco',u:'/PartsPDF/NScale/NC630Loco.pdf'},
    {s:'N',m:'gp7',r:'',t:'N GP-7 Phase 1 Loco',u:'/PartsPDF/NScale/N%20GP-7%20PHASE%201%20LOCO%20CHINA.pdf'},
    {s:'N',m:'gp7',r:'',t:'N GP-7 Phase 2 Loco',u:'/PartsPDF/NScale/N%20GP-7%20PHASE%202%20LOCO.pdf'},
    {s:'?',m:'gp7',r:'',t:'N GP-7 Locomotive - Japan',u:'/pdf/PartsPDFs/NRepairManual/NGP7Locomotive.pdf'},
    {s:'N',m:'gp9|emdgp9',r:'',t:'N EMD GP-9 Loco-Japan',u:'/pdf/N%20EMD%20GP9DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp9|emdgp9',r:'',t:'N EMD GP-9 Phase 2',u:'/PartsPDF/NScale/N%20EMD%20GP9%20PH%202%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp9|emdgp9',r:'',t:'N EMD GP-9 Torpedo Tube Locomotive',u:'/PartsPDF/NScale/NGP9TTLoco.pdf'},
    {s:'N',m:'gp151',r:'',t:'N Trainman® GP15-1 Locomotive',u:'/PartsPDF/NScale/NTMGP15Loco.pdf'},
    {s:'N',m:'gp30',r:'',t:'N GP-30 Loco - Japan',u:'/pdf/N%20GP-30%20LOCO%20JAPAN.pdf'},
    {s:'N',m:'gp30',r:'',t:'N GP-30 Loco',u:'/PartsPDF/NScale/NGP30Loco.pdf'},
    {s:'N',m:'gp35',r:'',t:'N GP-35 Loco',u:'/PartsPDF/NScale/NGP35Loco.pdf'},
    {s:'N',m:'gp35',r:'',t:'N GP-35 Loco - Classic',u:'/PartsPDF/NScale/N%20GP-35%20CLASSIC%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp35',r:'',t:'N GP-35 Loco-Japan',u:'/pdf/N%20EMD%20GP35%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp38',r:'',t:'N GP-38 Loco',u:'/PartsPDF/NScale/N%20GP-38%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'gp38',r:'',t:'N GP-38 Early Version Loco',u:'/PartsPDF/NScale/NEarlyGP38Loco.pdf'},
    {s:'N',m:'gp38',r:'',t:'N GP-38 High Hood Loco',u:'/PartsPDF/NScale/N%20GP-38%20HI-HOOD%20LOCO%20CHINA.pdf'},
    {s:'N',m:'gp382',r:'',t:'N GP-38-2 Loco',u:'/PartsPDF/NScale/NGP38-2Loco.pdf'},
    {s:'N',m:'gp392',r:'',t:'N GP39-2 Locomotive',u:'/PartsPDF/NScale/NGP39-2Diagram.pdf'},
    {s:'N',m:'gp40',r:'',t:'N GP-40 Loco',u:'/PartsPDF/NScale/N%20GP-40%20LOCO.pdf'},
    {s:'N',m:'gp402',r:'',t:'N GP-40-2 Loco',u:'/PartsPDF/NScale/N%20EMD%20GP-40-2%20LOCO.pdf'},
    {s:'N',m:'h15|1644',r:'',t:'N H15/16-44 Loco',u:'/PartsPDF/NScale/NH1516Loco.pdf'},
    {s:'N',m:'h15|1644|2022',r:'',t:'N H15/16-44 Loco (2022)',u:'/PartsPDF/NScale/NH1544Loco2025.pdf'},
    {s:'N',m:'mp15dc',r:'',t:'N MP15DC Loco',u:'/PartsPDF/NScale/NMP15DCLoco.pdf'},
    {s:'N',m:'rs1',r:'',t:'N RS-1 Loco-China',u:'/PartsPDF/NScale/N%20RS-1%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'rs1',r:'',t:'N RS-1 Loco-Japan',u:'/pdf/N%20ALCO%20RS1%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'rs3',r:'',t:'N RS-3 Loco-China',u:'/PartsPDF/NScale/N%20RS-3%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'rs3',r:'',t:'N RS-3 Loco-Japan',u:'/pdf/N%20ALCO%20RS3%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'rsd4',r:'',t:'N RSD-4/5 Loco',u:'/PartsPDF/NScale/N%20RSD-4-5%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'?',m:'rsd4',r:'',t:'N RSD-4/5 Locomotive - Japan',u:'/pdf/PartsPDFs/NRepairManual/NRSD45Locomotive.pdf'},
    {s:'N',m:'rs11',r:'',t:'N RS-11 Loco-Japan',u:'/pdf/N%20ALCO%20RS11%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'rs11',r:'',t:'N RS-11 Loco',u:'/PartsPDF/NScale/NRS11Loco.pdf'},
    {s:'N',m:'rsd12',r:'',t:'N RSD-12 Loco-Japan',u:'/pdf/N%20ALCO%20RSD12%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'s2',r:'',t:'N S-2 Locomotive (Gold)',u:'/PartsPDF/NScale/NS2Locomotive-1.pdf'},
    {s:'N',m:'sd7',r:'',t:'N SD-7 Loco',u:'/PartsPDF/NScale/NSD7Loco.pdf'},
    {s:'N',m:'sd9',r:'',t:'N SD-9 Loco',u:'/PartsPDF/NScale/NSD9Loco.pdf'},
    {s:'?',m:'sd7',r:'',t:'N SD-7/9 Locomotive - Japan',u:'/pdf/PartsPDFs/NRepairManual/NSD79Locomotive.pdf'},
    {s:'N',m:'sd24',r:'',t:'N SD-24 Loco',u:'/PartsPDF/NScale/NSD24Loco.pdf'},
    {s:'N',m:'sd26',r:'',t:'N SD-26 Loco',u:'/PartsPDF/NScale/NSD26Loco.pdf'},
    {s:'N',m:'sd35|emdsd35',r:'',t:'N EMD SD-35 Loco',u:'/PartsPDF/NScale/N%20EMD%20SD35%20DIESEL%20LOCO%20A.pdf'},
    {s:'N',m:'sd35|emdsd35|2018',r:'',t:'N EMD SD-35 (2018)',u:'/PartsPDF/NScale/Atlas%20N%20SD35%202018-1.pdf'},
    {s:'N',m:'sd45',r:'',t:'N SD45 Locomotive',u:'/PartsPDF/NScale/NSD45Locomotive.pdf'},
    {s:'N',m:'sd50',r:'',t:'N SD-50 Loco',u:'/PartsPDF/NScale/N%20SD-50%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'sd60',r:'',t:'N SD-60 Loco',u:'/PartsPDF/NScale/N%20SD-60%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'sd60e',r:'',t:'N SD-60E Loco',u:'/PartsPDF/NScale/SD60E%20Diagram.pdf'},
    {s:'N',m:'sd60m|emdsd60m',r:'',t:'N EMD SD60M',u:'/PartsPDF/NScale/N%20EMD%20SD60M%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'u23b',r:'',t:'N U23B Loco',u:'/PartsPDF/NScale/NU23BLoco.pdf'},
    {s:'N',m:'u25b',r:'',t:'N U25B Loco',u:'/PartsPDF/NScale/N%20GE%20U25B%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'u25b',r:'',t:'N U25B Loco-Japan',u:'/pdf/N%20GE%20U25B%20Loco-Japan.pdf'},
    {s:'N',m:'vo1000',r:'',t:'N VO-1000 Locomotive',u:'/PartsPDF/NScale/NVO1000.pdf'},
    {s:'N',m:'2bay',r:'',t:'N 2-Bay Centerflow Hopper',u:'/PartsPDF/NScale/NACF2BayCenterFlow.pdf'},
    {s:'?',m:'4bay',r:'',t:'N 4-Bay Centerflow Hopper',u:'/pdf/NFreightCarPDF/NACF4BayCentFlowHop.pdf'},
    {s:'?',m:'40',r:'',t:'N 40\' Airslide Hopper',u:'/pdf/NFreightCarPDF/Ngatx40airslide.pdf'},
    {s:'N',m:'40',r:'',t:'N 40\' Plug Door Box Car',u:'/PartsPDF/NScale/N40ft%20PlugDoorBoxCar.pdf'},
    {s:'N',m:'40|ps1',r:'',t:'N 40\' PS-1 Box Car',u:'/PartsPDF/NScale/N40ft%20PS-1BoxCar.pdf'},
    {s:'N',m:'40',r:'',t:'N 40\' Stock Car',u:'/PartsPDF/NScale/N40ft%20StockCar.pdf'},
    {s:'N',m:'40',r:'',t:'N 40\' Wood Reefer',u:'/PartsPDF/NScale/N40ft%20WoodReefer.pdf'},
    {s:'?',m:'42',r:'',t:'N 42\' Gondola with Containers',u:'/pdf/NFreightCarPDF/N42%27GONDOLAwCONTAINERS.pdf'},
    {s:'?',m:'45',r:'',t:'N 45\' Pines Trailer',u:'/pdf/NFreightCarPDF/N45ft%20Pines%20Trailer.pdf'},
    {s:'N',m:'50',r:'',t:'N 50\' FGE Box Car',u:'/PartsPDF/NScale/NFGE%2050ft%20Box%20Car.pdf'},
    {s:'?',m:'50',r:'',t:'N 50\' Flat Car with Stakes',u:'/pdf/NFreightCarPDF/Flat%20w%20Stakes.pdf'},
    {s:'?',m:'50',r:'',t:'N 50\' Flat Car with Trailer',u:'/pdf/NFreightCarPDF/Flat%20%20Car%20w%20Trailer.pdf'},
    {s:'N',m:'50',r:'',t:'N 50\' Flat Car with Two Trailers',u:'/PartsPDF/NScale/Piggy%20Back%20Flat%20w%20Trailers.pdf'},
    {s:'N',m:'50',r:'',t:'N 50\' Mechanical Reefer',u:'/PartsPDF/NScale/N50ftMechReefer.pdf'},
    {s:'N',m:'50',r:'',t:'N 50\' Precision Design Box Car',u:'/PartsPDF/NScale/NACF50PrecisionBoxCar-Online.pdf'},
    {s:'?',m:'50',r:'',t:'N 50\' Stock Car',u:'/pdf/NFreightCarPDF/N50ft%20StockCar.pdf'},
    {s:'N',m:'50',r:'',t:'N 50\' Staggered Double Door Box Car',u:'/PartsPDF/NScale/N50ft%20STAG%20DD%20BOX%20Car.pdf'},
    {s:'N',m:'55',r:'',t:'N 55 Ton Fishbelly Hopper - Flat Ends',u:'/PartsPDF/NScale/55TonFishbellyHopper_Flat.pdf'},
    {s:'N',m:'55',r:'',t:'N 55 Ton Fishbelly Hopper - Peaked Ends',u:'/PartsPDF/NScale/55TonFishbellyHopper_Peaked.pdf'},
    {s:'N',m:'60',r:'',t:'N 60\' Double Door Auto Parts Box Car',u:'/PartsPDF/NScale/N60ft%20ACF%20DD%20Auto%20Parts%20Car.pdf'},
    {s:'N',m:'60',r:'',t:'N 60\' Single Door Auto Parts Box Car',u:'/PartsPDF/NScale/N60ft%20ACF%20SD%20Auto%20Parts%20Car.pdf'},
    {s:'N',m:'70',r:'',t:'N 70 Ton Ore Ca',u:'/PartsPDF/NScale/NOreCarWithLoad.pdf'},
    {s:'N',m:'90',r:'',t:'N 90 Ton Hopper',u:'/PartsPDF/NScale/90%20ton%20hopper.pdf'},
    {s:'N',m:'11|000',r:'',t:'N 11,000 Gallon Tank Car',u:'/PartsPDF/NScale/N11000GalTank.pdf'},
    {s:'N',m:'17|360',r:'',t:'N 17,360 Gallon Tank Car',u:'/PartsPDF/NScale/N17360GalTank.pdf'},
    {s:'N',m:'23|500',r:'',t:'N 23, 500 Gallon Tank Car',u:'/PartsPDF/NScale/N23500GalTank.pdf'},
    {s:'?',m:'33|000',r:'',t:'N 33,000 Gallon Tank Car',u:'/pdf/NFreightCarPDF/NACF33000GalTankCar.pdf'},
    {s:'N',m:'ps2',r:'',t:'N PS-2 Covered Hopper',u:'/PartsPDF/NScale/N-PS-2%202%20Bay%20Cvd%20Hop.pdf'},
    {s:'?',m:'f150|fordf150',r:'',t:'N Ford® F-150 Pickup Trucks',u:'/pdf/NFreightCarPDF/NFORDF150_2Versions.pdf'},
    {s:'O',m:'aem7|alp44',r:'',t:'HO AEM-7/ALP-44 Loco',u:'/PartsPDF/HOScale/HO%20AEM-7%20ELECTRIC%20LOCO%201.pdf'},
    {s:'O',m:'aem7|alp44',r:'',t:'HO AEM-7/ALP-44 Loco',u:'/PartsPDF/HOScale/AEM7Diagrams.pdf'},
    {s:'O',m:'alp45dp',r:'',t:'HO ALP45DP Loco',u:'/PartsPDF/HOScale/HOalp45dp.pdf'},
    {s:'O',m:'b237',r:'',t:'HO B23-7 Locomotive - Silver',u:'/PartsPDF/HOScale/HOB23SilverLoco.pdf'},
    {s:'O',m:'b237',r:'',t:'HO B23-7 Locomotive - Gold',u:'/PartsPDF/HOScale/HOB23GoldLoco.pdf'},
    {s:'O',m:'b237|307',r:'',t:'HO B23-7/30-7 Locomotive - Analog',u:'/PartsPDF/HOScale/HOB237307LocoAnalog.pdf'},
    {s:'O',m:'c307',r:'',t:'HO C30-7 Locomotive',u:'/PartsPDF/HOScale/HOC30-7Locomotive.pdf'},
    {s:'O',m:'c420',r:'',t:'HO C420 Phase 1 Locomotive - Silver',u:'/PartsPDF/HOScale/HOC420SilverLocomotive.pdf'},
    {s:'O',m:'c420',r:'',t:'HO C420 Phase 1 Locomotive - Gold',u:'/PartsPDF/HOScale/HOC420GoldLocomotive.pdf'},
    {s:'O',m:'c420',r:'',t:'HO C420 Phase 1 High Nose Locomotive - Silver',u:'/PartsPDF/HOScale/HOC420Ph1SilverLocomotive.pdf'},
    {s:'O',m:'c420',r:'',t:'HO C420 Phase 1 High Nose Locomotive - Gold',u:'/PartsPDF/HOScale/HOC420Ph1GoldLocomotive.pdf'},
    {s:'HO',m:'c424|425',r:'',t:'HO C424/425 Loco',u:'/pdf/HO%20C-424-425%20LOCOS%20JAPAN.pdf'},
    {s:'O',m:'c424|425',r:'',t:'HO C424/425 Locomotive',u:'/PartsPDF/HOScale/HOC424425Locomotive.pdf'},
    {s:'O',m:'c424|425',r:'',t:'HO C424/425 Locomotive',u:'/PartsPDF/HOScale/HOC424425LocomotiveGold.pdf'},
    {s:'HO',m:'c424|425',r:'',t:'HO C424/425 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HOC424425Locomotive.pdf'},
    {s:'O',m:'c425',r:'',t:'HO C425 Locomotive',u:'/PartsPDF/HOScale/HOC425Locomotive.pdf'},
    {s:'O',m:'840bw|dash840bw',r:'',t:'HO DASH 8-40BW Loco',u:'/PartsPDF/HOScale/HODASH840BW.pdf'},
    {s:'O',m:'840b|dash840b',r:'',t:'HO DASH 8-40B Locomotive',u:'/PartsPDF/HOScale/HO%20DASH8%20DIESEL%20LOCO%20CHINA1.pdf'},
    {s:'O',m:'840c|dash840c',r:'',t:'HO DASH 8-40C Locomotive - Silver',u:'/PartsPDF/HOScale/HODash8Silver.pdf'},
    {s:'O',m:'840c|dash840c',r:'',t:'HO DASH 8-40C Locomotive - Gold',u:'/PartsPDF/HOScale/HODash8Gold.pdf'},
    {s:'O',m:'840c|dash840c',r:'',t:'HO DASH 8-40C Locomotive - Gold (ESU)',u:'/PartsPDF/HOScale/HODASH840CESU.pdf'},
    {s:'O',m:'840cw|dash840cw',r:'',t:'HO DASH 8-40CW Locomotive - Silver',u:'/PartsPDF/HOScale/HODash840CWSilverLocomotive.pdf'},
    {s:'O',m:'840cw|dash840cw',r:'',t:'HO DASH 8-40CW Locomotive - Gold',u:'/PartsPDF/HOScale/HODash840CWGoldLocomotive.pdf'},
    {s:'HO',m:'fp7',r:'',t:'HO FP-7 Loco',u:'/pdf/HO%20FP-7%20LOCOS%20AUSTRIA.pdf'},
    {s:'HO',m:'fp7',r:'',t:'HO FP-7 Truck Assembly',u:'/pdf/HO%20FP-7%20TRUCK%20ASS.%20AUSTRIA.pdf'},
    {s:'O',m:'u23b|geu23b',r:'',t:'HO GE U23B Loco',u:'/PartsPDF/HOScale/HO%20GE%20U23B%20DIESEL%20LOCO%201.pdf'},
    {s:'O',m:'gp7',r:'',t:'HO GP-7 Locomotive',u:'/PartsPDF/HOScale/HOGP7Locomotive.pdf'},
    {s:'O',m:'gp7',r:'',t:'HO GP-7 Locomotive',u:'/PartsPDF/HOScale/HO_GP-7.pdf'},
    {s:'HO',m:'gp7',r:'',t:'HO GP-7 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HOGP7Locomotive.pdf'},
    {s:'O',m:'gp38',r:'',t:'HO GP-38 Early Version Loco',u:'/PartsPDF/HOScale/HO%20EARLY%20GP-38%20LOCO%201.pdf'},
    {s:'O',m:'gp382',r:'',t:'HO Trainman® GP38-2 Locomotive',u:'/PartsPDF/HOScale/HOTMGP38-2Locomotive.pdf'},
    {s:'O',m:'gp392',r:'',t:'HO Trainman® GP39-2 Phase 1 Locomotive',u:'/PartsPDF/HOScale/HOTMGP39-2.pdf'},
    {s:'O',m:'gp392',r:'',t:'HO Trainman® GP39-2 Locomotive',u:'/PartsPDF/HOScale/HOGP39-2.pdf'},
    {s:'O',m:'gp38|2017',r:'',t:'HO GP-38 (2017) Silver Page 2',u:'/PartsPDF/HOScale/HO_GP-38_Analog_2017_P2.pdf'},
    {s:'O',m:'gp38|2017',r:'',t:'HO GP-38 (2017) Gold Page 2',u:'/PartsPDF/HOScale/HO_GP-38_Sound_2017_P2.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Loco A-Roco',u:'/pdf/HO%20EMD%20GP38-40%20LOCO%20A.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Loco B-Roco',u:'/pdf/HO%20EMD%20GP38-40%20LOCO%20b.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Brush Replacement',u:'/pdf/HO%20GP-38-40%20BRUSH%20REPLACE.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Truck Assembly',u:'/pdf/HO%20GP-38-40%20TRUCK%20ASSEMBLY.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Loco (Old Version)',u:'/pdf/PartsPDFs/HOGP3840old.pdf'},
    {s:'O',m:'gp40|2017',r:'',t:'HO GP-40 (2017) Silver',u:'/PartsPDF/HOScale/HO_GP-40_Analog_2017.pdf'},
    {s:'O',m:'gp40|2017',r:'',t:'HO GP-40 (2017) Gold',u:'/PartsPDF/HOScale/HO_GP-40_Sound_2017.pdf'},
    {s:'O',m:'gp40|2017|nose2017',r:'',t:'HO GP-40 High Nose (2017) Silver',u:'/PartsPDF/HOScale/HO_GP-40_HiNose%20Analog_2017.pdf'},
    {s:'O',m:'gp40|2017|nose2017',r:'',t:'HO GP-40 High Nose (2017) Gold',u:'/PartsPDF/HOScale/HO_GP-40_HiNose_Sound_2017.pdf'},
    {s:'O',m:'gp40',r:'',t:'HO GP-40 High Hood Loco',u:'/PartsPDF/HOScale/HO%20GP-40%20HI-HOOD%20LOCO%20CHINA.pdf'},
    {s:'O',m:'gp402',r:'',t:'HO GP40-2 Locomotive (ESU Sound)',u:'/PartsPDF/HOScale/HOGP40-2ESU.pdf'},
    {s:'O',m:'gp402',r:'',t:'HO GP40-2 Phase 1 Locomotive - Silver',u:'/PartsPDF/HOScale/HOGP40-2Silver.pdf'},
    {s:'O',m:'gp402',r:'',t:'HO GP40-2 Phase 1 Locomotive - Gold',u:'/PartsPDF/HOScale/HOGP40-2Gold.pdf'},
    {s:'O',m:'gp402',r:'',t:'HO GP40-2 Phase 2 Locomotive',u:'/PartsPDF/HOScale/HO_GP40-2_Phase_2_Page_1.pdf'},
    {s:'O',m:'gp402w',r:'',t:'HO GP40-2W Locomotive',u:'/PartsPDF/HOScale/HOGP40-2WLocomotive.pdf'},
    {s:'O',m:'h15|1644',r:'',t:'HO H15/16-44 Locomotive',u:'/PartsPDF/HOScale/HOH15-44Locomotive.pdf'},
    {s:'O',m:'h15|1644',r:'',t:'HO H15/16-44 Locomotive (New Version)',u:'/PartsPDF/HOScale/HOH15-44Locomotive2018.pdf'},
    {s:'O',m:'hh600|660',r:'',t:'HO HH600/660 Locomotive',u:'/PartsPDF/HOScale/HOHH600.pdf'},
    {s:'O',m:'mp15dc',r:'',t:'HO MP15DC Locomotive - Silver',u:'/PartsPDF/HOScale/HOMP15DCLocomotive.pdf'},
    {s:'O',m:'mp15dc',r:'',t:'HO MP15DC Locomotive - Gold',u:'/PartsPDF/HOScale/HOMP15DCGoldLocomotive.pdf'},
    {s:'O',m:'rs1',r:'',t:'HO RS-1 Loco',u:'/PartsPDF/HOScale/HO%20ALCO%20RS1%20LOCO.pdf'},
    {s:'O',m:'rs1',r:'',t:'HO RS-1 Loco (Gold)',u:'/PartsPDF/HOScale/HORS-1.pdf'},
    {s:'HO',m:'rs1',r:'',t:'HO RS-1 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORS1Locomotive.pdf'},
    {s:'O',m:'rs3',r:'',t:'HO RS-3 Loco',u:'/PartsPDF/HOScale/HO%20RS-3%20DIESEL%20LOCO.pdf'},
    {s:'HO',m:'rs3',r:'',t:'HO RS-3 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORS3Locomotive.pdf'},
    {s:'O',m:'rs11|2016',r:'',t:'HO RS-11 Locomotive (2016 and later)',u:'/PartsPDF/HOScale/HORS11Locomotive.pdf'},
    {s:'O',m:'rs11',r:'',t:'HO RS-11 Locomotive',u:'/PartsPDF/HOScale/HORS-11Locomotive.pdf'},
    {s:'HO',m:'rs11',r:'',t:'HO RS-11 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORS11Locomotive.pdf'},
    {s:'HO',m:'rsd4|rsd12',r:'',t:'HO RSD-4/5 & RSD-12 Locomotives (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORSD4512Locomotive.pdf'},
    {s:'O',m:'rs32|36',r:'',t:'HO Trainman® RS32/36 Locomotives',u:'/PartsPDF/HOScale/HORS32.pdf'},
    {s:'O',m:'s1|s3',r:'',t:'HO S-1/S-3 Locomotive',u:'/PartsPDF/HOScale/HOS1S3Locomotive.pdf'},
    {s:'O',m:'s2',r:'',t:'HO S-2 Locomotive',u:'/PartsPDF/HOScale/HOS2Locomotive.pdf'},
    {s:'O',m:'s2|s4',r:'',t:'HO S-2/S-4 Loco',u:'/PartsPDF/HOScale/S4%20SWITCHER.pdf'},
    {s:'O',m:'sd24',r:'',t:'HO SD-24 Analog',u:'/PartsPDF/HOScale/HO%20SD24%20Analog%20final-Model.pdf'},
    {s:'O',m:'sd24',r:'',t:'HO SD-24 w/Sound',u:'/PartsPDF/HOScale/HO%20SD24%20Soundfinal-Model.pdf'},
    {s:'O',m:'sd26',r:'',t:'HO SD-26 Analog',u:'/PartsPDF/HOScale/HO%20SD26%20Analogffinal-Model.pdf'},
    {s:'O',m:'sd26',r:'',t:'HO SD-26 w/Sound',u:'/PartsPDF/HOScale/HO%20SD26%20Sound1%20final-Model.pdf'},
    {s:'HO',m:'sd2435',r:'',t:'HO SD-24-35 Loco A-Roco',u:'/pdf/HO%20EMD%20SD24-35%20LOCO%20A.pdf'},
    {s:'HO',m:'sd2435',r:'',t:'HO SD-24-35 Loco B-Roco',u:'/pdf/HO%20EMD%20SD24-35%20LOCO%20b.pdf'},
    {s:'HO',m:'sd24|sd35',r:'',t:'HO SD-24 & SD-35 Truck A',u:'/pdf/HO%20SD24%20&amp;%20SD35%20TRUCK%20A.pdf'},
    {s:'HO',m:'sd24|sd35',r:'',t:'HO SD-24 & SD-35 Truck B',u:'/pdf/HO%20SD24%20&amp;%20SD35%20TRUCK%20B.pdf'},
    {s:'O',m:'sd35',r:'',t:'HO SD-35 Locomotive',u:'/PartsPDF/HOScale/HOSD35Locomotive.pdf'},
    {s:'O',m:'sd35|sdp35',r:'',t:'HO SD-35/SDP-35 Locomotive - Silver',u:'/PartsPDF/HOScale/HOSD35Silver.pdf'},
    {s:'O',m:'sd35|sdp35',r:'',t:'HO SD-35/SDP-35 Locomotive - Gold',u:'/PartsPDF/HOScale/HOSD35Gold.pdf'},
    {s:'O',m:'u23b',r:'',t:'HO U23B Locomotive',u:'/PartsPDF/HOScale/HOU23BLocomotive.pdf'},
    {s:'?',m:'u23b',r:'',t:'HO U23B Shell Removal Instructions',u:'/pdf/Instructions/U23B%20Shell%20Removal%20Instructions.pdf'},
    {s:'HO',m:'u23b|u30b',r:'',t:'HO U23B/U30B Locomotive',u:'/pdf/HOU2330BLoco.pdf'},
    {s:'O',m:'u30b',r:'',t:'HO U30B Locomotive',u:'/PartsPDF/HOScale/HOU30B.pdf'},
    {s:'O',m:'u30b|2nd',r:'',t:'HO U30B Locomotive 2nd Version',u:'/PartsPDF/HOScale/HOU30B2.pdf'},
    {s:'O',m:'u30c',r:'',t:'HO U30C Locomotive Phase 3',u:'/PartsPDF/HOScale/HOU30C.pdf'},
    {s:'HO',m:'u30c',r:'',t:'HO U30C Dual-Model Decoder Settings',u:'/pdf/PartsPDFs/HOU30CDMD.pdf'},
    {s:'HO',m:'u33b|36b',r:'',t:'HO U33B/36B Locomotive Part 1',u:'/pdf/HO%20U33-36B%20Page%201.pdf'},
    {s:'HO',m:'u33b|36b',r:'',t:'HO U33B/36B Locomotive Part 2',u:'/pdf/HO%20U33-36B%20Page%202.pdf'},
    {s:'HO',m:'u33c|u36c',r:'',t:'HO U33C/U36C Locomotive',u:'/pdf/PartsPDFs/HOU33C.pdf'},
    {s:'O',m:'4650',r:'',t:'HO 4650 Centerflow Hopper',u:'/PartsPDF/HOScale/HO4650Centerflow.pdf'},
    {s:'O',m:'aem7|alp44',r:'',t:'O AEM-7 / ALP-44 Electric Locomotive Body',u:'/PartsPDF/OScale/oAe7Body.pdf'},
    {s:'O',m:'aem7|alp44',r:'3',t:'O AEM-7 / ALP-44 Electric Locomotive (3-Rail)',u:'/PartsPDF/OScale/oAEM73ra.pdf'},
    {s:'O',m:'aem7|alp44',r:'2',t:'O AEM-7 / ALP-44 Electric Locomotive (2-Rail)',u:'/PartsPDF/OScale/oAEM72ra.pdf'},
    {s:'O',m:'c628',r:'3',t:'O C628 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/C%20628%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'c628',r:'3',t:'O C628 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/C%20628%203rail%20chassis%20complete.pdf'},
    {s:'O',m:'c628',r:'3',t:'O C628 Trucks (3-Rail)',u:'/PartsPDF/OScale/C%20628%20truck%203%20rail%20complete.pdf'},
    {s:'O',m:'c628',r:'2',t:'O C628 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/C%20628%20body%202%20rail%20complete.pdf'},
    {s:'O',m:'c628',r:'2',t:'O C628 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/C%20628%202%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'c628',r:'2',t:'O C628 Trucks (2-Rail)',u:'/PartsPDF/OScale/C%20628%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'c630',r:'3',t:'O C630 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/C%20630%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'3',t:'O C630 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/C%20630%20chassis%203%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'3',t:'O C630 Trucks (3-Rail)',u:'/PartsPDF/OScale/C%20630%203rail%20truck%20complete.pdf'},
    {s:'O',m:'c630',r:'2',t:'O C630 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/C%20630%202%20body%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'2',t:'O C630 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/C%20630%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'2',t:'O C630 Trucks (2-Rail)',u:'/PartsPDF/OScale/C%20630%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp7',r:'3',t:'O GP-7 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/O_GP-7_3rail_Body.pdf'},
    {s:'O',m:'gp7',r:'3',t:'O GP-7 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/O_GP-7_3rail_Chassis.pdf'},
    {s:'O',m:'gp7',r:'3',t:'O GP-7 Locomotive Trucks (3-Rail)',u:'/PartsPDF/OScale/O_GP-7_3rail_Trucks.pdf'},
    {s:'O',m:'gp7',r:'2',t:'O GP-7 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/O_GP-7_2rail_Body.pdf'},
    {s:'O',m:'gp7',r:'2',t:'O GP-7 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/O_GP-7_2rail_Chassis.pdf'},
    {s:'O',m:'gp7',r:'2',t:'O GP-7 Locomotive Trucks (2-Rail)',u:'/PartsPDF/OScale/O_GP-7_2rail_Trucks.pdf'},
    {s:'O',m:'gp9',r:'3',t:'O GP-9 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/GP%209%203rail%20body%20complete.pdf'},
    {s:'O',m:'gp9',r:'3',t:'O GP-9 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%209%203rail%20chassis%20complete.pdf'},
    {s:'O',m:'gp9',r:'3',t:'O GP-9 Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%209%203%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp9',r:'2',t:'O GP-9 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP 9 body 2 rail complete.pdf'},
    {s:'O',m:'gp9',r:'2',t:'O GP-9 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%209%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp9',r:'2',t:'O GP-9 Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%209%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'3',t:'O GP-35 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/GP%2035%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'3',t:'O GP-35 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%2035%20chassis%203%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'3',t:'O GP-35 Locomotive Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%2035%203%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp35',r:'2',t:'O GP-35 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP%2035%20body%202%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'2',t:'O GP-35 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%2035%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'2',t:'O GP-35 Locomotive Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%2035%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp60',r:'3',t:'O GP60 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/GP%2060%203%20rail%20body%20complete.pdf'},
    {s:'O',m:'gp60',r:'3',t:'O GP60 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%2060%203%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'gp60',r:'3',t:'O GP60 Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%2060%203rail%20truck%20complete.pdf'},
    {s:'O',m:'gp60',r:'2',t:'O GP60 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP%2060%202%20rail%20body%20complete.pdf'},
    {s:'O',m:'gp60',r:'2',t:'O GP60 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20Chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp60',r:'2',t:'O GP60 Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'3',t:'O GP60B Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/Gp%2060%20B%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'3',t:'O GP60B Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%20chassis%203%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'3',t:'O GP60B Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%20truck%203%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'2',t:'O GP60B Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%202%20rail%20body%20complete.pdf'},
    {s:'O',m:'gp60b',r:'2',t:'O GP60B Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'2',t:'O GP60B Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20%20B%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'rs1',r:'3',t:'O RS-1 Locomotive (3-Rail)',u:'/PartsPDF/OScale/O_RS1_3_Rail.pdf'},
    {s:'O',m:'rs1',r:'2',t:'O RS-1 Locomotive (2-Rail)',u:'/PartsPDF/OScale/O_RS1_2_Rail.pdf'},
    {s:'O',m:'sd40',r:'3',t:'O SD40 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/SD%2040%203%20rail%20body.pdf'},
    {s:'O',m:'sd40',r:'3',t:'O SD40 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/sd%2040%203%20rail%20chassis.pdf'},
    {s:'O',m:'sd40',r:'3',t:'O SD40 Trucks (3-Rail)',u:'/PartsPDF/OScale/SD%2040_3rail_Truck.pdf'},
    {s:'O',m:'sd40',r:'2',t:'O SD40 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/SD%2040%202%20rail%20body.pdf'},
    {s:'O',m:'sd40',r:'2',t:'O SD40 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/SD%2040%202%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'sd40',r:'2',t:'O SD40 Trucks (2-Rail)',u:'/PartsPDF/OScale/SD%2040%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'3bay',r:'3',t:'O 3-Bay Cylindrical Hopper (3-Rail)',u:'/PartsPDF/OScale/O_3BayCylinHopper_3rail.pdf'},
    {s:'O',m:'3bay',r:'2',t:'O 3-Bay Cylindrical Hopper (2-Rail)',u:'/PartsPDF/OScale/O_3BayCylinHopper_2rail.pdf'},
    {s:'O',m:'33|000',r:'3',t:'O 33,000 Gallon Tank Car (3-Rail)',u:'/PartsPDF/OScale/ACF_33kgal_tankcar_3rail.pdf'},
    {s:'O',m:'33|000',r:'2',t:'O 33,000 Gallon Tank Car (2-Rail)',u:'/PartsPDF/OScale/ACF_33kgal_tankcar_2rail.pdf'},
    {s:'O',m:'40',r:'3',t:'O 40\' Wood Reefer (3-Rail)',u:'/PartsPDF/OScale/O_woodside_reefer_3_rail.pdf'},
    {s:'O',m:'40',r:'2',t:'O 40\' Wood Reefer (2-Rail)',u:'/PartsPDF/OScale/O_woodside_reefer_2_rail.pdf'},
    {s:'O',m:'50|ps1',r:'',t:'O 50\' PS-1 Box Car Cushion Underframe',u:'/PartsPDF/OScale/o_ps1-50ft%20cushion_boxcar.pdf'},
    {s:'O',m:'50|ps1',r:'',t:'O 50\' PS-1 Box Car Standard',u:'/PartsPDF/OScale/o_ps1-50ft%20standard_boxcar.pdf'},
    {s:'O',m:'50',r:'3',t:'O 50 Ton War Hopper (3-Rail)',u:'/PartsPDF/OScale/O_50ton_War_Hopper_3Rail.pdf'},
    {s:'O',m:'50',r:'2',t:'O 50 Ton War Hopper (2-Rail)',u:'/PartsPDF/OScale/O_50ton_War_Hopper_2Rail%20[Converted].ai.pdf'},
    {s:'O',m:'6bay',r:'3',t:'O 6-Bay Cylindrical Hopper (3-Rail)',u:'/PartsPDF/OScale/O_6BayCylinHopper_3rail.pdf'},
    {s:'O',m:'6bay',r:'2',t:'O 6-Bay Cylindrical Hopper (2-Rail)',u:'/PartsPDF/OScale/O_6BayCylinHopper_2rail.pdf'},
    {s:'O',m:'60',r:'',t:'O 60\' Auto Parts Box Car Single Door',u:'/PartsPDF/OScale/o_60ft_singledoor_autopartscar.pdf'},
    {s:'O',m:'60',r:'',t:'O 60\' Auto Parts Box Car Double Door',u:'/PartsPDF/OScale/o_60ft_doubledoor_autopartscar.pdf'},
    {s:'O',m:'89',r:'3',t:'O 89\' 4" Flat Car (3-Rail)',u:'/PartsPDF/OScale/o_89ft_4in_flatcar_3rail.pdf'},
    {s:'O',m:'89',r:'2',t:'O 89\' 4" Flat Car (2-Rail)',u:'/PartsPDF/OScale/o_89ft_4in_flatcar_2rail.pdf'},
    {s:'O',m:'5161|trinity5161',r:'3',t:'O Trinity 5161 - Round Hatches (3-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161_Round%20Hatches%203%20Rail.pdf'},
    {s:'O',m:'5161|trinity5161',r:'2',t:'O Trinity 5161 - Round Hatches (2-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161_Round%20Hatches.pdf'},
    {s:'O',m:'5161|trinity5161',r:'3',t:'O Trinity 5161 - Trough Hatches (3-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161%20Trough%20Hatches%203%20Rail.pdf'},
    {s:'O',m:'5161|trinity5161',r:'2',t:'O Trinity 5161 - Trough Hatches (2-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161%20Trough%20Hatches.pdf'},
    {s:'O',m:'gp15',r:'3',t:'O TM GP15 Locomotive (3-Rail)',u:'/PartsPDF/OScale/gp-15_trainman_3rail.pdf'},
    {s:'O',m:'gp15',r:'2',t:'O TM GP15 Locomotive (2-Rail)',u:'/PartsPDF/OScale/GP-152-rail.pdf'},
    {s:'O',m:'rsd4',r:'3',t:'O TM RSD-4/5 Locomotive (3-Rail)',u:'/PartsPDF/OScale/rsd-4_5_3rail.pdf'},
    {s:'O',m:'rsd4',r:'2',t:'O TM RSD-4/5 Locomotive (2-Rail)',u:'/PartsPDF/OScale/rsd-4_5_2rail.pdf'},
    {s:'O',m:'u23b',r:'3',t:'O TM U23B Locomotive (3-Rail)',u:'/PartsPDF/OScale/Trainman_U23B_3Rail.pdf'},
    {s:'O',m:'u23b',r:'2',t:'O TM U23B Locomotive (2-Rail)',u:'/PartsPDF/OScale/Trainman_U23B_2%20Rail.pdf'},
    {s:'O',m:'40',r:'2',t:'O TM 40\' Plug Door Box Car (2-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_plugdoor_2rail.pdf'},
    {s:'O',m:'40',r:'3',t:'O TM 40\' Plug Door Box Car (3-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_plugdoor_3rail.pdf'},
    {s:'O',m:'40',r:'2',t:'O TM 40\' Sliding Door Box Car (2-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_singledoor_boxcar_2rail.pdf'},
    {s:'O',m:'40',r:'3',t:'O TM 40\' Sliding Door Box Car (3-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_singledoor_boxcar_3rail.pdf'},
    {s:'O',m:'40',r:'2',t:'O TM 40\' Stock Car (2-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_stockcar_2rail.pdf'},
    {s:'O',m:'40',r:'3',t:'O TM 40\' Stock Car (3-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_stockcar_3rail.pdf'},
    {s:'O',m:'52',r:'2',t:'O TM 52\' Gondola (2-Rail)',u:'/OPartsPDF/RollingStock/trainman_Gondola_2rail.pdf'},
    {s:'O',m:'52',r:'3',t:'O TM 52\' Gondola (3-Rail)',u:'/OPartsPDF/RollingStock/trainman_Gondola_3rail.pdf'},
  ];
  function _atlasMatch(item, eraKey) {
    var sc = eraKey === 'atlas' ? 'O' : eraKey === 'atlas_ho' ? 'HO' : eraKey === 'atlas_n' ? 'N' : eraKey === 'atlas_z' ? 'Z' : null;
    if (!sc) return null;
    var d = String((item.description || '') + ' ' + (item.itemName || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!d) return null;
    var hits = [];
    ATLAS_DOCS.forEach(function (e) {
      if (e.s !== sc) return;
      var best = 0;
      e.m.split('|').forEach(function (k) {
        if (!k || d.indexOf(k) < 0) return;
        // digit-only short keys ('50') false-match road numbers ('#1508')
        // — caught in the v1643 unit check. Letters or length >= 4.
        if (!/[a-z]/.test(k) && k.length < 4) return;
        if (k.length > best) best = k.length;
      });
      if (best) hits.push({ e: e, len: best });
    });
    if (!hits.length) return null;
    // Longest matching key wins (gp15 beats 50); 3-rail preferred on O.
    hits.sort(function (a, b) { return (b.len - a.len) || ((b.e.r === '3') - (a.e.r === '3')); });
    return hits[0].e;
  }

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
      return pf ? (PWSM_BASE + pf + '.pdf' + (PWSM_TOK[pf] ? '?sfvrsn=' + PWSM_TOK[pf] : '')) : PWSM_HOME;
    }
    if (route === 'lionel')
      // v0.9.1642: lionelsupport's own search is JS-only and its old CFM
      // documents index is dead (404'd on Brad). Google's index of the
      // site finds the manual + parts PDFs reliably.
      return 'https://www.google.com/search?q=' + encodeURIComponent('site:lionelsupport.com "' + num + '"');
    if (route === 'mth')
      return 'https://mthpartsandsales.com/shop/search/results?searchContext=' + encodeURIComponent(num);   // v0.9.1642: their real search route (the guessed /search?q= 404'd on Brad)
    if (route === 'atlas')
      return ATLAS_PAGE;   // family match handled in the panel (needs the era)
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

  // ── v0.9.1641: the LCCA two-step (copy link + open site) ─────
  // PROVEN: LCCA's member cookie is SameSite-strict — it rides only on
  // user-initiated navigations (address-bar paste, bookmarks), NEVER on
  // links clicked from another site, token or no token (Brad tested
  // every form). So the button copies the exact PDF link and opens
  // lionelcollectors.org; the user pastes in that tab's address bar.
  window._maintLccaGo = function (url) {
    var done = function (ok) {
      // v0.9.1642: the new tab covers the app instantly, so a toast plays
      // to an empty room (Brad never saw it). The instruction lives IN
      // the panel now — still there when the user switches back.
      var note = document.getElementById('maint-lcca-note');
      if (note) {
        note.style.display = 'block';
        note.innerHTML = ok
          ? '<b>Link copied!</b> Due to LCCA\'s permissions, please <b>log in</b> on the LCCA tab that just opened (check <b>Remember Me</b> — you only have to do this once). Once logged in, <b>right-click the web address bar</b> and hit <b>Paste and go</b> — that takes you straight to the manual pages.'
          : 'Could not copy the link automatically — here it is to copy by hand:<br><span style="user-select:all;word-break:break-all">' + _esc(url) + '</span>';
      }
      if (typeof showToast === 'function' && !ok)
        showToast('Could not copy the link — see the Maintenance panel.', 5000, true);
      window.open('https://www.lionelcollectors.org', '_blank');
    };
    try {
      navigator.clipboard.writeText(url).then(function(){ done(true); }, function(){ done(false); });
    } catch (e) { done(false); }
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
    var _atlasHit = (route === 'atlas') ? _atlasMatch(item, eraKey) : null;
    var routeLabel = route === 'lcca' ? (_pwsmHit ? 'Service Manual pages for ' + _esc(String(item.itemNum || '')) + ' (LCCA members)' : 'LCCA Postwar Service Manual archive (members)')
                   : route === 'lionel' ? 'Lionel Support (manuals & parts diagrams)'
                   : route === 'mth' ? 'MTH Parts & Sales (diagrams & parts)'
                   : route === 'atlas' ? (_atlasHit ? 'Parts diagram: ' + _atlasHit.t : 'Atlas parts diagrams')
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
          (function () {
            // v0.9.1644 (Brad's spec): MANUFACTURER source first — direct
            // PDF when we have it, honest "there isn't one" when we don't —
            // then always: Google the parts diagram + Trainz parts diagrams.
            // Postwar order once Brad's originals are uploaded: his Lionel
            // parts diagrams FIRST, then LCCA. (Slot reserved below.)
            var mk = _makerName(item, eraKey) || 'this maker';
            var num = String(item.itemNum || '').trim();
            var h = '';
            // ── the manufacturer row ──
            if (route === 'lcca') {
              // FUTURE SLOT: Brad's original Lionel parts diagrams go here, above LCCA.
              h += '<button onclick="_maintLccaGo(\'' + _esc(_docsUrl(route, item)) + '\')" style="' + linkBtn + '">' + _esc(routeLabel) + ' →</button>'
                + '<div id="maint-lcca-note" style="display:none;font-size:0.8rem;color:var(--text);background:var(--bg-card);background:color-mix(in srgb, rgb(22,160,133) 12%, var(--surface2));border:1px solid #16a085;border-radius:8px;padding:0.55rem 0.7rem;margin-top:0.55rem"></div>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">' + (_pwsmHit ? 'Copies the link to this item\'s manual section and opens LCCA in a new tab — see the note above after you tap.' : 'No direct section mapped — the button copies the archive link; paste it in the LCCA tab.') + ' Requires LCCA membership.</div>';
            } else if (route === 'atlas' && _atlasHit) {
              h += '<button onclick="window.open(\'' + _esc(ATLAS_DL + _atlasHit.u) + '\',\'_blank\')" style="' + linkBtn + '">Parts diagram: ' + _esc(_atlasHit.t) + ' →</button>';
            } else if (route === 'atlas') {
              h += '<button onclick="window.open(\'' + ATLAS_PAGE + '\',\'_blank\')" style="' + linkBtn + '">Atlas parts diagrams (browse) →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">No family match for ' + _esc(num) + ' — find your model on Atlas\'s list.</div>';
            } else if (route === 'mth') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" style="' + linkBtn + '">MTH Parts &amp; Sales: search ' + _esc(num) + ' →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">MTH has exploded diagrams for many (not all) items — look for the gears icon.</div>';
            } else {
              h += '<div style="font-size:0.8rem;color:var(--text-dim);padding:0.4rem 0;border-bottom:1px dashed var(--border);margin-bottom:0.5rem">' + _esc(mk) + ' does not publish a parts list for this one — use the searches below.</div>';
            }
            // ── always: Google + Trainz ──
            var gq = 'https://www.google.com/search?q=' + encodeURIComponent('"' + mk + '" "' + num + '" parts diagram');
            var tz = 'https://www.trainz.com/search?q=' + encodeURIComponent(mk + ' ' + num + ' parts');
            h += '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;flex-wrap:wrap">'
              +   '<button onclick="window.open(\'' + _esc(gq) + '\',\'_blank\')" style="padding:0.4rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.78rem;cursor:pointer">Google the parts diagram →</button>'
              +   '<button onclick="window.open(\'' + _esc(tz) + '\',\'_blank\')" style="padding:0.4rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.78rem;cursor:pointer">Trainz parts diagrams →</button>'
              + '</div>';
            return h;
          })())

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
