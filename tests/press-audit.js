// ══ tests/press-audit.js — press every control, record what happened ═════
//
// Sweep 2 of the silent-control audit (Session 94). Sweep 1
// (tests/silent-audit.js) READ the code for controls that give up quietly.
// This one PRESSES them. Brad: "We need to make sure all the buttons actually
// work like we found today with the photo crop next arrow."
//
// Same harness as phone-audit.js: the REAL app/index.html booted headless
// with the shared synthetic collection (tests/lib/guide-fixture.js), pages
// opened through the app's own navigation, no sign-in, every Google/CDN
// request aborted. On every page and overlay, at four widths, it finds every
// visible control, presses each one from a clean copy of the page, waits,
// and sorts the outcome into one of:
//
//   NAVIGATED  another page became active
//   OPENED     a new full-screen-ish fixed layer appeared (modal, sheet, tour)
//   CLOSED     one went away
//   SPOKE      a toast / alert / confirm / prompt
//   CHANGED    the visible text or a control's state (checked, class, value,
//              aria-*) changed
//   FOCUSED    an input took focus (clicking into the search box)
//   SCROLLED   the page scrolled (the v1708 "jump to this unit's photos" —
//              inside #main-content, the app's real scroller, not the window)
//   REACTED    the DOM changed (a class, an inline style — a highlight ring)
//              but no text, layer, page or speech did; listed, not a finding
//   ERROR      a page error or console.error fired during the press (errors
//              the harness guarantees — "Not signed in", a blocked fetch — are
//              tagged SIGNED-OUT-ERR instead and, if that is all that
//              happened, also NOTHING: the user saw nothing)
//   COVERED    the control's centre is under another element — a user's tap
//              lands on that other thing (the guide-cover class); not pressed
//   OFFSCREEN  cannot be scrolled into the viewport at all; not pressed
//   FLASHED    brief feedback ("Loading…") that was gone again by the time
//              the page settled — the user saw it; listed, not a finding
//   NOTHING    none of the above. THE FINDING CLASS — the › arrow's class.
//
// A control that is already in the state it toggles to (an active tab, a
// checked box) that then does NOTHING is set aside as ALREADY-ACTIVE, not
// counted. A NOTHING whose handler (or what it calls directly) touches the
// network is tagged NET — there is no network here, so "did nothing" may be
// "did nothing because it could not"; the question for those is whether it
// SAID so, and a NET+NOTHING that stayed silent is still a finding.
//
// NEVER PRESSED (the deny-list, DENY_RE — printed at the top of the report):
// delete, remove, trash, record sale / sold, sign out, disconnect, revoke,
// reset, clear all, wipe, send, submit, email, print, share, camera, capture,
// upload, pay, purchase, buy, undo, restore, archive, migrate, reload /
// update-now, sign-in / connect, install; file inputs; links that leave the
// app (http, mailto, target=_blank). Nothing pressed here can write to the
// Sheet or Drive: there is no sign-in and the network is blocked anyway.
//
// This is an AUDIT, not a gate: it writes /tmp/rr-press-audit/findings.json
// plus before/after screenshots for each distinct NOTHING / COVERED / ERROR,
// and exits 0 unless the app fails to boot. Findings become red pins as they
// are fixed, never before.
//
//   node tests/press-audit.js                 everything (30–60 min)
//   node tests/press-audit.js --widths 360    one width (comma list)
//   node tests/press-audit.js --pages dashboard,tools   a subset (comma list)
//   node tests/press-audit.js --count         enumerate controls only, no presses
//   RR_FIXTURE=empty node tests/press-audit.js   the brand-new-user collection
'use strict';

const fs = require('fs');
const path = require('path');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  press-audit needs playwright (declared devDependency; npm install).'); process.exit(1); }

const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
const OUT = process.env.RR_PRESS_OUT || '/tmp/rr-press-audit';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : ''; };
const COUNT_ONLY = argv.includes('--count');
const ONLY_WIDTHS = argOf('--widths').split(',').filter(Boolean).map(Number);
const ONLY_PAGES = argOf('--pages').split(',').filter(Boolean);
const CAP = +(argOf('--cap') || 160);           // distinct controls pressed per page×width
const SETTLE_MS = +(argOf('--settle') || 450);  // wait after a press before looking

