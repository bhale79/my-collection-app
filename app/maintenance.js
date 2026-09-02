// ============================================================
//  maintenance.js — 🔧 Maintenance panel (v0.9.1641, Session 90)
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

  // ── v0.9.1641: the LCCA two-step (copy link + open site) ─────
  // PROVEN: LCCA's member cookie is SameSite-strict — it rides only on
  // user-initiated navigations (address-bar paste, bookmarks), NEVER on
  // links clicked from another site, token or no token (Brad tested
  // every form). So the button copies the exact PDF link and opens
  // lionelcollectors.org; the user pastes in that tab's address bar.
  window._maintLccaGo = function (url) {
    var done = function (ok) {
      window.open('https://www.lionelcollectors.org', '_blank');
      if (typeof showToast === 'function')
        showToast(ok ? 'Manual link copied! In the LCCA tab: click the address bar, paste (Ctrl+V), hit Enter. Sign in first if asked.'
                     : 'Could not copy — long-press the button to copy the link manually.', 7000, !ok);
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
          (route === 'lcca'
            ? '<button onclick="_maintLccaGo(\'' + _esc(_docsUrl(route, item)) + '\')" style="' + linkBtn + '">' + _esc(routeLabel) + ' →</button>'
            : '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" style="' + linkBtn + '">' + _esc(routeLabel) + ' →</button>')
          + (route === 'lcca'
            ? ((_pwsmHit ? '<div style="margin-top:0.5rem"><button onclick="_maintLccaGo(\'' + PWSM_HOME + '\')" style="padding:0.4rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.78rem;cursor:pointer">Browse the whole archive →</button></div>' : '')
              + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">' + (_pwsmHit ? 'Copies the link to this item\'s manual section and opens LCCA in a new tab — paste the link in that tab\'s address bar (LCCA\'s login only allows links opened by you, not by apps).' : 'No direct section mapped for ' + _esc(String(item.itemNum || '')) + ' — the button copies the archive link; paste it in the LCCA tab.') + ' Requires LCCA membership.</div>')
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
