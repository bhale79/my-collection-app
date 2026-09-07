// ============================================================
//  maintenance.js — Maintenance panel + Workbench + My Manuals + task cards + Parts Bin (v0.9.1672, Session 92)
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
    // v0.9.1664 (Brad): beta testers — they get the whole maintenance suite
    // (button, Workbench, parts lifecycle, My Manuals). NOT the Yardmaster's
    // Office; that list lives in yardmaster.js and stays owner-only.
    BETA_EMAILS: ['browntailflyer@gmail.com'],
    PREF_CHANNELS: 'maint_yt_channels',   // JSON array of channel names
    PREF_DEALERS:  'maint_parts_dealers', // JSON array of dealer names
    PREF_SUPPLIERS: 'maint_diagram_suppliers', // JSON array; seeded with Trainz
  };

  function _isOwner() {
    try {
      var em = window.state && state.user && String(state.user.email || '').toLowerCase();
      return !!em && (MAINT.OWNER_EMAILS.indexOf(em) >= 0 || MAINT.BETA_EMAILS.indexOf(em) >= 0);
    } catch (e) { return false; }
  }
  window._maintIsOwner = _isOwner;   // app-collection.js gates the button on this

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── THE SCHEME IS THE WIZARD'S (v0.9.1678, Brad: "we should be matching
  //    this scheme" — the Collection · Step 1 of 6 card) ───────────────────
  // Card: .rr-card (orange top bar, the app's standard pop-up since v1143).
  // Header: .modal-item-num mono context line over a .rr-card-title, with
  // the round .btn-close ✕. Field labels: grey uppercase. Footer buttons:
  // .btn btn-secondary (CANCEL) and ONE .btn btn-primary (NEXT) per screen.
  // In-body buttons: the wizard's quiet control (Clear filters / Box Only) —
  // surface2, border, body font. Text only, no icons. Every helper below
  // returns the class+style ATTRIBUTES, so a button is written as
  //   '<button onclick="…" ' + _btn() + '>Label</button>'
  var _QUIET = 'background:var(--surface2);color:var(--text-mid);border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;line-height:1.2';
  function _btnSize(size) { return size === 'sm' ? 'padding:0.35rem 0.65rem;font-size:0.76rem' : 'padding:0.5rem 0.8rem;font-size:0.82rem'; }
  function _attr(cls, style) { return 'class="' + cls + '"' + (style ? ' style="' + style + '"' : ''); }
  // in-body button; color is only a hint: 'red' = destructive text
  function _btn(color, size, extra) {
    return _attr('maint-btn', _btnSize(size) + ';' + _QUIET + (color === 'red' ? ';color:#e74c3c' : '') + (extra ? ';' + extra : ''));
  }
  function _btnQuiet(size, extra) { return _btn('', size, extra); }
  // footer pair — the wizard's CANCEL / NEXT
  function _btnPrimary(extra) { return _attr('btn btn-primary', extra || ''); }
  function _btnSecondary(extra) { return _attr('btn btn-secondary', extra || ''); }
  function _btnSave(extra) { return _btnPrimary(extra); }
  function _btnCancel(extra) { return _btnSecondary(extra); }
  // card chrome: the wizard header (mono context line, big title, round ✕)
  var LB = 'font-size:0.72rem;color:var(--text-dim);display:block;margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.06em;font-weight:600';
  var SECT = 'font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);font-weight:600;margin-bottom:0.6rem';
  function _cardOpen(maxW) { return '<div class="rr-card maint-card" style="max-width:' + (maxW || 520) + 'px;margin-bottom:2rem">'; }
  function _cardHead(context, title, closeJs) {
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;margin-bottom:0.9rem">'
      + '<div style="min-width:0">' + (context ? '<div class="modal-item-num">' + context + '</div>' : '') + '<div class="rr-card-title" style="margin-bottom:0">' + title + '</div></div>'
      + (closeJs ? '<button class="btn-close" onclick="' + closeJs + '" aria-label="Close">&#x2715;</button>' : '')
      + '</div>';
  }
  // v0.9.1679 (Brad: "match all the desktop only screens to the maintenance
  // box size"): the Workbench and Parts Bin pages sit in ONE wrapper that
  // shares the maintenance box's desktop zoom rule (.rr-desk-zoom, app.css).
  function _dz(html) { return '<div class="rr-desk-zoom">' + html + '</div>'; }
  function _cardFoot(inner) { return '<div style="display:flex;gap:0.75rem;justify-content:flex-end;padding-top:1rem;margin-top:0.5rem;border-top:1px solid var(--border)">' + inner + '</div>'; }

  // ── favorites (per-device prefs) ─────────────────────────────
  function _favs(key) {
    try {
      var v = (typeof _prefGet === 'function') ? _prefGet(key, '[]') : '[]';
      var a = JSON.parse(v);
      a = Array.isArray(a) ? a.filter(Boolean) : [];
      // Trainz ships in the supplier list — Brad: "I just know Trainz is
      // going to be popular, make sure it works great." Removable like any
      // favorite; it just starts there.
      if (key === MAINT.PREF_SUPPLIERS && !a.length && !_prefGet(key + '_touched', '')) a = ['Trainz', 'The Train Tender', "Henning's Trains"];   // v0.9.1652: verified-live sellers from the suppliers scan
      return a;
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

  // ── v0.9.1646: Trainz exploded diagrams (see trainz-diagrams-config.js) ──
  var _tzLookup = null;
  function _tzDiagram(item) {
    var list = window.TRAINZ_DIAGRAMS;
    if (!list || !list.length) return null;
    if (!_tzLookup) {
      _tzLookup = {};
      list.forEach(function (e) {
        e.n.split('|').forEach(function (k) { if (k && _tzLookup[k] == null) _tzLookup[k] = e; });
      });
    }
    var n = String(item && item.itemNum || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^X/, '');
    if (!n) return null;
    var tries = [n];
    if (/^6\d{4,}$/.test(n)) tries.push(n.slice(1));          // 618860 -> 18860
    else if (/^\d{4,}$/.test(n)) tries.push('6' + n);         // 18860 -> 618860
    var base = n.replace(/[A-Z]+$/, '');
    if (base && base !== n) tries.push(base);                 // 2343C -> 2343 (after exact)
    for (var i = 0; i < tries.length; i++) if (_tzLookup[tries[i]]) return _tzLookup[tries[i]];
    return null;
  }

  // ── v0.9.1690: Maerklin's own spare-parts index (marklin-parts-config.js).
  // Maerklin keys everything by article number and never re-uses one, so this
  // is an exact-number lookup — no prefix juggling, unlike Lionel. Only
  // Maerklin-tab items ask, so an Atlas 37087 cannot borrow a Maerklin sheet.
  function _marklinParts(item) {
    var P = window.MARKLIN_PARTS;
    if (!P || !item) return null;
    var era = String(item._era || item.era || '').toLowerCase();
    var mfr = String(item.manufacturer || '').toLowerCase();
    if (era.indexOf('marklin') !== 0
        && mfr.indexOf('marklin') < 0 && mfr.indexOf('m\u00e4rklin') < 0) return null;
    var n = String(item.itemNum || '').trim().replace(/[^0-9]/g, '');
    if (!n) return null;
    var e = P[n] || P[n.replace(/^0+/, '')] || P['0' + n];
    if (!e) return null;
    var out = { t: e.t || '', d: e.d || '', s: e.s ? 1 : 0, num: n };
    return (out.d || out.s) ? out : null;
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
    if (e === 'mpc' || e === 'mod' || e === 'mod_ho' || e === 'mod_s' || e === 'kline') return 'lionel';   // modern AF + HO are Lionel-made, serviced on lionelsupport
    if (e.indexOf('mth') === 0) return 'mth';
    if (e.indexOf('atlas') === 0) return 'atlas';
    // v0.9.1652 — the parts-suppliers scan (PARTS_SUPPLIERS_SCAN_2026-09-03.md)
    if (e === 'lgb') return 'lgb';
    if (e === 'usatrains') return 'usatrains';
    if (e.indexOf('bachmann') === 0 || e === 'williams') return 'bachmann';
    if (e === 'thirdrail') return 'thirdrail';
    if (e === 'weaver') return 'weaver';
    if (e === 'aristocraft') return 'aristocraft';
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
  // v0.9.1645 (Brad's ET44): the item number alone finds nothing — the
  // query needs the MODEL words. Description first (may carry "GP15T"),
  // then the item type ("Diesel Locomotive"); road name skipped when the
  // description already is the road name (the ET44's was).
  function _modelWords(item) {
    var d = _shortName(item);
    var t = String(item && (item.itemType || item.type) || '').trim();
    var road = String(item && item.roadName || '').trim().toLowerCase();
    if (d && road && d.toLowerCase() === road) d = '';
    return [d, t].filter(Boolean).join(' ').trim();
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
      // v0.9.1649 (Brad supplied the working URL): lionelsupport's real
      // search param is ?keywords= (the ?q= guess rendered empty). Bare
      // SKU form — 17294, not 6-17294.
      return 'https://www.lionelsupport.com/search?keywords=' + encodeURIComponent(num.replace(/^6-/, ''));
    if (route === 'mth')
      return 'https://mthpartsandsales.com/shop/search/results?type=lists&searchContext=' + encodeURIComponent(num);   // v0.9.1651 (Brad): type=lists lands on the PART LISTS view — Mechanical / Electronics side by side, user picks
    if (route === 'atlas')
      return ATLAS_PAGE;   // family match handled in the panel (needs the era)
    if (route === 'lgb')
      return 'https://www.lgb.com/service/manuals-spare-parts/spare-parts-search';   // official; accepts OLD LGB numbers
    if (route === 'usatrains')
      return 'http://usatdb.largescaletrains.com';   // community diagram archive (USA Trains publishes none)
    if (route === 'bachmann')
      return 'https://estore.bachmanntrains.com/index.php?main_page=advanced_search_result&keyword=' + encodeURIComponent(num);
    if (route === 'thirdrail')
      return 'https://www.get3rparts.com';   // official OEM parts home for 3rd Rail/Sunset/GGD
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
      + '<button onclick="_maintAddFav(\'' + prefKey + '\',\'' + selectId + '\')" title="Add a favorite" ' + _btnQuiet() + '>+ Add</button>'
      + '<button onclick="_maintDelFav(\'' + prefKey + '\',\'' + selectId + '\')" title="Remove the selected favorite" ' + _btnQuiet() + '>&minus;</button>'
      + '</div>';
  }
  window._maintAddFav = function (prefKey, selectId) {
    var name = prompt(prefKey === MAINT.PREF_CHANNELS
      ? 'YouTube channel name or @handle (e.g. @TrainRepairGuy):'
      : prefKey === MAINT.PREF_SUPPLIERS
      ? 'Parts supplier name (e.g. Trainz, Olsen\'s):'
      : 'Parts dealer name (e.g. Joe\'s Train Shop):');
    if (!name || !String(name).trim()) return;
    name = String(name).trim();
    var favs = _favs(prefKey);
    if (favs.indexOf(name) < 0) { favs.push(name); _saveFavs(prefKey, favs); }
    try { if (typeof _prefSet === 'function') _prefSet(prefKey + '_touched', '1'); } catch (e2) {}
    var sel = document.getElementById(selectId);
    if (sel) {
      var o = document.createElement('option');
      o.value = name; o.textContent = name; sel.appendChild(o); sel.value = name;
    }
  };
  // v0.9.1647 (phase 2): create a Parts Needed entry pre-linked to THIS
  // owned copy (the _maintPanelInvId hook from v1637, cashed in).
  // window._maintAddPartWanted removed in v0.9.1670 (its section went away).
  // v0.9.1662: _maintSupplierGo removed with the docs suppliers dropdown (check 273 flagged it unreachable).

  window._maintDelFav = function (prefKey, selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || !sel.value) return;
    var favs = _favs(prefKey).filter(function (f) { return f !== sel.value; });
    _saveFavs(prefKey, favs);
    try { if (typeof _prefSet === 'function') _prefSet(prefKey + '_touched', '1'); } catch (e2) {}
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
    // v0.9.1648 (Brad's Lionel 54 Ballast Tamper opening as the MARX 54
    // KCS): number+variation is STILL not an identity — catalog numbers
    // repeat ACROSS MAKERS (the v1157 lesson). The owned copy knows its
    // era, so the inventoryId anchors it.
    var wantEra = null;
    try {
      if (invId && window.state && state.personalData) {
        var pdk = Object.keys(state.personalData).find(function (k) {
          var p = state.personalData[k];
          return p && String(p.inventoryId || '') === String(invId) && String(p.itemNum || '').trim() === want;
        });
        if (pdk && typeof _itemEraKey === 'function') wantEra = _itemEraKey(state.personalData[pdk]);
      }
    } catch (e0) {}
    var eraOf = function (m) { try { return (typeof _itemEraKey === 'function') ? _itemEraKey(m) : (m._era || null); } catch (e1) { return null; } };
    var fits = function (m, needVar, needEra) {
      if (!m || String(m.itemNum || '').trim() !== want) return false;
      if (needVar && wantVar && String(m.variation || '').trim() !== wantVar) return false;
      if (needEra && wantEra && eraOf(m) !== wantEra) return false;
      return true;
    };
    var item = null;
    var cand = (window.state && state.masterData && idx >= 0) ? state.masterData[idx] : null;
    if (cand && (!want || fits(cand, false, true))) item = cand;
    if (!item && want && window.state && state.masterData) {
      var md = state.masterData;
      item = md.find(function (m) { return fits(m, true, true); })
          || md.find(function (m) { return fits(m, false, true); })
          || md.find(function (m) { return fits(m, true, false); })
          || md.find(function (m) { return fits(m, false, false); })
          || null;
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

    // v0.9.1655 (Brad's v2 flow): the panel is a LAUNCHER; each section
    // belongs to a group (docs / work) shown one at a time.
    var sec = function (title, inner, grp) {
      return '<div class="maint-sec" data-grp="' + (grp || 'docs') + '" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1rem;margin-bottom:0.8rem">'
        + '<div style="' + SECT + '">' + title + '</div>'
        + inner + '</div>';
    };
    var linkBtn = _btn('blue');
    // the launcher's three choices: the same scheme, the header blue, a
    // size up, with a one-line description under the label
    // v0.9.1678 (Brad): the label is the page's text colour (cream on the
    // dark theme) — only the outline is blue
    // the launcher's three choices: the wizard's CANCEL-style block, full
    // width, with a one-line plain-case description under the label
    var bigBtn = _btnSecondary('display:flex;flex-direction:column;align-items:flex-start;gap:0.2rem;width:100%;text-align:left;padding:0.8rem 1rem;font-size:0.9rem');

    // v0.9.1665 (Brad): a stray click outside the card used to close the
    // whole panel and lose everything typed. Close is the × (or Back) only.
    var html = '<div id="maint-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9500;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem">'
      + _cardOpen(560)
      + _cardHead('No. ' + _esc(item.itemNum || '') + (item.roadName ? ' · ' + _esc(item.roadName) : ''), 'Maintenance', '_maintClosePanel()')
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin:-0.3rem 0 0.8rem">Beta preview — only you (and invited testers) can see this button.</div>'
      + '<div id="maint-launcher" style="display:flex;flex-direction:column;gap:0.55rem;margin-bottom:0.8rem">'
      +   '<button onclick="_maintShowGrp(\'docs\')" ' + bigBtn + '>Find manuals &amp; diagrams<span style="display:block;font-weight:400;font-size:0.76rem;color:var(--text-dim);font-family:var(--font-body);text-transform:none;letter-spacing:0">Your saved docs, factory sources, searches</span></button>'
      +   '<button onclick="_maintShowGrp(\'work\')" ' + bigBtn + '>Work on it<span style="display:block;font-weight:400;font-size:0.76rem;color:var(--text-dim);font-family:var(--font-body);text-transform:none;letter-spacing:0">Chores, parts and repair videos for this item</span></button>'
      +   '<button onclick="_maintShowHistory(\'' + _esc(String(window._maintPanelInvId || '')) + '\',\'' + _esc(String(item.itemNum || '')) + '\')" ' + bigBtn + '>Service history<span style="display:block;font-weight:400;font-size:0.76rem;color:var(--text-dim);font-family:var(--font-body);text-transform:none;letter-spacing:0">Everything ever done to this one</span></button>'
      + '</div>'
      + '<button id="maint-back" onclick="_maintShowGrp(\'\')" ' + _btnSecondary('display:none;margin-bottom:0.6rem;padding:0.45rem 0.8rem;font-size:0.78rem') + '>← Back</button>'
      + '<div class="maint-sec" data-grp="docs" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1rem;margin-bottom:0.8rem">'
      +   '<div style="' + SECT + '">My saved docs for this item</div>'
      +   '<div id="maint-mydocs" style="font-size:0.82rem;color:var(--text-dim)">Loading…</div>'
      +   '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">'
      +     '<button onclick="_maintSavePicture()" ' + linkBtn + '>Save a picture</button>'
      +     '<button onclick="_maintSaveDocument()" ' + linkBtn + '>Save a document</button>'
      +     '<button onclick="_maintSaveLink()" ' + linkBtn + '>Save a link</button>'
      +   '</div>'
      +   '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.45rem">Save a screenshot, a PDF/document, or a manual link — it shows here for every item it covers, and in your Toolbox.</div>'
      + '</div>'

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
              h += '<button onclick="_maintLccaGo(\'' + _esc(_docsUrl(route, item)) + '\')" ' + linkBtn + '>' + _esc(routeLabel) + ' →</button>'
                + '<div id="maint-lcca-note" style="display:none;font-size:0.8rem;color:var(--text);background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 12%, var(--surface2));border:1px solid #2980b9;border-radius:8px;padding:0.55rem 0.7rem;margin-top:0.55rem"></div>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">' + (_pwsmHit ? 'Copies the link to this item\'s manual section and opens LCCA in a new tab — see the note above after you tap.' : 'No direct section mapped — the button copies the archive link; paste it in the LCCA tab.') + ' Requires LCCA membership.</div>'
                + '<div style="margin-top:0.5rem"><button onclick="window.open(\'https://www.olsenstoy.com/searchcd1.htm\',\'_blank\')" ' + _btnQuiet() + '>Olsen\'s service library (free, no login) →</button></div>';
            } else if (route === 'atlas' && _atlasHit) {
              h += '<button onclick="window.open(\'' + _esc(ATLAS_DL + _atlasHit.u) + '\',\'_blank\')" ' + linkBtn + '>Parts diagram: ' + _esc(_atlasHit.t) + ' →</button>';
            } else if (route === 'atlas') {
              h += '<button onclick="window.open(\'' + ATLAS_PAGE + '\',\'_blank\')" ' + linkBtn + '>Atlas parts diagrams (browse) →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">No family match for ' + _esc(num) + ' — find your model on Atlas\'s list.</div>';
            } else if (route === 'lionel') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" ' + linkBtn + '>Lionel Support: search ' + _esc(num.replace(/^6-/, '')) + ' →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Owner\'s manuals and parts on lionelsupport.com.</div>';
            } else if (route === 'mth') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" ' + linkBtn + '>MTH Parts &amp; Sales: search ' + _esc(num) + ' →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Lands on MTH\'s part lists for this item — pick Mechanical or Electronics. They add new lists monthly.</div>';
            } else if (route === 'lgb') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" ' + linkBtn + '>LGB spare-parts search (official) →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Marklin\'s official LGB spare-parts search — it accepts old LGB article numbers like ' + _esc(num) + '.</div>';
            } else if (route === 'usatrains') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" ' + linkBtn + '>USA Trains diagram archive (community) →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">USA Trains publishes no diagrams — this is the community-run archive. Their own site sells ~30 per-model service parts.</div>';
            } else if (route === 'bachmann') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" ' + linkBtn + '>Bachmann parts eStore: search ' + _esc(num) + ' →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Official Bachmann/Williams parts. Unlisted parts: parts@bachmanntrains.com.</div>';
            } else if (route === 'thirdrail') {
              h += '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" ' + linkBtn + '>Get 3R Parts (official 3rd Rail/Sunset) →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">50 years of Sunset/3rd Rail OEM parts, browse by project number. No diagrams exist.</div>';
            } else if (route === 'weaver') {
              h += '<div style="font-size:0.8rem;color:var(--text-dim);padding:0.4rem 0;border-bottom:1px dashed var(--border);margin-bottom:0.5rem">Weaver closed in 2015 — no official parts source. Try P&amp;D Hobby, eBay, or the searches below; some tooling went to Atlas O and Lionel.</div>';
            } else if (route === 'aristocraft') {
              h += '<button onclick="window.open(\'https://reindeerpass.com\',\'_blank\')" ' + linkBtn + '>Reindeer Pass (compatible motor blocks) →</button>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Aristo-Craft closed in 2013 — no OEM parts. Reindeer Pass sells compatible motor blocks and trucks.</div>';
            } else {
              h += '<div style="font-size:0.8rem;color:var(--text-dim);padding:0.4rem 0;border-bottom:1px dashed var(--border);margin-bottom:0.5rem">' + _esc(mk) + ' does not publish a parts list for this one — use the searches below.</div>';
            }
            // ── v0.9.1690: Maerklin publishes BOTH for about half its
            // catalogue — the exploded-diagram/manual sheet as a PDF on its
            // own server, and a live parts list in its shop, both keyed by
            // the same article number the catalog row already carries.
            // Links only; the sheet and the parts stay on Maerklin's side.
            var mkp = _marklinParts(item);
            if (mkp) {
              if (mkp.d) {
                h += '<div style="margin-top:0.5rem"><button onclick="window.open(\'' + _esc((window.MARKLIN_PARTS_PDF_BASE || '') + mkp.d) + '\',\'_blank\')" ' + linkBtn + '>Marklin exploded diagram (PDF)' + (mkp.t ? ': ' + _esc(mkp.t) : '') + ' \u2192</button></div>';
              }
              if (mkp.s) {
                h += '<div style="margin-top:0.5rem"><button onclick="window.open(\'' + _esc((window.MARKLIN_PARTS_SHOP || '') + encodeURIComponent(mkp.num)) + '\',\'_blank\')" ' + linkBtn + '>Marklin parts list for ' + _esc(mkp.num) + ' \u2192</button>'
                  + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Maerklin\'s own shop \u2014 every part they still stock for this model.</div></div>';
              }
            }
            // ── Trainz exploded diagram, when their library has this item ──
            var tzd = _tzDiagram(item);
            if (tzd) {
              h += '<div style="margin-top:0.5rem"><button onclick="window.open(\'https://www.trainz.com/pages/parts-diagram/' + _esc(tzd.h) + '\',\'_blank\')" ' + linkBtn + '>Trainz diagram: ' + _esc(tzd.t) + ' →</button></div>';
            }
            // ── always: Google (with MODEL words) + supplier dropdown ──
            var mw = _modelWords(item);
            var gq = 'https://www.google.com/search?q=' + encodeURIComponent(('"' + mk + '" "' + num + '" ' + mw + ' parts diagram').replace(/\s+/g, ' '));
            // v0.9.1662 (Brad): Parts Suppliers dropdown CUT from the docs
            // section — the Google button covers it. (The dealer dropdown in
            // Find-a-Part stays; _maintSupplierGo survives unused-by-docs.)
            h += '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;flex-wrap:wrap;align-items:center">'
              +   '<button onclick="window.open(\'' + _esc(gq) + '\',\'_blank\')" ' + _btnQuiet() + '>Google the parts diagram →</button>'
              + '</div>';
            return h;
          })(), 'docs')

      // ── Workbench (phase 3): chores + service history ──
      + sec('Tasks for this item',
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">'
          + '<select id="maint-chore-pick" onchange="_maintChorePickChange(this)" style="flex:1;min-width:150px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          + _allChores().map(function (ch) { return '<option value="' + _esc(ch) + '">' + _esc(ch) + '</option>'; }).join('')
          + '<option value="__custom">Something else…</option>'
          + '</select>'
          + '<button onclick="_maintAddChore()" ' + _btnPrimary('padding:0.5rem 0.9rem;font-size:0.78rem') + '>+ Add task</button>'
          + '</div>'
          + '<div id="maint-chore-custom" style="display:none;margin-top:0.4rem"><input id="maint-chore-custom-in" placeholder="Name the new task — it joins the list for next time" onkeydown="if(event.key===\'Enter\')_maintAddChore()" style="width:100%;box-sizing:border-box;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem"></div>'
          + '<div id="maint-tasks" style="margin-top:0.6rem"></div>'
          + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Each task is a card: notes, a part if it needs one, videos for the job, Done when it\'s done.</div>', 'work')

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
          +   '<button onclick="_maintSearchYt()" ' + linkBtn + '>Search →</button>'
          +   '<button onclick="_maintSaveVideo()" ' + linkBtn + '>Save a video</button>'
          + '</div>'
          + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Found a good one? Paste its link with Save a video — it joins My Manuals and your Toolbox, tagged with the part you typed.</div>', 'work')

      // v0.9.1670 (Brad): standalone Find-a-Part section REMOVED — Need a part on the task card covers it.


      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    window._maintShowGrp = function (g) {
      var ov = document.getElementById('maint-overlay'); if (!ov) return;
      ov.querySelectorAll('.maint-sec').forEach(function (el) { el.style.display = (g && el.getAttribute('data-grp') === g) ? '' : 'none'; });
      var l = document.getElementById('maint-launcher'); if (l) l.style.display = g ? 'none' : 'flex';
      var b = document.getElementById('maint-back'); if (b) b.style.display = g ? '' : 'none';
      if (g === 'docs') _maintRenderMyDocs();
      if (g === 'work') _maintRenderTasks();
    };
  };

  window._maintSearchYt = function () {
    if (!_panelItem) return;
    var ch = (document.getElementById('maint-yt-channel') || {}).value || '';
    var part = (document.getElementById('maint-yt-part') || {}).value || '';
    var act = (document.getElementById('maint-yt-action') || {}).value || '';
    window.open(_ytUrl(ch, _panelItem, part.trim(), act), '_blank');
  };
  // window._maintSearchParts removed in v0.9.1670 (its section went away).

  // ════════════════════════════════════════════════════════════════
  //  v0.9.1655: MY MANUALS — the personal doc library (v2 flow bite 1)
  //  Personal tab "My Manuals": Doc ID, Title, Type, URL, Covers,
  //  Topics, Notes, Date Added. covers = item numbers (fitment for
  //  documents); topics feed the future Toolbox filter.
  // ════════════════════════════════════════════════════════════════
  var DOCS_TAB = 'My Manuals';
  async function _ensureDocsTab() {
    try {
      var meta = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties',
        { headers: { Authorization: 'Bearer ' + accessToken } })).json();
      // v0.9.1675: a FAILED read (expired token → {error}, no sheets) is
      // not "the tab is missing". Bail; never try to create on a guess —
      // the header write that followed used to land in the offline outbox
      // as a phantom "1 change has not saved".
      if (!meta || !Array.isArray(meta.sheets)) return false;
      if (meta.sheets.some(function (sh) { return sh.properties && sh.properties.title === DOCS_TAB; })) return true;
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: DOCS_TAB, tabColor: { red: 0.16, green: 0.5, blue: 0.72 } } } }] })
      });
      await sheetsUpdate(state.personalSheetId, DOCS_TAB + '!A1:H1',
        [['Doc ID', 'Title', 'Type', 'URL', 'Covers', 'Topics', 'Notes', 'Date Added']]);
      return true;
    } catch (e) { console.warn('[MyManuals] ensure failed', e && e.message); return false; }
  }
  async function _loadMyDocs() {
    try {
      if (!(await _ensureDocsTab())) return;
      var res = await sheetsGet(state.personalSheetId, DOCS_TAB + '!A2:H').catch(function () { return { values: [] }; });
      // v0.9.1674: map THEN filter — the row number is the sheet position,
      // so a blanked (removed) row in the middle must still count. Filter-
      // then-map numbered every doc below a blank one row too high, and the
      // guarded writer would then refuse every edit ("changed somewhere else").
      state.myManuals = (res.values || []).map(function (r, i) {
        var g = function (j) { return (r[j] != null) ? String(r[j]) : ''; };
        return { row: i + 2, id: g(0), title: g(1), type: g(2), url: g(3), covers: g(4), topics: g(5), notes: g(6), date: _isoDate(g(7)) };
      }).filter(function (d) { return d.id; });
    } catch (e) { state.myManuals = state.myManuals || []; }
  }
  function _docCovers(item) {
    var n = String(item && item.itemNum || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return (state.myManuals || []).filter(function (d) {
      return d.covers.split(',').some(function (c) {
        var cc = c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        return cc && cc === n;
      });
    });
  }
  function _maintRenderMyDocs() {
    var el = document.getElementById('maint-mydocs');
    if (!el || !_panelItem) return;
    var render = function () {
      var docs = _docCovers(_panelItem);
      if (!docs.length) { el.innerHTML = 'Nothing saved for this item yet.'; return; }
      el.innerHTML = docs.map(function (d) {
        return '<div style="padding:0.35rem 0;border-bottom:1px solid var(--border)">'
          + '<a href="' + _esc(d.url) + '" target="_blank" rel="noopener" style="color:var(--accent2);font-weight:600;text-decoration:none">' + _esc(d.title || 'untitled') + '</a>'
          + ' <span style="color:var(--text-dim);font-size:0.72rem">' + _esc(d.type || 'link') + '</span>'
          + (d.topics ? ' <span style="color:var(--text-dim);font-size:0.72rem">[' + _esc(d.topics) + ']</span>' : '')
          + '</div>';
      }).join('');
    };
    if (state.myManuals) render(); else _loadMyDocs().then(render);
  }
  window._maintRenderMyDocs = _maintRenderMyDocs;

  function _suggestCovers(item) {
    // prefill from what we already KNOW: the item + LCCA/Trainz families
    var out = [String(item.itemNum || '').trim()];
    try {
      var pf = _pwsmFile(String(item.itemNum || ''));
      if (pf && PWSM_FILES[pf]) PWSM_FILES[pf].split(',').forEach(function (n) { if (n && out.indexOf(n) < 0) out.push(n); });
      var tz = _tzDiagram(item);
      if (tz) tz.n.split('|').forEach(function (n) { if (n && out.indexOf(n) < 0) out.push(n); });
    } catch (e) {}
    return out.slice(0, 20).join(', ');
  }
  // v0.9.1656 (Brad: the prompt boxes VANISH when you switch windows to
  // copy something): one persistent FORM instead of a prompt chain. It
  // stays open across window switches; nothing saves until Save.
  function _docForm(type, fixedUrl, pendingFile, presetTopic, opts) {
    // v0.9.1674 (bite 3): opts.general = saving from the Toolbox with no
    // item in hand — Covers is optional there (a lube guide fits everything),
    // so a topic OR an item number is required instead, else it could never
    // be found again.
    var general = !!(opts && opts.general);
    var old = document.getElementById('maint-docform'); if (old) old.remove();
    var IN = 'width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.7rem';
    var html = '<div id="maint-docform" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9700;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem" onclick="if(event.target===this && confirm(\'Close without saving?\'))this.remove()">'
      + _cardOpen(480)
      + _cardHead('My Manuals' + (general ? '' : ' · No. ' + _esc(String(_panelItem && _panelItem.itemNum || ''))), (type === 'picture' ? 'Save a picture' : type === 'document' ? 'Save a document' : type === 'video' ? 'Save a video' : 'Save a link'), "if(confirm('Close without saving?'))document.getElementById('maint-docform').remove()")
      + ((type === 'link' || type === 'video')
          ? '<label style="' + LB + '">' + (type === 'video' ? 'YouTube link (paste it)' : 'Link (paste it — switch windows all you like, this form waits)') + '</label><input id="docf-url" type="text" placeholder="https://…" style="' + IN + '">'
          : '<div style="font-size:0.82rem;color:var(--text);margin-bottom:0.7rem">' + _esc(pendingFile && pendingFile.name || 'File') + ' chosen ✓ — it uploads when you hit Save.</div>')
      + '<label style="' + LB + '">Name</label><input id="docf-title" type="text" placeholder="e.g. Vulcan switcher service pages" style="' + IN + '">'
      + '<label style="' + LB + '">Covers (item numbers, comma-separated' + (general ? ' — optional' : '') + ')</label><input id="docf-covers" type="text" value="' + _esc(general ? '' : _suggestCovers(_panelItem)) + '" placeholder="' + (general ? 'leave blank if it applies to everything' : '') + '" style="' + IN + '">'
      + '<label style="' + LB + '">Topics (e.g. traction tire, e-unit' + (general ? '' : ' — optional') + ')</label><input id="docf-topics" type="text" value="' + _esc(presetTopic || '') + '" placeholder="' + (general ? 'what is it about? — this is how the Toolbox finds it' : '') + '" style="' + IN + '">'
      + _cardFoot('<button onclick="document.getElementById(\'maint-docform\').remove()" ' + _btnCancel() + '>Cancel</button>'
      + '<button id="docf-save" ' + _btnSave() + '>Save</button>')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (window.BackStack && BackStack.wire) BackStack.wire(document.getElementById('maint-docform'));
    document.getElementById('docf-save').onclick = async function () {
      var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
      var url = fixedUrl || g('docf-url');
      if (type === 'link' || type === 'video') {
        if (!url) { if (typeof showToast === 'function') showToast('Paste the link first.', 2500, true); return; }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      }
      var covers = g('docf-covers');
      var topics = g('docf-topics');
      if (!covers && !general) { if (typeof showToast === 'function') showToast('Covers is empty — at least this item\u2019s number.', 3000, true); return; }
      if (!covers && !topics) { if (typeof showToast === 'function') showToast('Give it a topic or an item number so the Toolbox can find it again.', 3500, true); return; }
      var title = g('docf-title') || (type === 'picture' ? 'Saved diagram' : url.replace(/^https?:\/\//, '').slice(0, 60));
      var btn = this; btn.disabled = true; btn.textContent = 'Saving…';
      try {
        if (pendingFile) {
          await driveEnsureSetup();
          var folder = await driveFindOrCreateFolder('Manuals', driveCache.photosId);
          var ext = (pendingFile.name && pendingFile.name.indexOf('.') >= 0) ? pendingFile.name.slice(pendingFile.name.lastIndexOf('.')) : '';
          var up = await driveUploadPhoto(pendingFile, 'manual-' + Date.now() + ext, folder);
          if (!up || !up.id) throw new Error('upload failed');
          url = 'https://drive.google.com/file/d/' + up.id + '/view';
        }
        if (!(await _ensureDocsTab())) throw new Error('My Manuals tab unavailable');
        var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
        await sheetsAppend(state.personalSheetId, DOCS_TAB + '!A:H',
          [[_t('doc-' + Date.now()), title, type, url, covers, topics, '', _t(new Date().toISOString().split('T')[0])]]);
        state.myManuals = null;
        var f = document.getElementById('maint-docform'); if (f) f.remove();
        _maintRenderMyDocs();
        _tbRefresh();   // v0.9.1674: the Toolbox, if it is on screen, shows the new one
        if (typeof showToast === 'function') showToast('✓ Saved to My Manuals');
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Save';
        if (typeof showToast === 'function') showToast('Could not save — ' + (e && e.message || 'try again'), 4000, true);
      }
    };
    var first = document.getElementById(type === 'link' ? 'docf-url' : 'docf-title'); if (first) first.focus();
  }
  window._maintSaveLink = function () { if (_panelItem) _docForm('link', null, null); };
  window._maintSaveVideo = function () {
    if (!_panelItem) return;
    var part = document.getElementById('maint-yt-part');
    _docForm('video', null, null, part ? String(part.value || '').trim() : '');
  };
  function _pickFile(accept, type, opts) {
    if (!_panelItem && !(opts && opts.general)) return;
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (f) _docForm(type, null, f, '', opts);
    };
    inp.click();
  }
  window._maintSavePicture = function () { _pickFile('image/*', 'picture'); };
  window._maintSaveDocument = function () { _pickFile('.pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx', 'document'); };

  // ════════════════════════════════════════════════════════════════
  //  PHASE 3 (v0.9.1654, Session 92): THE WORKBENCH
  //  Brad's design calls: page name "Workbench"; badge counts ITEMS
  //  needing attention (an engine with 3 open needs counts once).
  //  Self-injecting owner-only nav + page (the yardmaster.js pattern).
  //  Data: 'Maintenance Log' personal-sheet tab (append-mostly) +
  //  the phase-2 parts lifecycle already in state.partsData.
  // ════════════════════════════════════════════════════════════════
  var LOG_TAB = 'Maintenance Log';
  // v0.9.1661 (Brad): Find-a-part and Test-run cut (didn't make sense as
  // chores), Change battery added, and CUSTOM chores are REMEMBERED —
  // type one once via "Something else…" and it joins the dropdown.
  var CHORES = ['Oil / lubricate', 'Replace traction tire', 'Clean rollers & wheels', 'E-unit service', 'Change battery'];
  MAINT.PREF_CHORES = 'maint_custom_chores';
  function _allChores() {
    var custom = _favs(MAINT.PREF_CHORES);
    return CHORES.concat(custom.filter(function (c) { return CHORES.indexOf(c) < 0; }));
  }

  async function _ensureLogTab() {
    try {
      var meta = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties',
        { headers: { Authorization: 'Bearer ' + accessToken } })).json();
      // v0.9.1675: a FAILED read (expired token → {error}, no sheets) is
      // not "the tab is missing". Bail; never try to create on a guess —
      // the header write that followed used to land in the offline outbox
      // as a phantom "1 change has not saved".
      if (!meta || !Array.isArray(meta.sheets)) return false;
      if (meta.sheets.some(function (sh) { return sh.properties && sh.properties.title === LOG_TAB; })) return true;
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: LOG_TAB, tabColor: { red: 0.09, green: 0.63, blue: 0.52 } } } }] })
      });
      await sheetsUpdate(state.personalSheetId, LOG_TAB + '!A1:K1',
        [['Log ID', 'Inventory ID', 'Item Number', 'Type', 'Text', 'Part Number', 'Serviced By', 'Date Added', 'Date Done', 'Status', 'Notes']]);
      return true;
    } catch (e) { console.warn('[Workbench] ensure log tab failed', e && e.message); return false; }
  }
  // v0.9.1666: task NOTES live on the task row (column K, appended at the end)
  async function _ensureLogNotesCol() {
    try {
      var r = await sheetsGet(state.personalSheetId, LOG_TAB + '!K1').catch(function () { return { values: [] }; });
      if (String(((r.values || [])[0] || [])[0] || '') === 'Notes') return true;
      await sheetsUpdate(state.personalSheetId, LOG_TAB + '!K1', [['Notes']]);
      return true;
    } catch (e) { return false; }
  }

  // v0.9.1669: Sheets turned our ISO dates into serial numbers (46270)
  // on USER_ENTERED writes and handed digits back. Translate on read;
  // write dates as text (leading apostrophe) from now on.
  function _isoDate(v) {
    var t = String(v == null ? '' : v).trim();
    if (/^\d{5}$/.test(t)) {
      var d = new Date(Date.UTC(1899, 11, 30) + parseInt(t, 10) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return t;
  }
  window._maintIsoDate = _isoDate;
  function _parseLog(values) {
    var out = [];
    (values || []).forEach(function (r, i) {
      if (!r[0] || r[0] === 'Log ID') return;
      var g = function (j) { return (r[j] !== null && r[j] !== undefined) ? String(r[j]) : ''; };
      out.push({ row: i + 2, id: g(0), invId: g(1), itemNum: g(2), type: g(3), text: g(4),
                 partNum: g(5), by: g(6), dateAdded: _isoDate(g(7)), dateDone: _isoDate(g(8)), status: g(9) || 'done', notes: g(10) });
    });
    return out;
  }

  async function _loadLog() {
    try {
      if (!(await _ensureLogTab())) return;
      var res = await sheetsGet(state.personalSheetId, LOG_TAB + '!A2:K').catch(function () { return { values: [] }; });
      state.maintLog = _parseLog(res.values);
    } catch (e) { state.maintLog = state.maintLog || []; }
  }

  function _openNeeds() {
    // item-keyed open needs: open chores (log) + open linked parts (partsData)
    var by = {};
    var add = function (invId, itemNum, need) {
      var k = invId || ('num:' + itemNum);
      if (!by[k]) by[k] = { invId: invId, itemNum: itemNum, needs: [] };
      by[k].needs.push(need);
    };
    (state.maintLog || []).forEach(function (l) {
      if (l.type === 'chore' && l.status === 'open') add(l.invId, l.itemNum, { kind: 'chore', label: l.text, since: l.dateAdded, row: l.row, id: l.id });
    });
    Object.values(state.partsData || {}).forEach(function (p) {
      var st = p.status || 'wanted';
      if ((st === 'wanted' || st === 'bought') && (p.forInv || p.forItem))
        add(p.forInv, p.forItem, { kind: 'part', label: (st === 'bought' ? 'in the drawer: ' : 'part wanted: ') + (p.description || p.partNum || 'part'), since: p.dateAdded });
    });
    return Object.values(by);
  }

  function _wbBadge() {
    var b = document.getElementById('nav-workbench-count');
    if (b) { var n = _openNeeds().length; b.textContent = n ? n : ''; b.style.display = n ? '' : 'none'; }
  }

  window._maintChorePickChange = function (sel) {
    var box = document.getElementById('maint-chore-custom');
    if (box) box.style.display = (sel && sel.value === '__custom') ? '' : 'none';
    if (box && sel && sel.value === '__custom') { var i = box.querySelector('input'); if (i) i.focus(); }
  };
  window._maintAddChore = async function () {
    if (!_isOwner() || !_panelItem) return;
    var sel = document.getElementById('maint-chore-pick');
    var customIn = document.getElementById('maint-chore-custom-in');
    var chore = sel && sel.value === '__custom' ? (customIn ? String(customIn.value || '').trim() : '') : (sel ? sel.value : '');
    if (!chore) { if (typeof showToast === 'function') showToast('Type the new task first.', 2500, true); return; }
    if (sel && sel.value === '__custom') {
      var customs = _favs(MAINT.PREF_CHORES);
      if (customs.indexOf(chore) < 0 && CHORES.indexOf(chore) < 0) { customs.push(chore); _saveFavs(MAINT.PREF_CHORES, customs); }
    }
    try {
      if (!(await _ensureLogTab())) throw new Error('log tab unavailable');
      var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
      var row = [_t('log-' + Date.now()), _t(window._maintPanelInvId || ''), _t(String(_panelItem.itemNum || '')),
                 'chore', chore, '', '', _t(new Date().toISOString().split('T')[0]), '', 'open'];
      await sheetsAppend(state.personalSheetId, LOG_TAB + '!A:J', [row]);
      await _loadLog(); _wbBadge(); _maintRenderTasks();
      if (customIn) customIn.value = '';
      if (typeof showToast === 'function') showToast('✓ On the Workbench: ' + chore);
    } catch (e) { if (typeof showToast === 'function') showToast('Could not save the chore — ' + (e && e.message || 'try again'), 4000, true); }
  };

  window._maintChoreDone = async function (rowNum, logId) {
    var today = new Date().toISOString().split('T')[0];
    try {
      var ok = (typeof rrVerifiedRowUpdate === 'function')
        ? await rrVerifiedRowUpdate(state.personalSheetId, LOG_TAB, rowNum, LOG_TAB + '!I' + rowNum + ':J' + rowNum, [["'" + today, 'done']], { num: logId }, 'Workbench')
        : false;
      if (!ok) return;
      var l = (state.maintLog || []).find(function (x) { return x.row === rowNum; });
      if (l) { l.status = 'done'; l.dateDone = today; }
      _wbBuild(); _wbBadge(); _maintRenderTasks();
      if (typeof showToast === 'function') showToast('✓ Done — written to the service history');
    } catch (e) { if (typeof showToast === 'function') showToast(rrSaveError ? rrSaveError(e, 'the chore') : 'Save failed', 4000, true); }
  };

  // _maintAddNote removed in v0.9.1672 (Brad: notes live on tasks; history entries edit in place).

  window._maintLogPartInstalled = async function (invId, itemNum, desc, partNum, by) {
    // called by app-pages._savePartInstalled (owner path) — the auto trail
    try {
      if (!(await _ensureLogTab())) return;
      var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
      var today = new Date().toISOString().split('T')[0];
      await sheetsAppend(state.personalSheetId, LOG_TAB + '!A:J',
        [[_t('log-' + Date.now()), _t(invId || ''), _t(String(itemNum || '')), 'part-installed', desc || 'part installed', _t(partNum || ''), by || 'self', _t(today), _t(today), 'done']]);
      await _loadLog(); _wbBadge();
      _maintRenderTasks();   // v0.9.1676: the task card's "Parts on hand" line becomes "Installed"
      if (_previewArgs && document.getElementById('maint-preview')) window._maintRenderPreview(_previewArgs.idx, _previewArgs.it, _previewArgs.pd);
    } catch (e) { console.warn('[Workbench] log part-installed failed', e && e.message); }
  };

  window._maintShowHistory = function (invId, itemNum) {
    var old = document.getElementById('wb-history'); if (old) old.remove();
    var entries = (state.maintLog || []).filter(function (l) {
      return (invId && l.invId === String(invId)) || (!invId && l.itemNum === String(itemNum));
    }).slice().sort(function (a, b) { return (b.dateDone || b.dateAdded || '').localeCompare(a.dateDone || a.dateAdded || ''); });
    // v0.9.1672 (Brad): entries are CLICKABLE (open to view/edit) and carry Remove.
    var lines = entries.map(function (l) {
      var icon = l.type === 'part-installed' ? 'Installed' : l.type === 'chore' ? (l.status === 'open' ? '' : '✓') : 'Note';
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid var(--border)">'
        + '<div onclick="_maintEditEntry(\'' + _esc(l.id) + '\')" title="Open to view or edit" style="flex:1;cursor:pointer;font-size:0.85rem;color:var(--text)">'
        + (icon ? icon + ' ' : '') + '<b>' + _esc(l.dateDone || l.dateAdded) + '</b> — ' + _esc(l.text)
        + (l.partNum ? ' <span style="font-family:var(--font-mono);color:var(--accent2)">#' + _esc(l.partNum) + '</span>' : '')
        + (l.by && l.by !== 'self' ? ' <span style="color:var(--text-dim)">(' + _esc(l.by) + ')</span>' : '')
        + (l.type === 'chore' && l.status === 'open' ? ' <span style="color:#e67e22">open</span>' : '')
        + (l.notes ? '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.15rem">' + _esc(l.notes).slice(0, 140) + (l.notes.length > 140 ? '…' : '') + '</div>' : '')
        + '</div>'
        + '<button onclick="_maintRemoveEntry(\'' + _esc(l.id) + '\')" ' + _btn('red', 'sm', 'flex-shrink:0') + '>Remove</button>'
        + '</div>';
    }).join('') || '<div style="color:var(--text-dim);font-size:0.85rem;padding:0.6rem 0">No service history yet.</div>';
    var html = '<div id="wb-history" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9600;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem" onclick="if(event.target===this)this.remove()">'
      + _cardOpen(520)
      + _cardHead('No. ' + _esc(itemNum), 'Service history', "document.getElementById('wb-history').remove()")
      + lines
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.6rem">Tap an entry to view or edit it.</div>'
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    window._wbHistoryCtx = { invId: invId, itemNum: itemNum };
  };

  // v0.9.1672: view/edit one history entry (text, serviced by, date, notes)
  window._maintEditEntry = function (logId) {
    var l = (state.maintLog || []).find(function (x) { return x.id === logId; });
    if (!l) return;
    var old = document.getElementById('wb-entry'); if (old) old.remove();
    var IN = 'width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.6rem';
    var kind = l.type === 'part-installed' ? 'Part installed' : l.type === 'chore' ? (l.status === 'open' ? 'Open task' : 'Completed task') : 'Service note';
    var html = '<div id="wb-entry" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9700;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem">'
      + _cardOpen(480)
      + _cardHead('No. ' + _esc(l.itemNum) + ' · Service history', kind, "document.getElementById('wb-entry').remove()")
      + '<label style="' + LB + '">What was done</label><input id="ent-text" type="text" value="' + _esc(l.text) + '" style="' + IN + '">'
      + '<div style="display:flex;gap:0.6rem"><div style="flex:1"><label style="' + LB + '">Date</label><input id="ent-date" type="date" value="' + _esc(l.dateDone || l.dateAdded) + '" style="' + IN + '"></div>'
      + '<div style="flex:1"><label style="' + LB + '">Serviced by</label><input id="ent-by" type="text" value="' + _esc(l.by) + '" placeholder="self / service station" style="' + IN + '"></div></div>'
      + (l.partNum ? '<label style="' + LB + '">Part number</label><input id="ent-part" type="text" value="' + _esc(l.partNum) + '" style="' + IN + ';font-family:var(--font-mono)">' : '')
      + '<label style="' + LB + '">Notes</label><textarea id="ent-notes" rows="4" style="' + IN + ';resize:vertical">' + _esc(l.notes || '') + '</textarea>'
      + _cardFoot('<button onclick="_maintRemoveEntry(\'' + _esc(l.id) + '\')" ' + _btnSecondary('margin-right:auto;color:#e74c3c') + '>Remove</button>'
      + '<button onclick="document.getElementById(\'wb-entry\').remove()" ' + _btnCancel() + '>Cancel</button>'
      + '<button id="ent-save" ' + _btnSave() + '>Save</button>')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (window.BackStack && BackStack.wire) BackStack.wire(document.getElementById('wb-entry'));
    document.getElementById('ent-save').onclick = async function () {
      var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
      var text = g('ent-text'); if (!text) { if (typeof showToast === 'function') showToast('Say what was done.', 2500, true); return; }
      var date = g('ent-date'), by = g('ent-by'), part = l.partNum ? g('ent-part') : l.partNum, notes = g('ent-notes');
      var btn = this; btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await _ensureLogNotesCol();
        var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
        // E..K: Text, Part Number, Serviced By, Date Added, Date Done, Status, Notes
        var dateDone = (l.type === 'chore' && l.status === 'open') ? '' : date;
        var vals = [[text, _t(part), by, _t(l.dateAdded || date), _t(dateDone), l.status, notes]];
        var ok = await rrVerifiedRowUpdate(state.personalSheetId, LOG_TAB, l.row, LOG_TAB + '!E' + l.row + ':K' + l.row, vals, { num: l.id }, 'service history');
        if (!ok) { btn.disabled = false; btn.textContent = 'Save'; return; }
        l.text = text; l.partNum = part; l.by = by; l.notes = notes; if (dateDone) l.dateDone = dateDone; else l.dateAdded = date || l.dateAdded;
        var f = document.getElementById('wb-entry'); if (f) f.remove();
        var ctx = window._wbHistoryCtx || {}; window._maintShowHistory(ctx.invId, ctx.itemNum);
        _maintRenderTasks(); _wbBuild();
        if (typeof showToast === 'function') showToast('✓ Entry updated');
      } catch (e) { btn.disabled = false; btn.textContent = 'Save'; if (typeof showToast === 'function') showToast('Could not save — ' + (e && e.message || 'try again'), 4000, true); }
    };
  };
  window._maintRemoveEntry = async function (logId) {
    var l = (state.maintLog || []).find(function (x) { return x.id === logId; });
    if (!l || !confirm('Remove "' + l.text + '" (' + (l.dateDone || l.dateAdded) + ') from the service history?')) return;
    try {
      var blank = [['', '', '', '', '', '', '', '', '', '', '']];
      if (!(await rrRemoveRowConfirmed(state.personalSheetId, LOG_TAB, l.row, LOG_TAB + '!A' + l.row + ':K' + l.row, blank, { num: l.id }, 'service history'))) return;
      await _loadLog();
      var f = document.getElementById('wb-entry'); if (f) f.remove();
      var ctx = window._wbHistoryCtx || {}; window._maintShowHistory(ctx.invId, ctx.itemNum);
      _maintRenderTasks(); _wbBuild(); _wbBadge();
    } catch (e) { if (typeof showToast === 'function') showToast('Could not remove it', 3500, true); }
  };

  // ── v0.9.1666: TASK CARDS (bite 2) — the task is the unit of work ──
  function _itemTasks() {
    var inv = String(window._maintPanelInvId || '');
    var num = String(_panelItem && _panelItem.itemNum || '').trim();
    return (state.maintLog || []).filter(function (l) {
      if (l.type !== 'chore' || l.status !== 'open') return false;
      return inv ? l.invId === inv : l.itemNum === num;
    });
  }
  function _taskParts(taskId) {
    return Object.values(state.partsData || {}).filter(function (p) { return p.taskId && p.taskId === taskId; });
  }
  function _maintRenderTasks() {
    var el = document.getElementById('maint-tasks');
    if (!el || !_panelItem) return;
    var render = function () {
      var tasks = _itemTasks();
      if (!tasks.length) { el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);padding:0.3rem 0">No open tasks on this one.</div>'; return; }
      var IN = 'width:100%;box-sizing:border-box;padding:0.4rem 0.55rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.8rem';
      var small = _btnQuiet('sm');
      // v0.9.1676 (Brad: "if we have a part on the want list for you to buy,
      // it needs to show under the task — 'Waiting on xxx'; when you buy it
      // and mark it bought it should change to 'Parts on hand'"). Parts tied
      // to the task show under it with a Bought-it / Installed-it button
      // right there; parts wanted for this UNIT that were never tied to a
      // task (added from the Parts Needed page, or before Task IDs existed)
      // fold into the card when there is exactly one open task, else they
      // get their own block below the tasks.
      var inv = String(window._maintPanelInvId || '');
      var num = String(_panelItem.itemNum || '').trim();
      var loose = Object.values(state.partsData || {}).filter(function (p) {
        if (p.taskId) return false;
        if ((p.status || 'wanted') === 'installed') return false;
        return inv ? p.forInv === inv : (p.forItem === num && !p.forInv);
      });
      var partRow = function (p, fromList) {
        var st = p.status || 'wanted';
        var name = _esc(p.description || p.partNum || 'part');
        var txt = st === 'installed' ? '<b>Installed</b> — ' + name
                : st === 'bought' ? '<span style="color:var(--green)">✓ <b>Parts on hand</b></span> — ' + name
                : '<span style="color:var(--warn)"><b>Waiting on</b></span> “' + name + '”';
        var act = st === 'bought' ? '<button onclick="_maintPartInstalled(' + p.row + ')" ' + _btn('green', 'sm', 'flex-shrink:0') + '>Installed it</button>'
                : st === 'wanted' ? '<button onclick="_maintPartBought(' + p.row + ')" ' + _btn('green', 'sm', 'flex-shrink:0') + '>Bought it</button>' : '';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.8rem;color:var(--text);margin-top:0.35rem">'
          + '<div>' + txt
          + (p.partNum && p.description ? ' <span style="font-family:var(--font-mono);color:var(--text-dim);font-size:0.72rem">#' + _esc(p.partNum) + '</span>' : '')
          + (fromList ? ' <span style="color:var(--text-dim);font-size:0.7rem">(from your Parts Needed list)</span>' : '')
          + '</div>' + act + '</div>';
      };
      var looseBlock = (loose.length && tasks.length !== 1)
        ? '<div style="border:1px dashed var(--border);border-radius:10px;padding:0.55rem 0.75rem;margin-bottom:0.5rem">'
          + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em">Parts for this item — not tied to a task</div>'
          + loose.map(function (p) { return partRow(p, false); }).join('') + '</div>'
        : '';
      el.innerHTML = tasks.map(function (t) {
        var parts = _taskParts(t.id);
        var partLine = parts.map(function (p) { return partRow(p, false); }).join('')
          + ((tasks.length === 1) ? loose.map(function (p) { return partRow(p, true); }).join('') : '');
        return '<div class="maint-task" data-id="' + _esc(t.id) + '" style="border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.75rem;margin-bottom:0.5rem;background:var(--bg-card)">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;flex-wrap:wrap">'
          +   '<div style="font-weight:700;color:var(--text)">' + _esc(t.text) + ' <span style="font-weight:400;font-size:0.72rem;color:var(--text-dim)">since ' + _esc(t.dateAdded) + '</span></div>'
          + '</div>'
          + '<textarea id="task-notes-' + _esc(t.id) + '" placeholder="Notes for this repair… (saves by itself)" rows="2" oninput="_maintNotesTyped(' + t.row + ',\'' + _esc(t.id) + '\')" onblur="_maintSaveTaskNotes(' + t.row + ',\'' + _esc(t.id) + '\',true)" style="' + IN + ';margin-top:0.5rem;resize:vertical">' + _esc(t.notes || '') + '</textarea>'
          + '<div id="task-notes-hint-' + _esc(t.id) + '" style="font-size:0.7rem;color:var(--text-dim);min-height:0.9rem"></div>'
          + '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-top:0.3rem">'
          +   '<button onclick="_maintPartsPopup(\'' + _esc(t.id) + '\',\'' + _esc(t.text) + '\')" ' + _btn('orange') + '>Need a part</button>'
          + '</div>'
          + partLine
          + '<div style="display:flex;justify-content:flex-end;margin-top:0.55rem;padding-top:0.45rem;border-top:1px dashed var(--border)">'
          +   '<button onclick="if(confirm(\'Mark \\u201c' + _esc(t.text).replace(/'/g, '') + '\\u201d complete? It moves to the service history.\'))_maintChoreDone(' + t.row + ',\'' + _esc(t.id) + '\')" ' + _btnPrimary('padding:0.45rem 0.8rem;font-size:0.74rem') + '>Mark complete — job finished</button>'
          + '</div>'
          + '</div>';
      }).join('') + looseBlock;
    };
    if (state.maintLog) render(); else _loadLog().then(render);
  }
  window._maintRenderTasks = _maintRenderTasks;
  // v0.9.1676: the part's lifecycle from the task card — same writers the
  // Parts Needed page uses (markPartBought / markPartInstalled in
  // app-pages.js), then the card and the detail-page preview redraw.
  window._maintPartBought = async function (rowNum) {
    if (typeof markPartBought !== 'function') return;
    await markPartBought(rowNum);
    _maintRenderTasks();
    if (_previewArgs && document.getElementById('maint-preview')) window._maintRenderPreview(_previewArgs.idx, _previewArgs.it, _previewArgs.pd);
  };
  window._maintPartInstalled = function (rowNum) {
    if (typeof markPartInstalled === 'function') markPartInstalled(rowNum);   // its Save calls _maintLogPartInstalled → card redraws
  };

  // v0.9.1670 (Brad): notes save BY THEMSELVES — a pause in typing or
  // leaving the box writes the row; no Save button.
  var _notesTimers = {};
  window._maintNotesTyped = function (rowNum, logId) {
    var h = document.getElementById('task-notes-hint-' + logId); if (h) h.textContent = 'typing…';
    clearTimeout(_notesTimers[logId]);
    _notesTimers[logId] = setTimeout(function () { window._maintSaveTaskNotes(rowNum, logId, true); }, 1200);
  };
  window._maintSaveTaskNotes = async function (rowNum, logId, quiet) {
    clearTimeout(_notesTimers[logId]);
    var ta = document.getElementById('task-notes-' + logId);
    var txt = ta ? String(ta.value || '').trim() : '';
    var l = (state.maintLog || []).find(function (x) { return x.id === logId; });
    if (l && (l.notes || '') === txt) { var h0 = document.getElementById('task-notes-hint-' + logId); if (h0) h0.textContent = txt ? 'saved' : ''; return; }
    var h = document.getElementById('task-notes-hint-' + logId); if (h) h.textContent = 'saving…';
    try {
      await _ensureLogNotesCol();
      var ok = await rrVerifiedRowUpdate(state.personalSheetId, LOG_TAB, rowNum, LOG_TAB + '!K' + rowNum, [[txt]], { num: logId }, 'Workbench');
      if (!ok) { if (h) h.textContent = 'not saved — refresh'; return; }
      if (l) l.notes = txt;
      if (h) h.textContent = 'saved';
      if (!quiet && typeof showToast === 'function') showToast('✓ Notes saved');
    } catch (e) { if (h) h.textContent = 'not saved'; if (typeof showToast === 'function') showToast('Could not save the notes', 3500, true); }
  };

  // _maintTaskVideos removed in v0.9.1671 (Brad: the video finder sits right below the card).

  // ── the Need-a-part popup: find your part + your parts diagrams ──
  window._maintPartsPopup = function (taskId, taskName) {
    if (!_panelItem) return;
    var old = document.getElementById('maint-parts-pop'); if (old) old.remove();
    var IN = 'flex:1;min-width:150px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem';
    var linkBtn = _btn('blue');
    var docs = _docCovers(_panelItem);
    var docHtml = docs.length
      ? docs.map(function (d) {
          return '<div style="padding:0.3rem 0;border-bottom:1px solid var(--border)"><a href="' + _esc(d.url) + '" target="_blank" rel="noopener" style="color:var(--accent2);font-weight:600;text-decoration:none">' + _esc(d.title || 'untitled') + '</a></div>';
        }).join('')
      : '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.4rem">No diagram saved for this item yet.</div>';
    var html = '<div id="maint-parts-pop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9650;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem">'
      + _cardOpen(520)
      + _cardHead(_esc(taskName), 'Need a part', "document.getElementById('maint-parts-pop').remove()")
      + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1rem;margin-bottom:0.8rem">'
      +   '<div style="' + SECT + '">Find your part</div>'
      +   '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">'
      +     '<input id="maint-pop-part" placeholder="part number / description" oninput="_maintBinCheck(\'' + _esc(taskId) + '\')" style="' + IN + '">'
      +   '</div>'
      +   '<div id="maint-pop-bin" style="font-size:0.8rem;color:var(--text);margin:0.5rem 0 0.6rem;padding:0.45rem 0.6rem;background:var(--bg-card);border:1px dashed var(--border);border-radius:8px"><span style="color:var(--text-dim)">Type what you need above and the bin gets checked.</span></div>'
      +   '<div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.35rem">Not in the bin? Order one</div>'
      +   _favRow(MAINT.PREF_DEALERS, 'maint-pop-dealer', 'Any dealer')
      +   '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">'
      +     '<button onclick="_maintPopSearch()" ' + linkBtn + '>Search →</button>'
      +     '<button onclick="_maintPopAddWanted(\'' + _esc(taskId) + '\')" ' + _btnPrimary('padding:0.5rem 0.9rem;font-size:0.78rem') + '>+ Add to Parts Wanted</button>'
      +   '</div>'
      +   '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.4rem">Added parts link to THIS task — the card shows when it\'s in the drawer.</div>'
      + '</div>'
      + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1rem">'
      +   '<div style="' + SECT + '">Parts diagram</div>'
      +   docHtml
      +   '<div style="margin-top:0.5rem"><button onclick="document.getElementById(\'maint-parts-pop\').remove();_maintShowGrp(\'docs\')" ' + linkBtn + '>Find manuals &amp; diagrams →</button></div>'
      + '</div>'
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (!state.partsBin) _loadBin();
    var pi = document.getElementById('maint-pop-part'); if (pi) pi.focus();
  };
  window._maintPopSearch = function () {
    if (!_panelItem) return;
    var dealer = (document.getElementById('maint-pop-dealer') || {}).value || '';
    var part = (document.getElementById('maint-pop-part') || {}).value || '';
    window.open(_partsUrl(dealer, _panelItem, part.trim()), '_blank');
  };
  window._maintPopAddWanted = async function (taskId) {
    if (!_panelItem) return;
    var box = document.getElementById('maint-pop-part');
    var txt = box ? String(box.value || '').trim() : '';
    if (!txt) { if (typeof showToast === 'function') showToast('Type the part (number or description) first.', 3000, true); return; }
    try {
      if (typeof _ensurePartsTab === 'function') await _ensurePartsTab();
      if (typeof _ensurePartsLifecycleCols === 'function') await _ensurePartsLifecycleCols();
      var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
      var isNum = /^[A-Za-z]{0,4}[\-#]?[A-Za-z0-9][A-Za-z0-9\-\/\.]*$/.test(txt) && /\d/.test(txt);
      var row = [_t('part-' + Date.now()), isNum ? '' : txt, _t(isNum ? txt : ''),
                 _t(String(_panelItem.itemNum || '')), _t(window._maintPanelInvId || ''),
                 '', 'for Workbench task', _t(new Date().toISOString().split('T')[0]),
                 'wanted', '', '', '', _t(taskId)];
      await sheetsAppend(state.personalSheetId, 'Parts Needed!A:M', [row]);
      if (typeof buildPartsPage === 'function') await buildPartsPage();
      var pop = document.getElementById('maint-parts-pop'); if (pop) pop.remove();
      _maintRenderTasks(); _wbBadge();
      if (typeof showToast === 'function') showToast('✓ Added to Parts Wanted — linked to this task');
    } catch (e) { if (typeof showToast === 'function') showToast('Could not save the part — ' + (e && e.message || 'try again'), 4000, true); }
  };

  // ════════════════════════════════════════════════════════════════
  //  PHASE 4 (v0.9.1667): THE PARTS BIN — parts you own that belong to
  //  no item yet (the ten e-units from the show table). Personal tab
  //  "Parts Bin" (reserved in app-data.js the same commit). Using one
  //  on a task decrements the bin and writes a Parts Needed row in the
  //  BOUGHT state linked to the task — the phase-2 lifecycle takes it
  //  from there.
  // ════════════════════════════════════════════════════════════════
  var BIN_TAB = 'Parts Bin';
  async function _ensureBinTab() {
    try {
      var meta = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties',
        { headers: { Authorization: 'Bearer ' + accessToken } })).json();
      // v0.9.1675: a FAILED read (expired token → {error}, no sheets) is
      // not "the tab is missing". Bail; never try to create on a guess —
      // the header write that followed used to land in the offline outbox
      // as a phantom "1 change has not saved".
      if (!meta || !Array.isArray(meta.sheets)) return false;
      if (meta.sheets.some(function (sh) { return sh.properties && sh.properties.title === BIN_TAB; })) return true;
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: BIN_TAB, tabColor: { red: 0.55, green: 0.35, blue: 0.15 } } } }] })
      });
      await sheetsUpdate(state.personalSheetId, BIN_TAB + '!A1:M1',
        [['Bin ID', 'Part Number', 'Description', 'Quantity', 'Where Acquired', 'Date Acquired', 'Price Paid', 'Photo Link', 'Topics', 'For Sale', 'Asking Price', 'Notes', 'Date Added']]);
      return true;
    } catch (e) { console.warn('[Bin] ensure failed', e && e.message); return false; }
  }
  async function _loadBin() {
    try {
      if (!(await _ensureBinTab())) return;
      var res = await sheetsGet(state.personalSheetId, BIN_TAB + '!A2:M').catch(function () { return { values: [] }; });
      state.partsBin = (res.values || []).map(function (r, i) {
        var g = function (j) { return (r[j] != null) ? String(r[j]) : ''; };
        return { row: i + 2, id: g(0), partNum: g(1), desc: g(2), qty: parseInt(g(3), 10) || 0, where: g(4), dateAcq: _isoDate(g(5)),
                 price: g(6), photo: g(7), topics: g(8), forSale: /^(yes|true|1)$/i.test(g(9)), asking: g(10), notes: g(11), date: _isoDate(g(12)) };
      }).filter(function (b) { return b.id; });
    } catch (e) { state.partsBin = state.partsBin || []; }
  }
  function _binSearch(text) {
    var q = String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 2; });
    return (state.partsBin || []).filter(function (b) {
      if (b.qty <= 0) return false;
      var hay = (b.partNum + ' ' + b.desc + ' ' + b.topics).toLowerCase();
      return q.length && q.some(function (w) { return hay.indexOf(w) >= 0; });
    });
  }

  window._maintBinForm = function (existing) {
    var old = document.getElementById('bin-form'); if (old) old.remove();
    existing = existing || {};
    var IN = 'width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.6rem';
    var html = '<div id="bin-form" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9700;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem">'
      + _cardOpen(480)
      + _cardHead('Parts Bin', (existing.id ? 'Edit bin part' : 'Add to the Parts Bin'), "document.getElementById('bin-form').remove()")
      + '<label style="' + LB + '">Description *</label><input id="binf-desc" type="text" value="' + _esc(existing.desc || '') + '" placeholder="e.g. postwar 3-position e-unit" style="' + IN + '">'
      + '<label style="' + LB + '">Part number (if known)</label><input id="binf-num" type="text" value="' + _esc(existing.partNum || '') + '" style="' + IN + ';font-family:var(--font-mono)">'
      + '<div style="display:flex;gap:0.6rem"><div style="flex:1"><label style="' + LB + '">Quantity *</label><input id="binf-qty" type="number" min="0" value="' + _esc(String(existing.qty != null ? existing.qty : 1)) + '" style="' + IN + '"></div>'
      + '<div style="flex:1"><label style="' + LB + '">Price paid (total)</label><input id="binf-price" type="text" value="' + _esc(existing.price || '') + '" placeholder="e.g. 40" style="' + IN + '"></div></div>'
      + '<div style="display:flex;gap:0.6rem"><div style="flex:2"><label style="' + LB + '">Where acquired</label><input id="binf-where" type="text" value="' + _esc(existing.where || '') + '" placeholder="e.g. York show, table 41" style="' + IN + '"></div>'
      + '<div style="flex:1"><label style="' + LB + '">Date</label><input id="binf-date" type="date" value="' + _esc(existing.dateAcq || '') + '" style="' + IN + '"></div></div>'
      + '<label style="' + LB + '">Topics (e.g. e-unit, traction tire)</label><input id="binf-topics" type="text" value="' + _esc(existing.topics || '') + '" style="' + IN + '">'
      + '<label style="' + LB + '">Notes</label><input id="binf-notes" type="text" value="' + _esc(existing.notes || '') + '" style="' + IN + '">'
      + '<div style="display:flex;gap:0.6rem;align-items:center;margin-bottom:0.6rem"><label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;color:var(--text)"><input id="binf-sale" type="checkbox" ' + (existing.forSale ? 'checked' : '') + '> For sale</label>'
      + '<input id="binf-asking" type="text" value="' + _esc(existing.asking || '') + '" placeholder="asking price" style="' + IN + ';margin:0;flex:1"></div>'
      + (existing.id ? '' : '<label style="' + LB + '">Photo (optional — the baggie IS the record)</label><input id="binf-photo" type="file" accept="image/*" style="margin-bottom:0.7rem;font-size:0.8rem;color:var(--text)">')
      + _cardFoot('<button onclick="document.getElementById(\'bin-form\').remove()" ' + _btnCancel() + '>Cancel</button>'
      + '<button id="binf-save" ' + _btnSave() + '>' + (existing.id ? 'Save' : 'Add to bin') + '</button>')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (window.BackStack && BackStack.wire) BackStack.wire(document.getElementById('bin-form'));
    document.getElementById('binf-save').onclick = async function () {
      var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
      var desc = g('binf-desc'), num = g('binf-num'), qty = parseInt(g('binf-qty'), 10);
      if (!desc && !num) { if (typeof showToast === 'function') showToast('Describe the part (or give its number).', 3000, true); return; }
      if (isNaN(qty) || qty < 0) { if (typeof showToast === 'function') showToast('Quantity needs a number.', 3000, true); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Saving…';
      try {
        if (!(await _ensureBinTab())) throw new Error('bin tab unavailable');
        var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
        var photo = existing.photo || '';
        var pf = document.getElementById('binf-photo');
        if (pf && pf.files && pf.files[0]) {
          await driveEnsureSetup();
          var folder = await driveFindOrCreateFolder('Parts', driveCache.photosId);
          var up = await driveUploadPhoto(pf.files[0], 'bin-' + Date.now() + '.jpg', folder);
          if (up && up.id) photo = 'https://drive.google.com/file/d/' + up.id + '/view';
        }
        var sale = document.getElementById('binf-sale'); var forSale = sale && sale.checked ? 'Yes' : '';
        var row = [_t(existing.id || ('bin-' + Date.now())), _t(num), desc, String(qty), g('binf-where'), _t(g('binf-date')), g('binf-price'), photo, g('binf-topics'), forSale, g('binf-asking'), g('binf-notes'), _t(existing.date || new Date().toISOString().split('T')[0])];
        if (existing.id) {
          if (!(await rrVerifiedRowUpdate(state.personalSheetId, BIN_TAB, existing.row, BIN_TAB + '!A' + existing.row + ':M' + existing.row, [row], { num: existing.id }, 'Parts Bin'))) { btn.disabled = false; btn.textContent = 'Save changes'; return; }
        } else {
          await sheetsAppend(state.personalSheetId, BIN_TAB + '!A:M', [row]);
        }
        await _loadBin();
        var f = document.getElementById('bin-form'); if (f) f.remove();
        _binBuild();
        if (typeof showToast === 'function') showToast('✓ Parts Bin updated');
      } catch (e) {
        btn.disabled = false; btn.textContent = existing.id ? 'Save changes' : 'Add to bin';
        if (typeof showToast === 'function') showToast('Could not save — ' + (e && e.message || 'try again'), 4000, true);
      }
    };
    var first = document.getElementById('binf-desc'); if (first) first.focus();
  };
  window._maintBinEdit = function (id) {
    var b = (state.partsBin || []).find(function (x) { return x.id === id; });
    if (b) window._maintBinForm(b);
  };
  window._maintBinQty = async function (id, delta) {
    var b = (state.partsBin || []).find(function (x) { return x.id === id; });
    if (!b) return;
    var q = Math.max(0, (b.qty || 0) + delta);
    try {
      if (!(await rrVerifiedRowUpdate(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!D' + b.row, [[String(q)]], { num: b.id }, 'Parts Bin'))) return;
      b.qty = q; _binBuild();
    } catch (e) { if (typeof showToast === 'function') showToast('Could not update the quantity', 3500, true); }
  };
  window._maintBinRemove = async function (id) {
    var b = (state.partsBin || []).find(function (x) { return x.id === id; });
    if (!b || !confirm('Remove "' + (b.desc || b.partNum) + '" from your Parts Bin?')) return;
    try {
      if (typeof rrRemoveRowConfirmed === 'function') {
        if (!(await rrRemoveRowConfirmed(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!A' + b.row + ':M' + b.row, [['', '', '', '', '', '', '', '', '', '', '', '', '']], { num: b.id }, 'Parts Bin'))) return;
      } else {
        if (!(await rrVerifiedRowUpdate(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!A' + b.row + ':M' + b.row, [['', '', '', '', '', '', '', '', '', '', '', '', '']], { num: b.id }, 'Parts Bin'))) return;
      }
      await _loadBin(); _binBuild();
    } catch (e) { if (typeof showToast === 'function') showToast('Could not remove it', 3500, true); }
  };

  // ── v0.9.1691: PARTS FOR SALE on the For Sale page (Piece 5 / Piece 6) ──
  // Brad, 2026-09-06: a separate section under the item list (items keep
  // their share cards and sale sheets untouched), only when the bin has a
  // part flagged for sale, owner+beta gate like the rest of the suite.
  // Mark sold writes ONE Sold row (the same _buildSoldRow every sale path
  // uses, "Part from Parts Bin" in the notes so Sold Items can tell it from
  // a train), then takes one off the bin — the sale is recorded FIRST, so a
  // bin write that fails can never lose the sale (the v1289 rule).
  var FS_PART_NOTE = 'Part from Parts Bin';
  function _fsPartsHost() {
    var page = document.getElementById('page-forsale');
    if (!page) return null;
    var host = document.getElementById('forsale-parts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'forsale-parts';
      host.style.marginTop = '1rem';
      var after = document.getElementById('forsale-table-wrap');
      if (after && after.parentNode === page) page.insertBefore(host, after.nextSibling);
      else page.appendChild(host);
    }
    return host;
  }
  function _fsPartsList() {
    return (state.partsBin || []).filter(function (b) { return b.forSale && b.qty > 0; });
  }
  window._maintRenderFsParts = function () {
    var host = _fsPartsHost();
    if (!host) return;
    if (!_isOwner()) { host.innerHTML = ''; return; }
    if (!state.partsBin) { _loadBin().then(function () { window._maintRenderFsParts(); }); return; }
    var list = _fsPartsList();
    if (!list.length) { host.innerHTML = ''; return; }
    var cur = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
    var total = list.reduce(function (s, b) { return s + (parseFloat(b.asking) || 0) * (b.qty || 1); }, 0);
    var money = function (v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? cur + n.toLocaleString() : '\u2014'; };
    var btn = function (fn, id, label, tone) {
      var t = tone === 'green' ? 'var(--green)' : 'var(--border)';
      var c = tone === 'green' ? 'var(--green)' : 'var(--text-dim)';
      return '<button onclick="event.stopPropagation();' + fn + '(\'' + _esc(id) + '\')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid ' + t + ';background:var(--surface2);color:' + c + ';font-family:var(--font-body);margin-right:0.3rem">' + label + '</button>';
    };
    var rows = list.map(function (b) {
      var photo = b.photo ? ' <a href="' + _esc(b.photo) + '" target="_blank" rel="noopener" style="font-size:0.72rem;color:var(--accent2);text-decoration:none">Photo</a>' : '';
      return '<tr>'
        + '<td><span style="font-family:var(--font-head);color:var(--accent)">' + _esc(b.partNum || '\u2014') + '</span>' + photo + '</td>'
        + '<td style="white-space:normal">' + _esc(b.desc || '') + (b.where ? '<div style="font-size:0.72rem;color:var(--text-dim)">from ' + _esc(b.where) + '</div>' : '') + '</td>'
        + '<td>' + b.qty + '</td>'
        + '<td class="market-val" style="color:var(--forsale)">' + money(b.asking) + '</td>'
        + '<td class="text-dim">' + money(b.price) + '</td>'
        + '<td style="white-space:nowrap">' + btn('_maintFsPartSold', b.id, 'Sold', 'green') + btn('_maintFsPartUnlist', b.id, 'Not for sale') + btn('_maintFsPartEdit', b.id, 'Edit') + '</td>'
        + '</tr>';
    }).join('');
    host.innerHTML =
      '<div class="page-title" style="display:flex;align-items:baseline;gap:0.6rem;margin:0.4rem 0 0.5rem;font-size:1.05rem">Parts for sale'
      + '<span style="font-size:0.85rem;color:var(--text-dim);font-weight:400">' + list.length + (list.length === 1 ? ' part' : ' parts') + (total > 0 ? ' \u00b7 ' + cur + Math.round(total).toLocaleString() + ' asking' : '') + '</span></div>'
      + '<div class="table-wrap" style="max-height:40vh;overflow-y:auto"><table class="item-table"><thead><tr>'
      + '<th style="width:12%">Part #</th><th style="width:48%">Description</th><th>Qty</th><th>Asking</th><th>Paid</th><th style="white-space:nowrap">Actions</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  };
  window._maintFsPartEdit = function (id) {
    var b = (state.partsBin || []).find(function (x) { return x.id === id; });
    if (b) window._maintBinForm(b);
  };
  window._maintFsPartUnlist = async function (id) {
    var b = (state.partsBin || []).find(function (x) { return x.id === id; });
    if (!b) return;
    try {
      if (!(await rrVerifiedRowUpdate(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!J' + b.row, [['']], { num: b.id }, 'Parts Bin'))) return;
      b.forSale = false;
      window._maintRenderFsParts();
      if (typeof showToast === 'function') showToast('Taken off the For Sale list \u2014 it is still in your bin.', 2500);
    } catch (e) { if (typeof showToast === 'function') showToast('Could not update the part', 3500, true); }
  };
  var _fsPartBusy = false;   // rule #5: one sale at a time
  window._maintFsPartSold = async function (id) {
    var b = (state.partsBin || []).find(function (x) { return x.id === id; });
    if (!b || _fsPartBusy) return;
    var cur = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
    var price = (typeof appPrompt === 'function')
      ? await appPrompt('Enter the price it sold for. Leave blank to use the asking price.', b.asking || '', { title: 'Record sale \u2014 ' + (b.desc || b.partNum), type: 'number', prefix: cur, ok: 'Mark sold' })
      : prompt('Price it sold for:', b.asking || '');
    if (price === null || price === undefined) return;
    price = String(price).trim() || String(b.asking || '').trim();
    _fsPartBusy = true;
    try {
      var today = new Date().toISOString().split('T')[0];
      var note = FS_PART_NOTE + (b.desc ? ' \u2014 ' + b.desc : '') + (b.notes ? '; ' + b.notes : '') + (b.photo ? '; photo ' + b.photo : '');
      // 1 — the sale, first and unconditionally
      var soldRow = _buildSoldRow({ itemNum: b.partNum || 'PART', variation: '', copy: '1', pricePaid: b.price || '', salePrice: price, dateSold: today,
                                    notes: note, inventoryId: '', manufacturer: '', src: { description: b.desc || '', datePurchased: b.dateAcq || '' } });
      var apRow = (await sheetsAppend(state.personalSheetId, 'Sold!A:T', [soldRow])) || 0;
      var k = (typeof _newSoldKey === 'function') ? _newSoldKey() : ('sold-opt-' + Date.now());
      state.soldData = state.soldData || {};
      state.soldData[k] = { row: apRow, key: k, itemNum: b.partNum || 'PART', variation: '', priceItem: b.price || '', salePrice: price, dateSold: today,
                            notes: note, photoItem: '', description: b.desc || '', datePurchased: b.dateAcq || '', inventoryId: '', manufacturer: '' };
      // 2 — then the bin: one fewer, gone at zero
      var q = Math.max(0, (b.qty || 0) - 1);
      var ok;
      if (q === 0 && typeof rrRemoveRowConfirmed === 'function') {
        ok = await rrRemoveRowConfirmed(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!A' + b.row + ':M' + b.row, [['', '', '', '', '', '', '', '', '', '', '', '', '']], { num: b.id }, 'Parts Bin');
      } else {
        ok = await rrVerifiedRowUpdate(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!D' + b.row, [[String(q)]], { num: b.id }, 'Parts Bin');
      }
      if (ok) { b.qty = q; await _loadBin(); }
      if (typeof showToast === 'function') showToast(ok ? 'Sold \u2014 recorded in Sold Items' + (q === 0 ? ' and cleared from the bin.' : '; ' + q + ' left in the bin.') : 'The sale is recorded, but the bin count did not update \u2014 check the Parts Bin.', 3500, !ok);
      window._maintRenderFsParts();
      if (typeof _binBuild === 'function' && document.getElementById('page-partsbin')) _binBuild();
      if (typeof updateNavBadges === 'function') updateNavBadges();
    } catch (e) {
      if (typeof showToast === 'function') showToast('The sale did not reach the sheet \u2014 check the connection and try again.', 4000, true);
    } finally { _fsPartBusy = false; }
  };

  // use one from the bin on a task: decrement + a BOUGHT Parts Needed row linked to the task
  window._maintBinUse = async function (binId, taskId) {
    var b = (state.partsBin || []).find(function (x) { return x.id === binId; });
    if (!b || !_panelItem) return;
    try {
      if (!(await rrVerifiedRowUpdate(state.personalSheetId, BIN_TAB, b.row, BIN_TAB + '!D' + b.row, [[String(Math.max(0, b.qty - 1))]], { num: b.id }, 'Parts Bin'))) return;
      b.qty = Math.max(0, b.qty - 1);
      if (typeof _ensurePartsTab === 'function') await _ensurePartsTab();
      if (typeof _ensurePartsLifecycleCols === 'function') await _ensurePartsLifecycleCols();
      var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
      var today = new Date().toISOString().split('T')[0];
      var row = [_t('part-' + Date.now()), b.desc, _t(b.partNum), _t(String(_panelItem.itemNum || '')), _t(window._maintPanelInvId || ''),
                 b.photo || '', 'from Parts Bin' + (b.where ? ' (' + b.where + ')' : ''), _t(today),
                 'bought', _t(b.dateAcq || today), '', b.price || '', _t(taskId || '')];
      await sheetsAppend(state.personalSheetId, 'Parts Needed!A:M', [row]);
      if (typeof buildPartsPage === 'function') await buildPartsPage();
      var pop = document.getElementById('maint-parts-pop'); if (pop) pop.remove();
      _maintRenderTasks(); _wbBadge();
      if (typeof showToast === 'function') showToast('✓ Pulled one from the bin — it’s on the task, ready to install');
    } catch (e) { if (typeof showToast === 'function') showToast('Could not use the bin part — ' + (e && e.message || 'try again'), 4000, true); }
  };
  window._maintBinCheck = function (taskId) {
    var el = document.getElementById('maint-pop-bin'); if (!el) return;
    var q = (document.getElementById('maint-pop-part') || {}).value || '';
    var render = function () {
      var hits = _binSearch(q);
      if (!q.trim()) { el.innerHTML = '<span style="color:var(--text-dim)">Type what you need above and the bin gets checked.</span>'; return; }
      if (!hits.length) { el.innerHTML = '<span style="color:var(--text-dim)">Nothing matching in your bin' + ((state.partsBin || []).length ? '' : ' (it’s empty)') + ' — order one below.</span>'; return; }
      el.innerHTML = hits.map(function (b) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)">'
          + '<div><b>' + _esc(b.desc || b.partNum) + '</b>' + (b.partNum && b.desc ? ' <span style="font-family:var(--font-mono);color:var(--accent2)">#' + _esc(b.partNum) + '</span>' : '') + ' <span style="color:var(--text-dim)">×' + b.qty + (b.where ? ' · ' + _esc(b.where) : '') + '</span></div>'
          + '<button onclick="_maintBinUse(\'' + _esc(b.id) + '\',\'' + _esc(taskId) + '\')" ' + _btn('green', 'sm') + '>Use one</button>'
          + '</div>';
      }).join('');
    };
    if (state.partsBin) render(); else _loadBin().then(render);
  };

  function _binBuild() {
    var pg = document.getElementById('page-partsbin');
    if (!pg) return;
    var bin = (state.partsBin || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var head = '<div class="page-title" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem"><span>Parts Bin</span>'
      + '<button onclick="_maintBinForm()" class="btn" style="border:1.5px solid var(--accent);color:var(--accent);background:var(--bg-card);background:color-mix(in srgb, var(--accent) 10%, var(--bg-card));font-weight:600;font-size:0.78rem;padding:0.45rem 0.65rem">+ Add parts</button></div>'
      + '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.85rem">Parts you own that aren’t on a train yet — show-table finds, spares, the drawer. Need-a-part checks here first.</div>';
    if (!bin.length) { pg.innerHTML = _dz(head + '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><p>The bin is empty.</p><p style="font-size:0.8rem;margin-top:0.4rem">Bought an assortment at a show? Add it here with a quantity.</p></div>'); return; }
    var small = _btnQuiet('sm');
    pg.innerHTML = _dz(head + bin.map(function (b) {
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.8rem 1rem;margin-bottom:0.6rem;display:flex;gap:0.7rem;align-items:flex-start;flex-wrap:wrap">'
        + (b.photo ? '<a href="' + _esc(b.photo) + '" target="_blank" rel="noopener" style="flex-shrink:0;font-size:0.76rem;color:var(--accent2);text-decoration:none;border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.45rem">photo</a>' : '')
        + '<div style="flex:1;min-width:200px">'
        +   '<div style="font-weight:700;color:var(--text)">' + _esc(b.desc || b.partNum) + (b.partNum && b.desc ? ' <span style="font-family:var(--font-mono);color:var(--accent2);font-weight:400">#' + _esc(b.partNum) + '</span>' : '') + '</div>'
        +   '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.15rem">' + [b.where, b.dateAcq, b.price ? 'paid ' + b.price : '', b.topics ? '[' + b.topics + ']' : ''].filter(Boolean).map(_esc).join(' · ') + '</div>'
        +   (b.notes ? '<div style="font-size:0.76rem;color:var(--text-dim)">' + _esc(b.notes) + '</div>' : '')
        +   (b.forSale ? '<div style="font-size:0.74rem;color:#e67e22;margin-top:0.15rem">For sale' + (b.asking ? ' — asking ' + _esc(b.asking) : '') + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;gap:0.35rem;align-items:center;flex-wrap:wrap">'
        +   '<button onclick="_maintBinQty(\'' + _esc(b.id) + '\',-1)" ' + small + '>−</button>'
        +   '<span style="min-width:2.2rem;text-align:center;font-weight:700;color:var(--text)">×' + b.qty + '</span>'
        +   '<button onclick="_maintBinQty(\'' + _esc(b.id) + '\',1)" ' + small + '>+</button>'
        +   '<button onclick="_maintBinEdit(\'' + _esc(b.id) + '\')" ' + _btn('blue', 'sm') + '>Edit</button>'
        +   '<button onclick="_maintBinRemove(\'' + _esc(b.id) + '\')" ' + _btn('red', 'sm') + '>Remove</button>'
        + '</div></div>';
    }).join(''));
  }
  window._binBuild = _binBuild;

  // ════════════════════════════════════════════════════════════════
  //  BITE 3 (v0.9.1674): THE TOOLBOX — the Workbench's second tab.
  //  Brad: "even if we are not on a specific item, i can look in my
  //  toolbox, and filter traction tire replacement and i can see all the
  //  links and videos that were about traction tires." The whole My
  //  Manuals library (pictures, links, documents, videos), filterable by
  //  topic / type / item number plus a search box; click a doc to retag
  //  it (title, type, link, covers, topics, notes) or remove it; and
  //  general docs — a lube guide that fits everything — can be saved
  //  right here with no item in hand. Identity is the Doc ID in column
  //  A; the row number is looked up at write time and verified by the
  //  guarded writer.
  // ════════════════════════════════════════════════════════════════
  var _wbTabName = 'bench';
  var _tbState = { q: '', topic: '', type: '', item: '' };
  window._wbTab = function (name) {
    _wbTabName = (name === 'toolbox') ? 'toolbox' : 'bench';
    _wbBuild();
    if (_wbTabName === 'toolbox' && !state.myManuals) _loadMyDocs().then(_wbBuild);
  };
  function _tbRefresh() {
    // the Toolbox is on screen → reload the library and redraw it
    if (!document.getElementById('wb-toolbox')) return;
    _loadMyDocs().then(_wbBuild);
  }
  function _tbNorm(v) { return String(v == null ? '' : v).trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function _tbSplit(v) {
    return String(v == null ? '' : v).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }
  function _tbIcon(type) { return ''; }   // v0.9.1676: no icons — the type chip says it
  function _tbTopics() {
    // every topic anyone typed, once, in a stable order
    var seen = {}, out = [];
    (state.myManuals || []).forEach(function (d) {
      _tbSplit(d.topics).forEach(function (t) { var k = t.toLowerCase(); if (!seen[k]) { seen[k] = true; out.push(t); } });
    });
    return out.sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  }
  function _tbMatches(d) {
    var st = _tbState;
    if (st.type && d.type !== st.type) return false;
    if (st.topic && !_tbSplit(d.topics).some(function (t) { return t.toLowerCase() === st.topic.toLowerCase(); })) return false;
    if (st.item) {
      var want = _tbNorm(st.item);
      var hit = _tbSplit(d.covers).some(function (c) { var cc = _tbNorm(c); return cc === want || (want.length >= 3 && cc.indexOf(want) >= 0); });
      if (!hit) return false;
    }
    if (st.q) {
      var q = st.q.toLowerCase();
      var hay = [d.title, d.topics, d.covers, d.notes, d.url, d.type].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  window._tbFilter = function () {
    var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    _tbState = { q: g('tb-q'), topic: g('tb-topic'), type: g('tb-type'), item: g('tb-item') };
    _tbList();
  };
  window._tbTopic = function (topic) {
    _tbState.topic = topic || '';
    _tbRender();
  };
  window._tbClear = function () { _tbState = { q: '', topic: '', type: '', item: '' }; _tbRender(); };
  // general saves — no item in hand, Covers optional, topic required instead
  window._tbSaveLink = function () { _docForm('link', null, null, '', { general: true }); };
  window._tbSaveVideo = function () { _docForm('video', null, null, '', { general: true }); };
  window._tbSavePicture = function () { _pickFile('image/*', 'picture', { general: true }); };
  window._tbSaveDocument = function () { _pickFile('.pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx', 'document', { general: true }); };

  function _tbRender() {
    var box = document.getElementById('wb-toolbox');
    if (!box) return;
    if (!state.myManuals) {
      box.innerHTML = '<div style="text-align:center;padding:2rem 1rem;color:var(--text-dim)"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading your Toolbox…</div>';
      return;
    }
    var st = _tbState;
    var SEL = 'padding:0.45rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.84rem';
    var linkBtn = _btn('blue');
    var topics = _tbTopics();
    box.innerHTML = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.85rem">Your personalized maintenance manual — everything you saved from any item, in one place. Click a title to open it, Edit to retag it.</div>'
      + '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.9rem">'
      +   '<button onclick="_tbSaveLink()" ' + linkBtn + '>Save a link</button>'
      +   '<button onclick="_tbSavePicture()" ' + linkBtn + '>Save a picture</button>'
      +   '<button onclick="_tbSaveDocument()" ' + linkBtn + '>Save a document</button>'
      +   '<button onclick="_tbSaveVideo()" ' + linkBtn + '>Save a video</button>'
      +   '<span style="font-size:0.72rem;color:var(--text-dim);align-self:center">General docs go here — ones for a specific item are saved from its Maintenance card.</span>'
      + '</div>'
      + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.8rem 1rem;margin-bottom:0.9rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">'
      +   '<input id="tb-q" type="search" placeholder="Search titles, topics, notes…" value="' + _esc(st.q) + '" oninput="_tbFilter()" style="' + SEL + ';flex:1 1 14rem;min-width:160px">'
      +   '<select id="tb-topic" onchange="_tbFilter()" style="' + SEL + '"><option value="">All topics</option>'
      +     topics.map(function (t) { return '<option value="' + _esc(t) + '"' + (t.toLowerCase() === st.topic.toLowerCase() ? ' selected' : '') + '>' + _esc(t) + '</option>'; }).join('')
      +   '</select>'
      +   '<select id="tb-type" onchange="_tbFilter()" style="' + SEL + '">'
      +     [['', 'All types'], ['picture', 'Pictures'], ['link', 'Links'], ['document', 'Documents'], ['video', 'Videos']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === st.type ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
      +   '</select>'
      +   '<input id="tb-item" type="text" placeholder="Item #" value="' + _esc(st.item) + '" oninput="_tbFilter()" style="' + SEL + ';width:7rem">'
      +   '<button onclick="_tbClear()" ' + _btnQuiet() + '>Clear</button>'
      + '</div>'
      + '<div id="tb-list"></div>';
    _tbList();
  }

  function _tbList() {
    var el = document.getElementById('tb-list');
    if (!el) return;
    var all = state.myManuals || [];
    var st = _tbState;
    var filtered = all.filter(_tbMatches).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || (b.row - a.row); });
    var active = !!(st.q || st.topic || st.type || st.item);
    if (!all.length) {
      el.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><p>Your Toolbox is empty.</p><p style="font-size:0.8rem;margin-top:0.4rem">Save a manual, diagram, picture or video from any item’s Maintenance card — or a general one with the buttons above.</p></div>';
      return;
    }
    var count = '<div style="font-size:0.76rem;color:var(--text-dim);margin-bottom:0.5rem">' + filtered.length + ' of ' + all.length
      + (active ? ' — filtered' + (st.topic ? ' by <b>' + _esc(st.topic) + '</b>' : '') : '') + '</div>';
    if (!filtered.length) {
      el.innerHTML = count + '<div style="text-align:center;padding:2rem 1rem;color:var(--text-dim)">Nothing matches — <a href="#" onclick="_tbClear();return false" style="color:var(--accent2)">clear the filters</a>.</div>';
      return;
    }
    var chip = 'display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;background:var(--surface2);border:1px solid var(--border);color:var(--text-dim);font-size:0.72rem;margin:0.15rem 0.25rem 0 0';
    var topicChip = chip + ';cursor:pointer;color:var(--accent2);border-color:var(--accent2)';
    el.innerHTML = count + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden">'
      + filtered.map(function (d) {
          var covers = _tbSplit(d.covers), tps = _tbSplit(d.topics);
          return '<div style="display:flex;gap:0.75rem;align-items:flex-start;padding:0.7rem 0.9rem;border-bottom:1px solid var(--border)">'
            + '<div style="flex:1;min-width:0">'
            +   '<a href="' + _esc(d.url) + '" target="_blank" rel="noopener" style="color:var(--accent2);font-weight:600;text-decoration:none;font-size:0.92rem;word-break:break-word">' + _esc(d.title || 'untitled') + '</a>'
            +   ' <span style="' + chip + '">' + _esc(d.type || 'link') + '</span>'
            +   (d.date ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + _esc(d.date) + '</span>' : '')
            +   '<div>'
            +     (covers.length ? '<span style="font-size:0.72rem;color:var(--text-dim)">covers</span> ' + covers.slice(0, 12).map(function (c) { return '<span style="' + chip + '">' + _esc(c) + '</span>'; }).join('') + (covers.length > 12 ? '<span style="' + chip + '">+' + (covers.length - 12) + '</span>' : '') : '<span style="font-size:0.72rem;color:var(--text-dim)">general — fits everything</span>')
            +     (tps.length ? ' ' + tps.map(function (t) { return '<span onclick="_tbTopic(\'' + _esc(t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")) + '\')" title="Show everything about ' + _esc(t) + '" style="' + topicChip + '">' + _esc(t) + '</span>'; }).join('') : '')
            +   '</div>'
            +   (d.notes ? '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.2rem">' + _esc(d.notes).slice(0, 160) + (d.notes.length > 160 ? '…' : '') + '</div>' : '')
            + '</div>'
            + '<button onclick="_tbEdit(\'' + _esc(d.id) + '\')" ' + _btn('blue', 'sm', 'flex-shrink:0') + '>Edit</button>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  // click Edit → retag it (title, type, link, covers, topics, notes) or remove it
  window._tbEdit = function (docId) {
    var d = (state.myManuals || []).find(function (x) { return x.id === docId; });
    if (!d) return;
    var old = document.getElementById('tb-edit'); if (old) old.remove();
    var IN = 'width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.6rem';
    var html = '<div id="tb-edit" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9700;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem">'
      + _cardOpen(480)
      + _cardHead('My Manuals', 'Edit', "document.getElementById('tb-edit').remove()")
      + '<label style="' + LB + '">Name</label><input id="tbe-title" type="text" value="' + _esc(d.title) + '" style="' + IN + '">'
      + '<div style="display:flex;gap:0.6rem"><div style="flex:1"><label style="' + LB + '">Type</label><select id="tbe-type" style="' + IN + '">'
      +   ['picture', 'link', 'document', 'video'].map(function (t) { return '<option value="' + t + '"' + (t === d.type ? ' selected' : '') + '>' + t + '</option>'; }).join('')
      + '</select></div></div>'
      + '<label style="' + LB + '">Link</label><input id="tbe-url" type="text" value="' + _esc(d.url) + '" style="' + IN + '">'
      + '<label style="' + LB + '">Covers (item numbers, comma-separated — blank = general)</label><input id="tbe-covers" type="text" value="' + _esc(d.covers) + '" style="' + IN + '">'
      + '<label style="' + LB + '">Topics (comma-separated)</label><input id="tbe-topics" type="text" value="' + _esc(d.topics) + '" style="' + IN + '">'
      + '<label style="' + LB + '">Notes</label><textarea id="tbe-notes" rows="3" style="' + IN + ';resize:vertical">' + _esc(d.notes || '') + '</textarea>'
      + _cardFoot('<button onclick="_tbRemove(\'' + _esc(d.id) + '\')" ' + _btnSecondary('margin-right:auto;color:#e74c3c') + '>Remove</button>'
      + '<button onclick="document.getElementById(\'tb-edit\').remove()" ' + _btnCancel() + '>Cancel</button>'
      + '<button id="tbe-save" ' + _btnSave() + '>Save</button>')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (window.BackStack && BackStack.wire) BackStack.wire(document.getElementById('tb-edit'));
    document.getElementById('tbe-save').onclick = async function () {
      var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
      var title = g('tbe-title'), type = g('tbe-type') || d.type, url = g('tbe-url'), covers = g('tbe-covers'), topics = g('tbe-topics'), notes = g('tbe-notes');
      if (!url) { if (typeof showToast === 'function') showToast('The link can\u2019t be empty.', 2500, true); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!covers && !topics) { if (typeof showToast === 'function') showToast('Give it a topic or an item number so the Toolbox can find it again.', 3500, true); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Saving…';
      try {
        // B..G: Title, Type, URL, Covers, Topics, Notes — column A (Doc ID) is the identity the writer verifies
        var ok = await rrVerifiedRowUpdate(state.personalSheetId, DOCS_TAB, d.row, DOCS_TAB + '!B' + d.row + ':G' + d.row, [[title, type, url, covers, topics, notes]], { num: d.id }, 'My Manuals');
        if (!ok) { btn.disabled = false; btn.textContent = 'Save'; return; }
        var f = document.getElementById('tb-edit'); if (f) f.remove();
        await _loadMyDocs();
        _wbBuild(); _maintRenderMyDocs();
        if (typeof showToast === 'function') showToast('✓ Updated');
      } catch (e) { btn.disabled = false; btn.textContent = 'Save'; if (typeof showToast === 'function') showToast('Could not save — ' + (e && e.message || 'try again'), 4000, true); }
    };
    var first = document.getElementById('tbe-title'); if (first) first.focus();
  };
  window._tbRemove = async function (docId) {
    var d = (state.myManuals || []).find(function (x) { return x.id === docId; });
    if (!d || !confirm('Remove "' + (d.title || 'this') + '" from My Manuals? (The link or file itself is not deleted.)')) return;
    var blank = [['', '', '', '', '', '', '', '']];
    if (!(await rrRemoveRowConfirmed(state.personalSheetId, DOCS_TAB, d.row, DOCS_TAB + '!A' + d.row + ':H' + d.row, blank, { num: d.id }, 'My Manuals'))) return;
    var f = document.getElementById('tb-edit'); if (f) f.remove();
    await _loadMyDocs();
    _wbBuild(); _maintRenderMyDocs();
    if (typeof showToast === 'function') showToast('✓ Removed from My Manuals');
  };

  function _wbBuild() {
    var pg = document.getElementById('page-workbench');
    if (!pg) return;
    // v0.9.1672 (Brad): "just a row for the item, what the maintenance is,
    // and if a part is needed — no buttons; those live on the card you get
    // when you click the row."
    var rows = [];
    var linkedTaskIds = {};
    var partWords = function (p) { var st = p.status || 'wanted'; var nm = p.description || p.partNum || 'part'; return st === 'bought' ? 'Parts on hand — ' + nm : st === 'installed' ? 'Installed — ' + nm : 'Waiting on ' + nm; };
    var openTasks = (state.maintLog || []).filter(function (l) { return l.type === 'chore' && l.status === 'open'; });
    // v0.9.1680: the SAME fold rule as the task card — a part wanted for a
    // unit that was never tied to a task rides on that unit's row when it
    // has exactly one open task, instead of a second "Part wanted" row.
    var unitKey = function (invId, itemNum) { return invId ? 'inv:' + invId : 'num:' + String(itemNum || ''); };
    var openPerUnit = {};
    openTasks.forEach(function (l) { var k = unitKey(l.invId, l.itemNum); openPerUnit[k] = (openPerUnit[k] || 0) + 1; });
    var loosePerUnit = {};
    Object.values(state.partsData || {}).forEach(function (p) {
      var st = p.status || 'wanted';
      if (p.taskId || st === 'installed' || !(p.forInv || p.forItem)) return;
      var k = unitKey(p.forInv, p.forItem);
      if (openPerUnit[k] === 1) { (loosePerUnit[k] = loosePerUnit[k] || []).push(p); linkedTaskIds[p.id] = true; }
    });
    openTasks.forEach(function (l) {
      var parts = Object.values(state.partsData || {}).filter(function (p) { return p.taskId && p.taskId === l.id; });
      parts.forEach(function (p) { linkedTaskIds[p.id] = true; });
      parts = parts.concat(loosePerUnit[unitKey(l.invId, l.itemNum)] || []);
      rows.push({ invId: l.invId, itemNum: l.itemNum, need: l.text, part: parts.map(partWords).join('; '), since: l.dateAdded });
    });
    Object.values(state.partsData || {}).forEach(function (p) {
      var st = p.status || 'wanted';
      if (linkedTaskIds[p.id] || st === 'installed' || !(p.forInv || p.forItem)) return;
      rows.push({ invId: p.forInv, itemNum: p.forItem, need: 'Part wanted', part: partWords(p), since: p.dateAdded });
    });
    // v0.9.1674 (bite 3): two tabs — Bench (this table) and Toolbox (the
    // saved library). Same page, one nav entry, Brad's call.
    var docsN = state.myManuals ? state.myManuals.length : 0;
    var tabs = '<div style="display:flex;gap:0.5rem;margin-bottom:0.9rem;flex-wrap:wrap">'
      + '<button class="eph-tab' + (_wbTabName === 'bench' ? ' active' : '') + '" onclick="_wbTab(\'bench\')">Bench' + (rows.length ? ' · ' + rows.length : '') + '</button>'
      + '<button class="eph-tab' + (_wbTabName === 'toolbox' ? ' active' : '') + '" onclick="_wbTab(\'toolbox\')" data-ctip="Your personalized maintenance manual — every manual, diagram, picture and video you saved, filterable by topic, type or item.">Toolbox' + (docsN ? ' · ' + docsN : '') + '</button>'
      + '</div>';
    if (_wbTabName === 'toolbox') {
      pg.innerHTML = _dz('<div class="page-title">The Workbench</div>' + tabs + '<div id="wb-toolbox"></div>');
      _tbRender();
      return;
    }
    var head = '<div class="page-title">The Workbench</div>' + tabs
      + '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.85rem">Everything that needs a wrench. Click a row to open its card.</div>';
    if (!rows.length) {
      pg.innerHTML = _dz(head + '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><p>Nothing on the bench.</p><p style="font-size:0.8rem;margin-top:0.4rem">Add a task from any item’s Maintenance panel.</p></div>');
      return;
    }
    rows.sort(function (a, b) { return String(a.itemNum).localeCompare(String(b.itemNum), undefined, { numeric: true }) || (a.since || '').localeCompare(b.since || ''); });
    var th = 'text-align:left;font-family:var(--font-head);font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);padding:0.5rem 0.75rem;border-bottom:1px solid var(--border)';
    var td = 'padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);font-size:0.9rem;color:var(--text);vertical-align:top';
    pg.innerHTML = _dz(head
      + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden">'
      + '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + th + '">Item</th><th style="' + th + '">Needs</th><th style="' + th + '">Part</th><th style="' + th + '">Since</th></tr></thead><tbody>'
      + rows.map(function (r) {
          var m = (typeof findMaster === 'function' && r.itemNum) ? findMaster(r.itemNum) : null;
          var label = _esc(r.itemNum) + (m && m.roadName ? ' <span style="color:var(--text-dim);font-weight:400">' + _esc(m.roadName) + '</span>' : '');
          return '<tr onclick="_wbOpen(\'' + _esc(String(r.invId || '')) + '\',\'' + _esc(String(r.itemNum || '')) + '\')" style="cursor:pointer" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">'
            + '<td style="' + td + ';font-weight:700;white-space:nowrap">' + label + '</td>'
            + '<td style="' + td + '">' + _esc(r.need) + '</td>'
            + '<td style="' + td + ';color:' + (r.part ? 'var(--text)' : 'var(--text-dim)') + '">' + (r.part ? _esc(r.part) : '—') + '</td>'
            + '<td style="' + td + ';color:var(--text-dim);white-space:nowrap">' + _esc(r.since || '') + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>');
  }
  // click a Workbench row -> that item's Maintenance card, straight to Work on it
  window._wbOpen = function (invId, itemNum) {
    var pd = null;
    if (invId && state.personalData) {
      var k = Object.keys(state.personalData).find(function (kk) { var p = state.personalData[kk]; return p && String(p.inventoryId || '') === String(invId); });
      pd = k ? state.personalData[k] : null;
    }
    var num = String((pd && pd.itemNum) || itemNum || '');
    var variation = pd ? String(pd.variation || '') : '';
    window._maintOpenPanel(-1, num, variation, invId || (pd && pd.inventoryId) || '');
    setTimeout(function () { if (typeof window._maintShowGrp === 'function') window._maintShowGrp('work'); }, 30);
  };
  window._wbBuild = _wbBuild;

  // ════════════════════════════════════════════════════════════════
  //  v0.9.1673 (Brad: "on the item detail page, we need to add the
  //  maintenance card preview here, be able to click on it to view it")
  //  A compact, read-only summary of THIS copy's Maintenance card, sitting
  //  under the description on the detail page: open tasks (with the state
  //  of any part tied to them), loose parts wanted for this unit, the last
  //  service entry, and how many manuals are saved for this number. The
  //  whole card is one click → the real card. app-collection.js owns the
  //  empty placeholder and calls this only for owners/testers with an
  //  owned copy, so nobody else ever sees a thing. Identity is the
  //  inventoryId (the unit), never the row or the index.
  // ════════════════════════════════════════════════════════════════
  var _previewArgs = null;
  window._maintRenderPreview = function (idx, it, pd) {
    var el = document.getElementById('maint-preview');
    if (!el) return;
    if (!_isOwner() || !pd || !pd.owned) { el.innerHTML = ''; return; }
    _previewArgs = { idx: idx, it: it, pd: pd };
    var invId = String(pd.inventoryId || '');
    var num = String((it && it.itemNum) || pd.itemNum || '').trim();
    var variation = String((it && it.variation != null ? it.variation : pd.variation) || '');
    // a quote inside a variation must survive BOTH the attribute decode and
    // the JS string: backslash it for JS first, then HTML-escape the lot
    var openArgs = (typeof idx === 'number' ? idx : -1) + ",'" + _esc(num) + "','" + _esc(variation.replace(/\\/g, '\\\\').replace(/'/g, "\\'")) + "','" + _esc(invId) + "'";
    var line = function (txt) { return '<div style="font-size:0.85rem;color:var(--text);line-height:1.5;padding:0.15rem 0">' + txt + '</div>'; };
    var dim = function (txt) { return '<span style="color:var(--text-dim);font-size:0.76rem">' + txt + '</span>'; };
    var render = function () {
      var box = document.getElementById('maint-preview');
      if (!box) return;   // the detail page moved on while a load was in flight
      var mine = function (l) { return invId ? l.invId === invId : l.itemNum === num; };
      var log = (state.maintLog || []).filter(mine);
      var tasks = log.filter(function (l) { return l.type === 'chore' && l.status === 'open'; })
        .sort(function (a, b) { return (a.dateAdded || '').localeCompare(b.dateAdded || ''); });
      var history = log.filter(function (l) { return !(l.type === 'chore' && l.status === 'open'); })
        .sort(function (a, b) { return (b.dateDone || b.dateAdded || '').localeCompare(a.dateDone || a.dateAdded || ''); });
      var linked = {};
      var body = '';
      tasks.forEach(function (t) {
        var parts = _taskParts(t.id);
        parts.forEach(function (p) { linked[p.id] = true; });
        var partTxt = parts.map(function (p) {
          var st = p.status || 'wanted';
          var nm = _esc(p.description || p.partNum || 'part');
          return st === 'bought' ? '✓ Parts on hand — ' + nm : st === 'installed' ? 'Installed — ' + nm : 'Waiting on “' + nm + '”';
        }).join(' · ');
        body += line('<b>' + _esc(t.text) + '</b> ' + dim('since ' + _esc(t.dateAdded || '?'))
          + (partTxt ? '<div style="font-size:0.78rem;color:var(--text-mid);margin-left:1.3rem">' + partTxt + '</div>' : ''));
      });
      Object.values(state.partsData || {}).forEach(function (p) {
        var st = p.status || 'wanted';
        if (linked[p.id] || st === 'installed') return;
        if (!(invId ? p.forInv === invId : (p.forItem === num && !p.forInv))) return;
        body += line((st === 'bought' ? '✓ <b>Parts on hand</b> — ' : '<b>Waiting on</b> ') + _esc(p.description || p.partNum || 'part') + ' ' + dim('Parts Needed list'));
      });
      if (history.length) {
        var h = history[0];
        body += line('<b>Last service:</b> ' + _esc(h.dateDone || h.dateAdded || '') + ' — ' + (h.type === 'part-installed' ? 'installed ' : '') + _esc(h.text)
          + (history.length > 1 ? ' ' + dim('+' + (history.length - 1) + ' more') : ''));
      }
      var docs = state.myManuals ? _docCovers({ itemNum: num }) : null;
      body += line((docs === null ? dim('loading manuals…')
        : docs.length ? '<b>' + docs.length + '</b> saved ' + (docs.length === 1 ? 'manual / doc' : 'manuals / docs') + ' for ' + _esc(num)
        : dim('No manuals saved for ' + _esc(num) + ' yet')));
      if (!tasks.length && !history.length && docs !== null && !docs.length && body.indexOf('Waiting on') < 0 && body.indexOf('Parts on hand') < 0) {
        body = line(dim('Nothing on the bench — open the card to add a task, find manuals, or log service.'));
      }
      box.innerHTML = '<div onclick="_maintOpenPanel(' + openArgs + ')" title="Open the Maintenance card" '
        + 'onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'var(--surface)\'" '
        + 'style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.75rem 0.9rem;margin-top:0.5rem;cursor:pointer">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.35rem">'
        +   '<div style="font-family:var(--font-head);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Maintenance</div>'
        +   '<div style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap">Open card →</div>'
        + '</div>'
        + body
        + '</div>';
    };
    render();
    // what the card needs but the page may not have loaded yet
    var waits = [];
    if (!state.maintLog) waits.push(_loadLog());
    if (!state.myManuals) waits.push(_loadMyDocs());
    if (waits.length) Promise.all(waits).then(render, render);
  };
  // the panel's × — closes it and brings the preview underneath up to date
  window._maintClosePanel = function () {
    var ov = document.getElementById('maint-overlay');
    if (ov) ov.remove();
    if (_previewArgs && document.getElementById('maint-preview')) {
      window._maintRenderPreview(_previewArgs.idx, _previewArgs.it, _previewArgs.pd);
    }
  };

  function _wbInjectUI() {
    var main = document.getElementById('main-content');   // v0.9.1657: was querySelector('.main-content') — the element's CLASS is 'main'; null fell back to #app and the page rendered BELOW the billboard (Brad's screenshot)
    if (!main) return false;
    if (!document.getElementById('page-workbench')) {
      var pg = document.createElement('div');
      pg.className = 'page'; pg.id = 'page-workbench';
      main.appendChild(pg);
    }
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return false;
    if (!document.getElementById('nav-workbench-btn')) {
      var ymBtn = document.getElementById('nav-yardmaster-btn');
      var refreshBtn = sidebar.querySelector('#refresh-btn');
      var homeSection = (ymBtn && ymBtn.parentElement) || (refreshBtn && refreshBtn.parentElement) || sidebar.querySelector('.nav-section');
      if (!homeSection) return false;
      var btn = document.createElement('button');
      btn.className = 'nav-item'; btn.id = 'nav-workbench-btn';
      btn.setAttribute('data-ctip', 'The Workbench — open chores and parts, per item. Only you see this.');
      btn.onclick = function () { showPage('workbench', this); _loadLog().then(function(){ _wbBuild(); _wbBadge(); }); if (!state.myManuals) _loadMyDocs().then(_wbBuild); _wbBuild(); };
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>Workbench<span id="nav-workbench-count" class="nav-badge" style="display:none"></span>';
      if (ymBtn) homeSection.insertBefore(btn, ymBtn);
      else if (refreshBtn) homeSection.insertBefore(btn, refreshBtn);
      else homeSection.appendChild(btn);
    }
    if (!document.getElementById('page-partsbin')) {
      var pg2 = document.createElement('div');
      pg2.className = 'page'; pg2.id = 'page-partsbin';
      main.appendChild(pg2);
    }
    if (!document.getElementById('nav-partsbin-btn')) {
      var wbBtn = document.getElementById('nav-workbench-btn');
      var btn2 = document.createElement('button');
      btn2.className = 'nav-item'; btn2.id = 'nav-partsbin-btn';
      btn2.setAttribute('data-ctip', 'Parts you own that aren’t on a train yet. Need-a-part checks here first.');
      btn2.onclick = function () { showPage('partsbin', this); _loadBin().then(_binBuild); _binBuild(); };
      btn2.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>Parts Bin';
      if (wbBtn && wbBtn.parentElement) wbBtn.parentElement.insertBefore(btn2, wbBtn.nextSibling);
    }
    _loadLog().then(_wbBadge);
    return true;
  }

  (function _wbBoot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (tries > 240) { clearInterval(t); return; }
      var appEl = document.getElementById('app');
      if (!appEl || !appEl.classList.contains('active') || !window.state || !state.user || !state.user.email) return;
      if (!_isOwner()) { clearInterval(t); return; }
      if (_wbInjectUI()) clearInterval(t);
    }, 500);
  })();

})();