// ── the deny-list: one place, printed in the report ───────────────────────
const DENY_RE = /\b(delete|remove|trash|record (a )?sale|mark (as )?sold|sold\b|sign ?out|log ?out|disconnect|revoke|reset|clear all|wipe|send|submit|e-?mail|print|share|camera|capture|upload|pay\b|purchase|buy\b|undo|restore|archive|migrate|reload|update now|sign ?in|connect google|install)\b/i;
const DENY_ONCLICK_RE = /location\.reload|window\.open\(|signOut|logout|_delete|Delete\(|remove[A-Z]|Sold\(|_sold|gapi\.auth|requestAccessToken|\.print\(|navigator\.share|mailto:/;

// ── widths: two phones (phone UA → the app BUILDS its phone layout), a
// tablet (iPad UA), a desktop ─────────────────────────────────────────────
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const WIDTHS = [
  { w: 360, h: 800, label: 'small Android', ua: PHONE_UA, mobile: true },
  { w: 412, h: 915, label: 'Galaxy S25 Ultra', ua: PHONE_UA, mobile: true },
  { w: 768, h: 1024, label: 'iPad', ua: IPAD_UA, mobile: true },
  { w: 1440, h: 900, label: 'desktop', ua: DESKTOP_UA, mobile: false },
].filter(x => !ONLY_WIDTHS.length || ONLY_WIDTHS.includes(x.w));

// ── the doors: the same calls the app's own navigation makes ─────────────
// (phone-audit.js's list, plus the grouped-set detail page — Sweep 1's A1 —
// and the Help Centre.)
const PAGES = [
  { id: 'dashboard',   open: "showPage('dashboard', null)" },
  { id: 'collection',  open: "showPage('browse', null); filterOwned();", pageId: 'browse' },
  { id: 'catalog',     open: "showPage('browse', null); resetFilters(); renderBrowse();", pageId: 'browse' },
  { id: 'upgrade',     open: "showPage('upgrade', null); buildUpgradePage();" },
  { id: 'forsale',     open: "showPage('forsale', null); buildForSalePage();" },
  { id: 'parts',       open: "showPage('parts', null); buildPartsPage();" },
  { id: 'sold',        open: "showPage('sold', null);" },
  { id: 'reports',     open: "showPage('reports', null);" },
  { id: 'tools',       open: "showPage('tools', null);" },
  { id: 'contacts',    open: "showPage('contacts', null);" },
  { id: 'prefs',       open: "showPage('prefs', null); buildPrefsPage();" },
  { id: 'photo-inbox', open: "window._pinGo(document.getElementById('nav-photo-inbox'));" },
  { id: 'itemdetail',  open: "showPage('dashboard', null); var pd = Object.values(state.personalData||{}).find(function(p){return p.itemNum==='3376';}); if (pd && typeof _openOwnedByInvId==='function') _openOwnedByInvId(pd.inventoryId);" },
  { id: 'itemdetail-group', open: "showPage('dashboard', null); if (typeof _openOwnedByInvId==='function') _openOwnedByInvId('46002');", pageId: 'itemdetail' },
];
const OVERLAYS = [
  { id: 'wizard-step1', base: 'dashboard', open: "startWizardFor('collection');" },
  { id: 'onboarding-1', base: 'dashboard', open: "showFeatureMap();" },
  { id: 'onboarding-4', base: 'dashboard', open: "showFeatureMap(); onboardNext(); onboardNext(); onboardNext();" },
  { id: 'report-form',  base: 'dashboard', open: "if (typeof errReportOpen==='function') errReportOpen();" },
  { id: 'inbox-sources', base: 'photo-inbox', open: "window._pinAddSource && window._pinAddSource();" },
  { id: 'help-hub',     base: 'dashboard', open: "if (typeof openHelpHub==='function') openHelpHub();" },
];
const DOORS = PAGES.map(p => ({ ...p, overlay: false })).concat(OVERLAYS.map(o => ({ ...o, overlay: true })))
  .filter(d => !ONLY_PAGES.length || ONLY_PAGES.includes(d.id));

// ── extra seed: make the 773 a grouped set (engine + its 773W tender) so the
// grouped-set detail page and its unit boxes exist ────────────────────────
const SEED_GROUP = `
(function () {
  try {
    var P = state.personalData || {};
    var eng = null; Object.keys(P).forEach(function (k) { if (P[k] && P[k].itemNum === '773') eng = P[k]; });
    if (!eng) return;
    eng.groupId = 'G773'; eng.photoItem = 'fake-folder-773';
    var row = Object.keys(P).length + 2;
    P['773W|1|' + row] = { itemNum:'773W', variation:'1', owned:true, inventoryId:'46009', row:row,
      condition:'8', priceItem:'', userEstWorth:'', datePurchased:'2026-08-06', photoItem:'fake-folder-773w',
      notes:'', era:'Lionel Postwar', location:'', groupId:'G773' };
    state.personalData = P;
    try { if (typeof buildPartnerMap === 'function') buildPartnerMap(); } catch (e) {}
    try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
  } catch (e) {}
})();`;

// ── in-page kit: hooks + snapshot + enumerate + aim ───────────────────────
const KIT = `
(function () {
  window.__rrSaid = []; window.__rrErrs = [];
  if (!window.__rrHooked) {
    window.__rrHooked = true;
    var _toast = window.showToast;
    window.showToast = function (msg) { try { window.__rrSaid.push('toast: ' + String(msg).slice(0, 80)); } catch (e) {} return _toast ? _toast.apply(this, arguments) : undefined; };
    window.alert = function (m) { window.__rrSaid.push('alert: ' + String(m).slice(0, 80)); };
    window.confirm = function (m) { window.__rrSaid.push('confirm: ' + String(m).slice(0, 80)); return false; };
    window.prompt = function (m) { window.__rrSaid.push('prompt: ' + String(m).slice(0, 80)); return null; };
    window.open = function (u) { window.__rrSaid.push('window.open: ' + String(u).slice(0, 80)); return null; };
    var _cerr = console.error; console.error = function () { try { window.__rrErrs.push('console.error: ' + Array.prototype.map.call(arguments, String).join(' ').slice(0, 120)); } catch (e) {} return _cerr.apply(console, arguments); };
    window.addEventListener('error', function (e) { window.__rrErrs.push('error: ' + String(e.message || e).slice(0, 120)); });
    window.addEventListener('unhandledrejection', function (e) { window.__rrErrs.push('rejection: ' + String(e.reason && e.reason.message || e.reason).slice(0, 120)); });
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }
  // Every DOM change during a press, except the chrome that comes and goes on
  // its own. A ring drawn with an inline style is invisible to a text hash;
  // this sees it.
  window.__rrMut = 0;
  if (!window.__rrObs) {
    window.__rrObs = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target; if (t.nodeType !== 1) t = t.parentElement;
        if (!t) { window.__rrMut++; continue; }
        if (recs[i].type === 'attributes' && recs[i].attributeName === 'data-rrpress') continue;
        if (t.closest && t.closest('#toast, #offline-banner, #pwa-install-offer, #ios-install-hint, #rr-update-bar')) continue;
        window.__rrMut++;
      }
    });
    window.__rrObs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  }
  // Where the app really scrolls: #main-content on a phone, not the window.
  function scrollSum() {
    var y = window.scrollY;
    document.querySelectorAll('main, [id], section, div').forEach(function (el) {
      if (el.scrollTop && el.scrollHeight > el.clientHeight + 50) y += el.scrollTop;
    });
    return Math.round(y);
  }
  function vis(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    var b = el.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return false;
    // an ancestor hidden by display:none makes offsetParent null (unless fixed)
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    // content of a closed <details> reports a rect but paints nothing
    var det = el.closest('details:not([open])');
    if (det && el.tagName !== 'SUMMARY' && !(el.closest('summary') && det.contains(el.closest('summary')))) return false;
    // opacity and visibility do not show in a child's computed style — the
    // legacy #tut-panel is opacity:0 and slid off-screen, and its buttons read
    // as perfectly visible without this walk
    for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      var acs = getComputedStyle(a);
      if (acs.opacity === '0' || acs.visibility === 'hidden' || acs.display === 'none') return false;
    }
    return true;
  }
  // Chrome that comes and goes on its own (offline banner, install offers,
  // the update bar, toasts) is not an effect of a press and is never a layer.
  var NOISE_IDS = /^(toast|offline-banner|pwa-install-offer|ios-install-hint|rr-update-bar)$/;
  function layerKey(el) {
    if (el.id) return el.id;
    if (!el.dataset.rrlayer) { window.__rrLayerN = (window.__rrLayerN || 0) + 1; el.dataset.rrlayer = 'L' + window.__rrLayerN; }
    return '@' + el.dataset.rrlayer;
  }
  window.__rrLayerEl = function (key) { return key.charAt(0) === '@' ? document.querySelector('[data-rrlayer="' + key.slice(1) + '"]') : document.getElementById(key); };
  function sig(el) { return el ? (el.tagName + '#' + (el.id || '') + '.' + String(el.className || '').split(' ')[0]).slice(0, 70) : ''; }
  window.__rrLayers = function () {
    var vw = innerWidth, vh = innerHeight, out = [];
    document.querySelectorAll('body *').forEach(function (el) {
      if (NOISE_IDS.test(el.id || '')) return;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return;
      if (!vis(el)) return;
      var b = el.getBoundingClientRect();
      if (b.width * b.height < 0.05 * vw * vh) return;
      out.push(layerKey(el));
    });
    return out;
  };
  window.__rrSnap = function () {
    var mutSoFar = window.__rrMut; window.__rrMut = 0;
    var active = document.querySelector('.page.active');
    var layers = window.__rrLayers();
    var text = active ? (active.innerText || '') : '';
    layers.forEach(function (id) { var el = window.__rrLayerEl(id); if (el) text += '\\n' + (el.innerText || ''); });
    var attrs = '';
    document.querySelectorAll('button,a,select,input,textarea,[onclick],[role=button],[role=tab],[aria-pressed],[aria-expanded],[aria-selected]').forEach(function (el) {
      if (!vis(el)) return;
      attrs += (el.id || '') + '|' + el.className + '|' + (el.checked ? 1 : 0) + '|' + (el.tagName === 'SELECT' || el.tagName === 'INPUT' ? (el.value || '') : '') + '|' +
               (el.getAttribute('aria-pressed') || '') + (el.getAttribute('aria-expanded') || '') + (el.getAttribute('aria-selected') || '') + '|' + (el.disabled ? 1 : 0) + ';';
    });
    var f = document.activeElement;
    return { active: active ? active.id : '', layers: layers, textHash: hash(text), textLen: text.length, attrsHash: hash(attrs),
             focus: (f && f !== document.body) ? sig(f) : '', focusIsInput: !!(f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName) && f !== document.body),
             scrollY: scrollSum(), hash: location.hash, mutations: mutSoFar,
             said: window.__rrSaid.splice(0), errors: window.__rrErrs.splice(0) };
  };
  window.__rrControls = function (denyRe, denyOc) {
    var sel = 'button, a[href], a[onclick], [onclick], [role=button], [role=tab], input[type=checkbox], input[type=radio], input[type=button], input[type=submit], select, label[for], summary';
    var list = [], seen = {}, dupes = 0, disabled = 0, denied = [];
    document.querySelectorAll('[data-rrpress]').forEach(function (el) { el.removeAttribute('data-rrpress'); });
    document.querySelectorAll(sel).forEach(function (el) {
      if (!vis(el)) return;
      if (el.closest('select') && el.tagName !== 'SELECT') return;
      if (el.closest('#toast')) return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') { disabled++; return; }
      var text = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\\s+/g, ' ').slice(0, 50);
      var oc = el.getAttribute('onclick') || '';
      var href = el.getAttribute('href') || '';
      var handler = (function () { var re = /([A-Za-z_$][\\w$]*)\\s*\\(/g, m; while ((m = re.exec(oc))) { if (!/^(if|typeof|return|void|event|window|document|this|function|new|else|for|while|switch|catch|setTimeout|requestAnimationFrame)$/.test(m[1])) return m[1]; } return ''; })() ||
                    (el.onclick ? 'onclick-prop' : el.tagName === 'SELECT' ? 'select' : (el.type === 'checkbox' || el.type === 'radio') ? 'toggle' :
                     el.tagName === 'LABEL' ? 'label' : el.tagName === 'SUMMARY' ? 'summary' : href ? 'href' : 'listener');
      var norm = function (s) { return String(s).replace(/\\d+/g, '#').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'); };
      var key = el.tagName + '#' + norm(el.id) + '|' + handler + '|' + norm(text).slice(0, 40);
      if (seen[key]) { dupes++; return; }
      seen[key] = 1;
      var hay = [text, el.title || '', el.getAttribute('aria-label') || '', el.id, el.className, oc.slice(0, 200)].join(' ');
      var deny = denyRe.test(hay) || denyOc.test(oc) || (el.tagName === 'INPUT' && el.type === 'file') ||
                 /^(https?:|mailto:|tel:)/.test(href) || el.getAttribute('target') === '_blank' ||
                 (el.tagName === 'LABEL' && (function () { var t = document.getElementById(el.getAttribute('for')); return !!(t && t.type === 'file'); })());
      var cls = ' ' + String(el.className || '') + ' ';
      var already = el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true' ||
                    / (active|selected|current|on|checked) /.test(cls) || (el.checked === true && el.type === 'radio');
      if (deny) { denied.push({ sig: sig(el), text: text, handler: handler }); return; }
      el.setAttribute('data-rrpress', String(list.length));
      list.push({ i: list.length, key: key, sig: sig(el), tag: el.tagName, id: el.id || '', text: text, handler: handler, oc: oc.slice(0, 140), href: href.slice(0, 80),
                  type: el.type || '', already: already, inLayer: (function () { var L = window.__rrLayers(); for (var k = 0; k < L.length; k++) { var le = window.__rrLayerEl(L[k]); if (le && le.contains(el)) return L[k]; } return ''; })() });
    });
    return { list: list, dupes: dupes, disabled: disabled, denied: denied };
  };
  window.__rrAim = function (i) {
    var el = document.querySelector('[data-rrpress="' + i + '"]');
    if (!el) return { gone: true };
    // a control that was visible when the door was indexed can have been
    // hidden since by an earlier press's late timer (a modal fading out) —
    // pressing its ghost would land on whatever is underneath and read as
    // COVERED; that is not a finding about the app
    if (!vis(el)) return { gone: true, hidden: true };
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    var b = el.getBoundingClientRect();
    var x = b.left + b.width / 2, y = b.top + b.height / 2;
    var inView = x >= 1 && y >= 1 && x <= innerWidth - 1 && y <= innerHeight - 1;
    var hit = inView ? document.elementFromPoint(x, y) : null;
    var covered = !!(inView && hit && !(el === hit || el.contains(hit) || hit.contains(el)));
    return { x: x, y: y, inView: inView, covered: covered, hit: hit ? sig(hit) : '', hitText: hit ? (hit.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40) : '' };
  };
  window.__rrProgrammatic = function (i) {
    var el = document.querySelector('[data-rrpress="' + i + '"]');
    if (!el) return false;
    if (el.tagName === 'SELECT') { if (el.options.length > 1) { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); } return true; }
    el.click(); return true;
  };
  window.__rrRestore = function (baseLayers, baseIds) {
    try { if (typeof _gtEnd === 'function') _gtEnd(); } catch (e) {}
    try { if (typeof tutEnd === 'function') tutEnd(); } catch (e) {}
    try { if (typeof window._clearOverlays === 'function') window._clearOverlays(); } catch (e) {}
    try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
    ['toast', 'offline-banner', 'pwa-install-offer', 'ios-install-hint', 'rr-update-bar'].forEach(function (id) { var n = document.getElementById(id); if (n) n.remove(); });
    document.querySelectorAll('.modal-overlay.open').forEach(function (el) { if (baseLayers.indexOf(layerKey(el)) < 0) el.classList.remove('open'); });
    var now = window.__rrLayers();
    now.forEach(function (key) {
      if (baseLayers.indexOf(key) >= 0) return;
      var el = window.__rrLayerEl(key); if (!el) return;
      if (el.id && baseIds[el.id]) { el.classList.remove('open'); el.classList.remove('active'); if (vis(el)) { el.style.display = 'none'; el.__rrHidden = true; } }
      else if (el.parentNode) el.parentNode.removeChild(el);
    });
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    window.scrollTo(0, 0);
  };
  window.__rrUnhide = function () {
    document.querySelectorAll('[id]').forEach(function (el) { if (el.__rrHidden) { el.style.display = ''; el.__rrHidden = false; } });
  };
  window.__rrBaseIds = function () { var o = {}; document.querySelectorAll('[id]').forEach(function (el) { o[el.id] = 1; }); return o; };
})();`;

// ── handler → touches the network? (from the static scanner's index) ─────
let NET = new Set(), PICKER = new Set();
try {
  const sa = require('./silent-audit.js');
  const fns = sa.collectFunctions(sa.readApp());
  const PICKER_RE = /type\s*=\s*['"]file['"]|input\[type=file\]|\.accept\s*=\s*['"]image|capture\s*=\s*['"]environment|showOpenFilePicker|google\.picker/;
  fns.forEach((fn, name) => { if (PICKER_RE.test(fn.body)) PICKER.add(name); });
  const NET_RE = /gapi\.|fetch\(|googleapis|XMLHttpRequest|_drive[A-Z_]|Drive[A-Z]|_sheets|Sheets[A-Z]|rrApi|_apiFetch|withToken|accessToken|requestAccessToken|navigator\.onLine/;
  const CALL_RE = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  fns.forEach((fn, name) => {
    if (NET_RE.test(fn.body)) { NET.add(name); return; }
    let m; CALL_RE.lastIndex = 0;
    while ((m = CALL_RE.exec(fn.body))) { const k = fns.get(m[1]); if (k && k !== fn && NET_RE.test(k.body)) { NET.add(name); break; } }
  });
} catch (e) { console.log('(net-tagging unavailable: ' + e.message.slice(0, 80) + ')'); }

// Errors the harness itself guarantees (no sign-in, no network) are not
// findings about a control; they are kept on the record, tagged apart.
const EXPECTED_ERR_RE = /Not signed in|Sign in to|Failed to fetch|net::ERR_|NetworkError|gapi is not defined|google is not defined|is not signed in|No access token|token/i;
// A press that never settles (a handler that spins, a renderer that hangs)
// must not stall the sweep: every step of a press races a clock.
const PRESS_TIMEOUT_MS = +(argOf('--press-timeout') || 15000);
function withTimeout(p, ms, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('TIMEOUT ' + what)), ms); })]).finally(() => clearTimeout(t));
}
const VERBOSE = argv.includes('--verbose');

function classify(before, after, aim, pressErrs) {
  const tags = [];
  const errs = (after.errors || []).concat(pressErrs);
  const real = errs.filter(e => !EXPECTED_ERR_RE.test(e));
  if (real.length) tags.push('ERROR');
  else if (errs.length) tags.push('SIGNED-OUT-ERR');
  if (after.active !== before.active) tags.push('NAVIGATED');
  const gained = after.layers.filter(l => !before.layers.includes(l));
  const lost = before.layers.filter(l => !after.layers.includes(l));
  if (gained.length) tags.push('OPENED');
  if (lost.length) tags.push('CLOSED');
  if (after.said && after.said.length) tags.push('SPOKE');
  if (after.textHash !== before.textHash || after.attrsHash !== before.attrsHash) tags.push('CHANGED');
  if (after.focusIsInput && after.focus !== before.focus) tags.push('FOCUSED');
  if (Math.abs(after.scrollY - before.scrollY) > 40) tags.push('SCROLLED');
  if (!tags.length && after.mutations > 0) tags.push('REACTED');   // the DOM changed (a style, a class) but no text, layer, page or speech did
  if (!tags.length) tags.push('NOTHING');
  // a SIGNED-OUT-ERR alone is a control that did nothing visible and only
  // complained to the console — for the user that is NOTHING; keep both tags
  if (tags.length === 1 && tags[0] === 'SIGNED-OUT-ERR') tags.push('NOTHING');
  return { tags, gained, lost };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const findings = [];      // one per press
  const summary = { widths: [], presses: 0, denied: 0, dupes: 0, disabled: 0, reboots: 0, boots: 0, counts: {} };
  const shots = new Set();
  let booted = 0;

  // The page under test can wedge its own renderer (the want/upgrade report
  // found on the first full run retries a failed read ~2,900 times a second,
  // forever). A wedged renderer will not even navigate away, so a reboot
  // starts by throwing the page away and opening a fresh one in the context;
  // if the context itself will not answer, a fresh context.
  let ctx = null, page = null, W = null;
  const pageErrs = [];
  async function newContext() {
    ctx = await browser.newContext({ viewport: { width: W.w, height: W.h }, isMobile: W.mobile, hasTouch: W.mobile, deviceScaleFactor: W.mobile ? 3 : 1, userAgent: W.ua });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); localStorage.setItem('lv_ios_hint_dismissed', '1'); } catch (e) {} });
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**', '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**', '**://*.google.com/**', '**://fonts.gstatic.com/**'])
      await ctx.route(u, r => r.abort());
  }
  async function freshPage() {
    if (page) { try { await withTimeout(page.close({ runBeforeUnload: false }), 8000, 'page.close'); } catch (e) { try { await withTimeout(ctx.close(), 8000, 'ctx.close'); } catch (e2) {} await newContext(); } }
    page = await ctx.newPage();
    page.on('pageerror', e => pageErrs.push('pageerror: ' + e.message.slice(0, 120)));
    page.on('dialog', d => { pageErrs.push('dialog: ' + d.type()); d.dismiss().catch(() => {}); });
  }
  async function boot() {
    await freshPage();
    await page.goto('file://' + APP + '/index.html', { timeout: 45000 });
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(SEED_GROUP);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const ob = document.getElementById('offline-banner'); if (ob) ob.remove();
      const wc = document.getElementById('rr-welcome-card'); if (wc) wc.remove();
      document.querySelectorAll('[id*=welcome]').forEach(el => { if (el.id !== 'page-dashboard' && /overlay|card|ov/.test(el.id)) el.remove(); });
    });
    await page.evaluate(KIT);
    summary.boots++;
    return page.evaluate(() => !!(window.state && state.masterData && state.masterData.length && typeof showPage === 'function'));
  }

  try {
    for (const width of WIDTHS) {
      W = width; page = null;
      await newContext();
      const ok = await boot();
      if (!ok) { console.log('FAIL  boot at ' + W.w + 'px — ' + pageErrs.join(' | ')); await ctx.close(); continue; }
      booted++;
      pageErrs.length = 0;

      for (const door of DOORS) {
        let pageLayers = [];
        const openDoor = async () => {
          if (door.overlay) {
            const base = PAGES.find(p => p.id === door.base);
            await page.evaluate(new Function('try {' + base.open + '} catch (e) {}'));
            await page.waitForTimeout(350);
            pageLayers = await page.evaluate(() => window.__rrLayers());
          }
          await page.evaluate(new Function('try {' + door.open + '} catch (e) { window.__rrErrs.push("open: " + e.message); }'));
          await page.waitForTimeout(door.overlay ? 800 : 650);
        };
        try {
          // Every door starts from a fresh boot: what one door's presses leave
          // behind (a hidden overlay element, a pending timer) must not become
          // the next door's finding. Costs ~4s a door.
          if (door !== DOORS[0]) await boot();
          await openDoor();
          const baseIds = await page.evaluate(() => window.__rrBaseIds());
          let base = await page.evaluate(() => window.__rrSnap());
          const enumr = await page.evaluate(d => window.__rrControls(new RegExp(d.a, 'i'), new RegExp(d.b)), { a: DENY_RE.source, b: DENY_ONCLICK_RE.source });
          summary.denied += enumr.denied.length; summary.dupes += enumr.dupes; summary.disabled += enumr.disabled;
          // An overlay covers the page on purpose. Only the overlay's own
          // controls are pressed; the page's controls underneath are counted
          // as "behind" — a modal that did NOT cover them would be the bug.
          let behind = 0, list = enumr.list;
          if (door.overlay) {
            const own = base.layers.filter(l => !pageLayers.includes(l));
            list = enumr.list.filter(c => own.includes(c.inLayer));
            behind = enumr.list.length - list.length;
          }
          list = list.slice(0, CAP);
          const shown = door.overlay ? base.layers.some(l => !pageLayers.includes(l)) : base.active === 'page-' + (door.pageId || door.id);
          console.log('  ' + String(W.w).padEnd(5) + door.id.padEnd(18) + String(list.length).padStart(4) + ' controls (' + enumr.denied.length + ' denied, ' + enumr.dupes + ' repeats' + (behind ? ', ' + behind + ' behind the overlay' : '') + ')' + (shown ? '' : (door.overlay ? '  !! overlay never appeared' : '  !! page not active: ' + base.active)));
          findings.push({ kind: 'door', width: W.w, door: door.id, controls: list.length, behind, pressed: Math.min(list.length, CAP), denied: enumr.denied, shown, active: base.active, layers: base.layers });
          if (door.overlay && !shown) continue;
          if (COUNT_ONLY) continue;

          for (const c of list) {
            if (VERBOSE) console.log('      press ' + door.id + '@' + W.w + ' #' + c.i + ' ' + c.sig + ' "' + c.text.slice(0, 30) + '" (' + c.handler + ')');
            // aim
            let aim;
            try {
              aim = await withTimeout(page.evaluate(i => window.__rrAim(i), c.i), PRESS_TIMEOUT_MS, 'aim');
            } catch (e) {
              findings.push({ kind: 'press', width: W.w, door: door.id, ...c, tags: ['TIMEOUT'], note: 'the page stopped answering before the press (' + e.message.slice(0, 60) + ')' });
              summary.counts.TIMEOUT = (summary.counts.TIMEOUT || 0) + 1; summary.reboots++;
              await boot(); await openDoor(); base = await page.evaluate(() => window.__rrSnap());
              await page.evaluate(d => window.__rrControls(new RegExp(d.a, 'i'), new RegExp(d.b)), { a: DENY_RE.source, b: DENY_ONCLICK_RE.source });
              continue;
            }
            if (aim.gone) { findings.push({ kind: 'press', width: W.w, door: door.id, ...c, tags: ['GONE'], note: aim.hidden ? 'control was hidden again by the time it was reached (an earlier press closed its layer late)' : 'control vanished before it could be pressed' }); summary.counts.GONE = (summary.counts.GONE || 0) + 1; continue; }
            pageErrs.length = 0;
            let before, how = 'mouse', alive = true, timedOut = '', mid = null;
            try {
              before = await withTimeout(page.evaluate(() => window.__rrSnap()), PRESS_TIMEOUT_MS, 'snapshot');
              if (aim.covered || !aim.inView) {
                how = 'none';            // a covered or unreachable control is a finding, not a press
              } else if (c.tag !== 'SELECT') {
                await withTimeout(page.mouse.click(aim.x, aim.y), PRESS_TIMEOUT_MS, 'click');
              } else {
                how = 'programmatic';    // a <select> is "pressed" by choosing its next option
                await withTimeout(page.evaluate(i => window.__rrProgrammatic(i), c.i), PRESS_TIMEOUT_MS, 'select');
              }
              // a quick look mid-way: feedback that is deliberately brief — a
              // "Loading…" that a fast failure replaces, a spinner — is still
              // feedback the user saw (the inbox's Refresh, B2 of the sweep)
              await page.waitForTimeout(Math.min(150, SETTLE_MS));
              try { mid = await withTimeout(page.evaluate(() => { var a = document.querySelector('.page.active'); var t = a ? (a.innerText || '') : ''; var h = 5381; for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return h; }), PRESS_TIMEOUT_MS, 'mid'); } catch (e) {}
              await page.waitForTimeout(Math.max(0, SETTLE_MS - Math.min(150, SETTLE_MS)));
              // did the page reload out from under us? (KIT gone)
              alive = await withTimeout(page.evaluate(() => !!window.__rrSnap).catch(() => false), PRESS_TIMEOUT_MS, 'alive');
            } catch (e) { timedOut = e.message.slice(0, 80); }
            if (timedOut) {
              findings.push({ kind: 'press', width: W.w, door: door.id, ...c, how, tags: ['TIMEOUT'], note: 'the press never settled — ' + timedOut });
              summary.presses++; summary.counts.TIMEOUT = (summary.counts.TIMEOUT || 0) + 1; summary.reboots++;
              try { await page.screenshot({ path: path.join(OUT, (door.id + '-' + W.w + '-TIMEOUT-' + (c.id || c.handler || 'x')).replace(/[^\w.-]+/g, '_').slice(0, 80) + '.png'), timeout: 5000 }); } catch (e) {}
              await boot(); await openDoor(); base = await page.evaluate(() => window.__rrSnap());
              await page.evaluate(d => window.__rrControls(new RegExp(d.a, 'i'), new RegExp(d.b)), { a: DENY_RE.source, b: DENY_ONCLICK_RE.source });
              continue;
            }
            if (!alive) {
              findings.push({ kind: 'press', width: W.w, door: door.id, ...c, tags: ['RELOADED'], how });
              summary.presses++; summary.reboots++;
              await boot(); await openDoor(); base = await page.evaluate(() => window.__rrSnap());
              await page.evaluate(d => window.__rrControls(new RegExp(d.a, 'i'), new RegExp(d.b)), { a: DENY_RE.source, b: DENY_ONCLICK_RE.source });
              continue;
            }
            let after;
            try { after = await withTimeout(page.evaluate(() => window.__rrSnap()), PRESS_TIMEOUT_MS, 'after-snapshot'); }
            catch (e) {
              findings.push({ kind: 'press', width: W.w, door: door.id, ...c, how, tags: ['TIMEOUT'], note: 'the page stopped answering after the press — ' + e.message.slice(0, 60) });
              summary.presses++; summary.counts.TIMEOUT = (summary.counts.TIMEOUT || 0) + 1; summary.reboots++;
              await boot(); await openDoor(); base = await page.evaluate(() => window.__rrSnap());
              await page.evaluate(d => window.__rrControls(new RegExp(d.a, 'i'), new RegExp(d.b)), { a: DENY_RE.source, b: DENY_ONCLICK_RE.source });
              continue;
            }
            let cl;
            if (aim.covered) cl = { tags: ['COVERED'], gained: [], lost: [] };
            else if (!aim.inView) cl = { tags: ['OFFSCREEN'], gained: [], lost: [] };
            else {
              cl = classify(before, after, aim, pageErrs.slice());
              if (cl.tags.includes('NOTHING') && mid !== null && before && mid !== before.textHash) cl.tags = ['FLASHED'];   // brief feedback, then back to the same words
            }
            const net = NET.has(c.handler);
            if (cl.tags.includes('NOTHING') && PICKER.has(c.handler)) cl.tags = ['NATIVE-PICKER'];   // opens the OS file picker — nothing a headless browser can see; hand checklist
            const rec = { kind: 'press', width: W.w, door: door.id, ...c, how, tags: cl.tags, net, said: after.said, errors: (after.errors || []).concat(pageErrs).slice(0, 4),
                          gained: cl.gained, lost: cl.lost, covered: aim.covered ? { by: aim.hit, text: aim.hitText } : null, toActive: after.active !== before.active ? after.active : '' };
            if (cl.tags.includes('NOTHING') && c.already) rec.tags = ['ALREADY-ACTIVE'];
            findings.push(rec);
            summary.presses++;
            rec.tags.forEach(t => { summary.counts[t] = (summary.counts[t] || 0) + 1; });
            // a picture for each distinct interesting outcome
            const interesting = rec.tags.includes('NOTHING') || rec.tags.includes('COVERED') || rec.tags.includes('ERROR');
            const shotKey = door.id + '|' + c.handler + '|' + c.id;
            if (interesting && !shots.has(shotKey)) {
              shots.add(shotKey);
              const f = path.join(OUT, (door.id + '-' + W.w + '-' + (c.id || c.handler || 'x')).replace(/[^\w.-]+/g, '_').slice(0, 80) + '.png');
              try { await page.screenshot({ path: f, fullPage: false }); rec.screenshot = f; } catch (e) {}
            }
            // restore the door to its base state; reboot if it will not come back
            let now;
            try {
              await withTimeout(page.evaluate(d => window.__rrRestore(d.bl, d.bi), { bl: base.layers, bi: baseIds }), PRESS_TIMEOUT_MS, 'restore');
              if (rec.tags.includes('NAVIGATED') || rec.tags.includes('OPENED') || rec.tags.includes('CLOSED') || rec.tags.includes('CHANGED') || rec.tags.includes('ERROR')) {
                await withTimeout(page.evaluate(() => window.__rrUnhide()), PRESS_TIMEOUT_MS, 'unhide');
                await withTimeout(openDoor(), PRESS_TIMEOUT_MS * 2, 'reopen');
              }
              now = await withTimeout(page.evaluate(() => window.__rrSnap()), PRESS_TIMEOUT_MS, 'verify');
            } catch (e) {
              rec.note = 'restore timed out after this press (' + e.message.slice(0, 50) + ') — rebooted';
              summary.reboots++;
              await boot(); await openDoor(); now = await page.evaluate(() => window.__rrSnap());
            }
            const same = now.active === base.active && now.layers.join() === base.layers.join();
            if (!same) {
              summary.reboots++;
              await boot(); await openDoor();
              now = await page.evaluate(() => window.__rrSnap());
              if (now.active !== base.active) {
                findings.push({ kind: 'note', width: W.w, door: door.id, note: 'door could not be reopened after ' + c.sig + ' (active is ' + now.active + ') — remaining controls on this door skipped', tags: ['UNRESTORED'] });
                break;
              }
              if (now.layers.join() !== base.layers.join()) { rec.note = (rec.note ? rec.note + '; ' : '') + 'layers differed after a fresh boot — base re-captured'; base = now; }
            }
            // controls were re-rendered: re-index so data-rrpress points at the fresh nodes
            await page.evaluate(d => window.__rrControls(new RegExp(d.a, 'i'), new RegExp(d.b)), { a: DENY_RE.source, b: DENY_ONCLICK_RE.source });
          }
        } catch (e) {
          findings.push({ kind: 'note', width: W.w, door: door.id, note: 'CRASHED: ' + e.message.slice(0, 160), tags: ['CRASHED'] });
          try { await boot(); } catch (e2) {}
        }
      }
      summary.widths.push(W.w);
      await ctx.close();
      console.log('swept ' + W.w + 'px (' + W.label + ')');
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({ summary, deny: { text: DENY_RE.source, onclick: DENY_ONCLICK_RE.source }, findings }, null, 1));

  // ── console report ────────────────────────────────────────────────────
  console.log('\npress-audit — ' + summary.presses + ' presses across ' + summary.widths.length + ' widths; ' + summary.denied + ' controls on the deny-list never pressed; ' +
              summary.dupes + ' repeats of an already-pressed control skipped; ' + summary.disabled + ' disabled; ' + summary.reboots + ' reboots');
  console.log('never pressed (deny-list): ' + DENY_RE.source.replace(/\\b|\(\?:|\)/g, '').slice(0, 300));
  const behindTotal = findings.filter(f => f.kind === 'door').reduce((a, d) => a + (d.behind || 0), 0);
  if (behindTotal) console.log('behind an open overlay, not pressed (a modal is meant to cover the page): ' + behindTotal);
  const pickers = findings.filter(f => f.kind === 'press' && f.tags.includes('NATIVE-PICKER'));
  if (pickers.length) console.log('opened the OS file picker (nothing a headless browser can see — on the hand checklist): ' + [...new Set(pickers.map(f => f.handler + ' "' + f.text.slice(0, 24) + '"'))].join(', '));
  console.log('\noutcomes:');
  Object.keys(summary.counts).sort((a, b) => summary.counts[b] - summary.counts[a]).forEach(k => console.log('  ' + k.padEnd(16) + summary.counts[k]));
  const nothing = findings.filter(f => f.kind === 'press' && f.tags.includes('NOTHING'));
  const byHandler = {};
  nothing.forEach(f => { const k = (f.handler || '?') + (f.id ? ' #' + f.id : '') + (f.text ? ' "' + f.text.slice(0, 30) + '"' : ''); (byHandler[k] = byHandler[k] || []).push(f); });
  console.log('\n── NOTHING (' + nothing.length + ' presses, ' + Object.keys(byHandler).length + ' distinct) — the finding class ──');
  Object.keys(byHandler).sort().forEach(k => {
    const L = byHandler[k];
    const where = [...new Set(L.map(f => f.door + '@' + f.width))].join(', ');
    console.log('  ' + (L[0].net ? '[NET] ' : '      ') + k.slice(0, 70).padEnd(72) + where.slice(0, 90));
  });
  const hung = findings.filter(f => f.kind === 'press' && f.tags.includes('TIMEOUT'));
  if (hung.length) {
    console.log('\n── TIMEOUT (' + hung.length + ') — the press FROZE the page (the renderer had to be thrown away) ──');
    hung.forEach(f => console.log('  ' + f.door + '@' + f.width + '  ' + f.sig + ' "' + (f.text || '').slice(0, 30) + '" (' + f.handler + ')  ' + (f.note || '')));
  }
  const covered = findings.filter(f => f.kind === 'press' && f.tags.includes('COVERED'));
  if (covered.length) {
    console.log('\n── COVERED (' + covered.length + ') — a tap lands on something else ──');
    covered.slice(0, 40).forEach(f => console.log('  ' + f.door + '@' + f.width + '  ' + f.sig + ' "' + f.text.slice(0, 30) + '"  under ' + f.covered.by + (f.covered.text ? ' "' + f.covered.text + '"' : '')));
  }
  const reacted = findings.filter(f => f.kind === 'press' && f.tags.includes('REACTED'));
  if (reacted.length) {
    console.log('\n── REACTED (' + reacted.length + ') — the DOM changed but nothing a text hash sees; worth a glance ──');
    const byH = {}; reacted.forEach(f => { const k = (f.handler || '?') + ' "' + f.text.slice(0, 30) + '"'; (byH[k] = byH[k] || []).push(f.door + '@' + f.width); });
    Object.keys(byH).sort().forEach(k => console.log('  ' + k.padEnd(60) + [...new Set(byH[k])].join(', ').slice(0, 90)));
  }
  const off = findings.filter(f => f.kind === 'press' && f.tags.includes('OFFSCREEN'));
  if (off.length) {
    console.log('\n── OFFSCREEN (' + off.length + ') — counted as visible but cannot be scrolled into the viewport (slid off, or clipped) ──');
    off.slice(0, 30).forEach(f => console.log('  ' + f.door + '@' + f.width + '  ' + f.sig + ' "' + f.text.slice(0, 30) + '"'));
  }
  const errs = findings.filter(f => f.kind === 'press' && f.tags.includes('ERROR'));
  if (errs.length) {
    console.log('\n── ERROR (' + errs.length + ') ──');
    errs.slice(0, 40).forEach(f => console.log('  ' + f.door + '@' + f.width + '  ' + f.sig + ' "' + f.text.slice(0, 30) + '"  ' + (f.errors || []).join(' | ').slice(0, 120)));
  }
  const notes = findings.filter(f => f.kind === 'note');
  if (notes.length) { console.log('\n── notes ──'); notes.forEach(n => console.log('  ' + n.door + '@' + n.width + '  ' + n.note)); }
  const unshown = findings.filter(f => f.kind === 'door' && f.shown === false);
  if (unshown.length) { console.log('\n── doors that did not open ──'); unshown.forEach(d => console.log('  ' + d.door + '@' + d.width + '  active was ' + d.active)); }
  console.log('\n' + (booted === WIDTHS.length ? 'AUDIT COMPLETE' : 'AUDIT INCOMPLETE — boot failures') + '  —  report: ' + path.join(OUT, 'findings.json'));
  process.exit(booted === WIDTHS.length ? 0 : 1);
})();
