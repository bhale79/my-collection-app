// Headless checks for v0.9.1057 inbox work.
// Loads photo-inbox.js inside a stubbed browser and drives the real functions.
const fs = require('fs');
const SRC = require('path').join(__dirname, '..', 'app', 'photo-inbox.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── minimal DOM ───────────────────────────────────────────────────────────
function mkEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: (function () {
      const st = { _cssText: '', display: '' };
      Object.defineProperty(st, 'cssText', {
        get() { return this._cssText; },
        set(v) {
          this._cssText = String(v);
          const m = /(?:^|;)\s*display\s*:\s*([^;]+)/.exec(this._cssText);
          this.display = m ? m[1].trim() : '';
        },
      });
      return st;
    })(),
    children: [], _html: '', id: '', className: '', attrs: {}, textContent: '',
    set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    remove() { if (this.parent) this.parent.removeChild(this); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; }, click() {},
  };
  return el;
}
const REG = {};
global.document = {
  _els: REG,
  getElementById: id => REG[id] || null,
  createElement: mkEl,
  addEventListener() {},
  body: mkEl('body'),
  querySelectorAll: () => [],
};
function reg(id) { const e = mkEl('div'); e.id = id; REG[id] = e; return e; }
['pin-context-bar','pin-tagbar','pin-filter-row','pin-grid','pin-empty','pin-count',
 'pin-selinfo','pin-selall-btn','pin-idall-btn','pin-idsel-btn','pin-assign-btn',
 'pin-groupas-btn','pin-discard-btn','pin-group-btn','pin-tag-btn','pin-finish-btn',
 'pin-apply-btn','pin-recrop-btn','pin-status','page-photo-inbox','pin-drop'].forEach(reg);

global.window = global;
global.navigator = { userAgent: 'node', maxTouchPoints: 0 };
global.localStorage = { _d: {}, getItem(k){return this._d[k]===undefined?null:this._d[k];},
  setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
global.rrEsc = v => (v == null ? '' : String(v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
global.TOASTS = [];
global.showToast = (m, d, bad) => { TOASTS.push({ m: String(m), bad: !!bad }); };
global.ERAS = {
  all: { label: 'All' },
  pw:  { label: 'Lionel Post-War', manufacturer: 'Lionel', years: '1945-1969' },
  prw: { label: 'Lionel Pre-War',  manufacturer: 'Lionel', years: '1901-1942' },
  mod: { label: 'Lionel Modern',   manufacturer: 'Lionel', years: '1970-' },
  mth_ho: { label: 'MTH Modern',   manufacturer: 'MTH',    years: '1990-' },
};
global.ERA_SCALE = { pw: 'O', prw: 'O', mod: 'O', mth_ho: 'HO' };
// v0.9.1157: photo-inbox now asks config.js's ONE resolver what the user is
// filtered to (see §130), so the harness loads the REAL resolver rather than a
// hand-written imitation of it — an imitation is exactly how a harness starts
// passing while the app is broken. No _currentEra and no _phState here, which
// is what an untagged photo in an unfiltered app looks like: no constraint.
(function () {
  const cfgAll = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'config.js'), 'utf8');
  const a = cfgAll.indexOf('var _RR_CHIP_SCALE_LABEL');
  const b = cfgAll.indexOf('// ── Keys that hold browseable');
  if (a < 0 || b < 0) throw new Error('harness: the config.js filter block moved');
  new Function(cfgAll.slice(a, b)).call(global);
})();
global.driveRequest = async () => ({});
global.driveEnsureSetup = async () => {};
global.driveFindOrCreateFolder = async () => 'fid';
global.driveCache = { vaultId: 'v' };
global.loadDriveThumb = () => {};
global.state = { personalData: {} };

// capture Drive metadata writes
global.META_WRITES = [];

let src = fs.readFileSync(SRC, 'utf8');
// stub the one network call the tag path makes
src = src.replace(
  /async function _pinMetaSet\(fileId, patch\) \{/,
  'async function _pinMetaSet(fileId, patch) { META_WRITES.push({ fileId: fileId, patch: patch }); return !global.__FAIL_META || fileId !== global.__FAIL_META; } async function _unused_pinMetaSet(fileId, patch) {'
);
// expose internals for the harness
const HOOK = '\n;window.__T = { get groups(){return _groups;}, set groups(v){_groups=v;},'
     + ' get sel(){return _sel;}, set sel(v){_sel=v;},'
     + ' get selectMode(){return _selectMode;}, get purpose(){return _selPurpose;},'
     + ' get session(){return _pinSession;}, set session(v){_pinSession=v;},'
     + ' get sessionEra(){return _sessionEra;}, get oneShot(){return _pinOneShot;},'
     + ' set oneShot(v){_pinOneShot=v;}, get tagEra(){return _tagEra;}, set tagEra(v){_tagEra=v;},'
     + ' get rvKey(){return _rvKey;}, set rvKey(v){_rvKey=v;},'
     + ' setHome:function(e){_pinSetHomeEra(e);}, renderBar:function(){_pinRenderBar();},'
     + ' renderTagBar:function(){_pinRenderTagBar();}, selInfo:function(){_selInfo();},'
     + ' navHtml:function(d){return _pinRvNavHtml(d);}, posHtml:function(){return _pinRvPosHtml();},'
     + ' filter:function(f){ Object.assign(window._pinFilterState(), f); } };'
     + '\n;window.__MetaOf=_pinMetaOf;window.__CroppedGroups=_pinCroppedGroups;'
     + '\n;window.__NumFromText=_numberFromText;window.__PreferOf=_pinPreferOf;'
     + '\n;window.__BestMaster=_pinBestMaster;window.__Lookup=_pinLookup;'
     + '\n;window.__DescMatch=_pinDescMatch;'
     + '\n;window.__Reconcile=_pinReconcileAiNum;'
     + '\n;window.__ApplyMeta=_pinApplyMeta;window.__RepairStored=_pinReconcileStored;'
     + '\n;window.__QuoteMatch=_pinQuoteMatch;window.__FilesToRead=_pinFilesToRead;'
     + '\n;window.__ColorWords=_pinColorWords;window.__ColorClash=_pinColorClash;'
     + '\n;window.__setConfirm=function(fn){_pinConfirm=fn;};window.__Confirm=_pinConfirm;'
     + '\n;window.__ReadFiles=_pinReadFiles;window.__ReadFid=_pinReadFid;'
     + '\n;window.__DescArbitrate=_pinDescArbitrate;window.__IsSetRow=_pinIsSetRow;'
     + '\n;window.__ReconcileStored=_pinReconcileStored;';
const cut = src.lastIndexOf('})();');
if (cut < 0) { console.log('could not find IIFE end'); process.exit(2); }
src = src.slice(0, cut) + HOOK + '\n' + src.slice(cut);
eval(src);

const T = window.__T;
// _render / _pinRefresh touch Drive; neuter them for the harness
window._pinRefresh = async () => {};
const _origRender = null;

function mkGroups(n) {
  const gs = [];
  for (let i = 0; i < n; i++) {
    gs.push({ key: 'g' + i, files: [{ id: 'f' + i + 'a', name: 'INBOX 1 p.jpg', createdTime: '2026-07-26' }] });
  }
  return gs;
}

// ══════════════════════════════════════════════════════════════════════════
section('1. Shooting session controls the bar');
T.session = false;
T.renderBar();
ok('bar hidden when no session', REG['pin-context-bar'].style.display === 'none');

T.session = true;
T.setHome('pw');
T.renderBar();
ok('bar shows during a session', REG['pin-context-bar'].style.display !== 'none');
ok('bar names the era', REG['pin-context-bar'].innerHTML.indexOf('Lionel Post-War') >= 0);
ok('bar offers Done', REG['pin-context-bar'].innerHTML.indexOf('_pinEndSession') >= 0);

window._pinEndSession();
ok('Done clears the session', T.session === false);
ok('Done clears the era', T.sessionEra === '');
ok('Done clears any one-shot', T.oneShot === null);
T.renderBar();
ok('bar hidden again after Done', REG['pin-context-bar'].style.display === 'none');

section('2. Era does not survive a restart');
T.session = true; T.setHome('pw');
ok('home era is memory only, not localStorage',
   localStorage.getItem('rr_capture_home_era') === null,
   'found ' + localStorage.getItem('rr_capture_home_era'));

section('3. One-shot springs back to home');
T.setHome('pw');
T.oneShot = 'mod';
ok('active era is the one-shot', T.oneShot === 'mod');
window._pinClearOneShot();
ok('after clearing, back to home', T.oneShot === null && T.sessionEra === 'pw');
window._pinEndSession();

section('4. Two named modes, one mechanic');
T.groups = mkGroups(5);
window._pinStartMode('group');
ok('group mode on', T.selectMode === true && T.purpose === 'group');
window._pinStartMode('tag');
ok('switching to tag swaps purpose', T.purpose === 'tag');
ok('switching clears the ticks', Object.keys(T.sel).length === 0);
window._pinStartMode('tag');
ok('tapping the same button again finishes', T.selectMode === false && T.purpose === '');

section('5. Select all follows the filter');
// three photos already stamped with an era, three untouched
T.groups = mkGroups(6).map(function (g, i) {
  if (i < 3) g.files[0]._meta = { era: 'pw' };
  return g;
});
window._pinCloseModeNow();
window._pinStartMode('tag');
window._pinClearFilters();
T.sel = {};
window._pinSelectAll();
ok('select all with no filter takes everything', Object.keys(T.sel).length === 6,
   'got ' + Object.keys(T.sel).length);

window._pinSetFilter('status', 'new');          // only the three untouched ones
const visN = window._pinVisibleGroups().length;
ok('filter narrows the list to 3', visN === 3, 'visible ' + visN);
T.sel = {};
window._pinSelectAll();
const n5 = Object.keys(T.sel).length;
ok('select all takes only what the filter shows', n5 === 3, 'got ' + n5);
ok('and takes exactly the visible ones',
   window._pinVisibleGroups().every(g => T.sel[g.key]));
window._pinClearFilters();

section('6. Tag mode writes era to every file in every ticked group');
T.groups = [
  { key: 'a', files: [{ id: 'a1' }, { id: 'a2' }] },   // an engine + tender
  { key: 'b', files: [{ id: 'b1' }] },
  { key: 'c', files: [{ id: 'c1' }] },
];
window._pinCloseModeNow();
window._pinStartMode('tag');
T.sel = { a: true, b: true };
T.tagEra = 'pw';
META_WRITES.length = 0; TOASTS.length = 0;
(async () => {
  await window._pinApplyTags();

  const ids = META_WRITES.map(w => w.fileId).sort();
  ok('every file of a ticked group is written', JSON.stringify(ids) === JSON.stringify(['a1','a2','b1']),
     JSON.stringify(ids));
  ok('untouched group is left alone', ids.indexOf('c1') < 0);
  ok('era is what was picked', META_WRITES.every(w => w.patch.era === 'pw'));
  ok('status moves to stamped', META_WRITES.every(w => w.patch.stat === 'stamped'));
  ok('ticks clear after apply', Object.keys(T.sel).length === 0);
  ok('still in tag mode for the next batch', T.purpose === 'tag');
  ok('success toast names the count and era',
     TOASTS.some(t => /Tagged 3 photos as Lionel Post-War/.test(t.m)), JSON.stringify(TOASTS));

  section('7. A partial failure is reported as a failure');
  T.sel = { a: true, b: true };
  T.tagEra = 'mod';
  META_WRITES.length = 0; TOASTS.length = 0;
  global.__FAIL_META = 'a2';
  await window._pinApplyTags();
  ok('partial write warns, does not claim success',
     TOASTS.some(t => t.bad && /Tagged 2 of 3/.test(t.m)), JSON.stringify(TOASTS));
  global.__FAIL_META = null;

  section('8. Tag bar refuses to apply with nothing chosen');
  T.tagEra = '';
  T.sel = { a: true };
  META_WRITES.length = 0; TOASTS.length = 0;
  await window._pinApplyTags();
  ok('no writes without an era', META_WRITES.length === 0);
  ok('and it says why', TOASTS.some(t => t.bad && /manufacturer/i.test(t.m)));

  section('9. Tag bar warns about overwriting');
  T.groups = [{ key: 'a', files: [{ id: 'a1', name: 'INBOX 1 p.jpg' }] }];
  T.sel = { a: true };
  T.tagEra = 'pw';
  window._pinCloseModeNow();
  window._pinStartMode('tag'); T.sel = { a: true }; T.tagEra = 'pw';
  T.renderTagBar();
  const bar = REG['pin-tagbar'].innerHTML;
  ok('tag bar renders in tag mode', REG['pin-tagbar'].style.display !== 'none');
  ok('Apply moved to the toolbar and names the count',
     REG['pin-apply-btn'].textContent === 'Apply to 1',
     'toolbar apply reads "' + REG['pin-apply-btn'].textContent + '"');
  ok('Apply is visible in tag mode', REG['pin-apply-btn'].style.display !== 'none');
  ok('the tag bar itself no longer carries Apply', !/Apply to/.test(bar));

  section('10. Prev / next through the visible list');
  T.groups = mkGroups(4);
  window._pinCloseModeNow();
  T.rvKey = 'g0';
  ok('at the start, prev is disabled', /disabled/.test(T.navHtml('prev')));
  ok('at the start, next is live', !/disabled/.test(T.navHtml('next')));
  ok('position reads 1 of 4', /1 of 4/.test(T.posHtml()), T.posHtml());
  T.rvKey = 'g3';
  ok('at the end, next is disabled', /disabled/.test(T.navHtml('next')));
  ok('at the end, prev is live', !/disabled/.test(T.navHtml('prev')));
  ok('position reads 4 of 4', /4 of 4/.test(T.posHtml()));

  let opened = [];
  const realReview = window._pinReview;
  window._pinReview = k => { opened.push(k); T.rvKey = k; };
  T.rvKey = 'g1';
  window._pinReviewStep(1);
  ok('next opens the following group', opened[opened.length - 1] === 'g2', JSON.stringify(opened));
  window._pinReviewStep(-1);
  ok('prev opens the preceding group', opened[opened.length - 1] === 'g1');
  T.rvKey = 'g3'; opened = [];
  window._pinReviewStep(1);
  ok('next at the end does nothing (no wrap)', opened.length === 0, JSON.stringify(opened));
  T.rvKey = 'g0'; opened = [];
  window._pinReviewStep(-1);
  ok('prev at the start does nothing', opened.length === 0);
  T.rvKey = '';
  ok('multi-select card shows no arrows', T.navHtml('prev') === '' && T.navHtml('next') === '');
  window._pinReview = realReview;

  section('11. Ungroup only where it makes sense');
  ok('_pinUngroup exists', typeof window._pinUngroup === 'function');
  ok('_pinConfirmUngroup exists', typeof window._pinConfirmUngroup === 'function');

  section('12. Old entry point still works');
  window._pinCloseModeNow();
  window._pinToggleSelectMode();
  ok('legacy toggle enters group mode', T.purpose === 'group');
  window._pinToggleSelectMode();
  ok('legacy toggle leaves', T.selectMode === false);


  section('13. v0.9.1058 — metadata actually round-trips');
  // Drive returns only requested fields. Prove appProperties is now requested.
  const srcTxt = require('fs').readFileSync(SRC, 'utf8');
  ok('Drive listing asks for appProperties',
     // v0.9.1131 paginated this call, so the fields list now leads with nextPageToken
     /fields=nextPageToken,files\(id,name,createdTime,appProperties\)/.test(srcTxt));
  ok('_pinMetaOf reads era back off a file',
     window.__T && (function () {
       const f = { id: 'x', appProperties: { rrEra: 'pw', rrKind: 'aba', rrRole: 'p' } };
       const m = window.__MetaOf(f);
       return m.era === 'pw' && m.kind === 'aba' && m.role === 'p';
     })());

  section('14. Re-read cropped targets the cropped set');
  ok('_pinReadCropped exists', typeof window._pinReadCropped === 'function');
  localStorage.setItem('rr_inbox_cropped', JSON.stringify({ c1: 1, c3: 1 }));
  T.groups = [
    { key: 'k1', files: [{ id: 'c1' }] },
    { key: 'k2', files: [{ id: 'c2' }] },
    { key: 'k3', files: [{ id: 'c3' }] },
  ];
  const cg = window.__CroppedGroups().map(g => g.key);
  ok('only the cropped photos are picked up',
     JSON.stringify(cg) === JSON.stringify(['k1', 'k3']), JSON.stringify(cg));
  localStorage.setItem('rr_inbox_cropped', '{}');
  ok('nothing cropped -> empty set', window.__CroppedGroups().length === 0);


  section('15. Nothing automatic ever spends a token');
  const body = require('fs').readFileSync(SRC, 'utf8');
  // Exact function body by brace matching, so the check cannot bleed into the
  // next function and report a neighbour's call as this one's.
  function fnBody(sig) {
    const i = body.indexOf(sig);
    if (i < 0) return '';
    let j = body.indexOf('{', i), d = 0;
    if (j < 0) return '';
    for (let k = j; k < body.length; k++) {
      if (body[k] === '{') d++;
      else if (body[k] === '}') { d--; if (d === 0) return body.slice(i, k + 1); }
    }
    return body.slice(i);
  }
  const auto = fnBody('async function _pinAutoRead()');
  ok('the automatic pass exists', auto.length > 0);
  ok('automatic pass never calls the paid reader', !/aiIdentifyImage/.test(auto));
  ok('automatic pass uses the free reader', /_freeReadOne|_freeReadBlob/.test(auto));

  const reread = fnBody('window._pinReadCropped = async function');
  // The upper bound is only a sanity check that fnBody() grabbed one function
  // and not the rest of the file. Raised from 4000 in v0.9.1135, when the
  // try/finally that guarantees _busy is released was added.
  ok('re-read cropped body extracted', reread.length > 200 && reread.length < 6000,
     'len ' + reread.length);
  ok('re-read cropped never calls the paid reader', !/aiIdentifyImage/.test(reread));
  ok('re-read cropped uses the free reader at high res', /_freeReadBlob\(blob, 2400,/.test(reread));
  ok('re-read cropped passes the era hint too', /_freeReadBlob\(blob, 2400, _pinPreferOf/.test(reread));
  ok('re-read button says free, not tokens', /cropped \(free\)/.test(body));

  // Which functions can reach the paid reader at all?
  const PAID_OWNERS = ['_pinProcessShot', '_pinReviewIdentify', '_pinIdentifySelected', '_pinIdentifyAll'];
  const owners = [];
  PAID_OWNERS.forEach(function (nm) {
    const sigs = ['async function ' + nm + '(', 'window.' + nm + ' = async function'];
    for (const sg of sigs) {
      const b = fnBody(sg);
      if (b && /aiIdentifyImage/.test(b)) { owners.push(nm); break; }
    }
  });
  ok('only known, explicitly-triggered functions reach the paid reader',
     owners.length >= 2, 'owners: ' + owners.join(', '));
  // and every one of them is behind a button the user presses
  ok('the free auto pass is what runs after an upload',
     /setTimeout\(function \(\) \{ try \{ _pinAutoRead\(\); \}/.test(body));


  section('16. Finished warns when nothing was applied');
  ok('_pinCloseModeNow exists for a silent reset', typeof window._pinCloseModeNow === 'function');
  T.groups = [{ key: 'z1', files: [{ id: 'z1a' }, { id: 'z1b' }] }];
  window._pinCloseModeNow();
  window._pinStartMode('tag');
  T.sel = {};
  let prompted = false;
  const realConfirm = window.__Confirm;
  window.__setConfirm(function (msg) { prompted = true; window.__lastConfirm = msg; return Promise.resolve(true); });
  await window._pinFinishMode();
  ok('no ticks -> no warning', prompted === false);

  window._pinStartMode('tag');
  T.sel = { z1: true };
  prompted = false;
  window.__setConfirm(function (msg) { prompted = true; window.__lastConfirm = msg; return Promise.resolve(false); });
  await window._pinFinishMode();
  ok('ticks left unapplied -> warns', prompted === true);
  ok('warning counts the photos, not the groups',
     /2 photos are still selected/.test(window.__lastConfirm || ''), window.__lastConfirm);
  ok('warning says Apply is what saves', /Pressing Apply is what saves/.test(window.__lastConfirm || ''));
  ok('declining keeps you in the mode with ticks intact',
     T.purpose === 'tag' && Object.keys(T.sel).length === 1);

  window.__setConfirm(function () { return Promise.resolve(true); });
  await window._pinFinishMode();
  ok('accepting leaves the mode', T.purpose === '' && Object.keys(T.sel).length === 0);
  window.__setConfirm(realConfirm);

  section('17. Apply sits beside Finished');
  const body2 = require('fs').readFileSync(SRC, 'utf8');
  const ai = body2.indexOf('id="pin-apply-btn"');
  const fi = body2.indexOf('id="pin-finish-btn"');
  ok('apply button exists in the toolbar', ai > 0);
  ok('apply is rendered immediately before finished', ai < fi && (fi - ai) < 400,
     'gap ' + (fi - ai));
  ok('era no longer collides with the group chip at top-right',
     !/top:6px;right:6px[^']*_pinEraLabel/.test(body2));


  section('18. The "together" shot is never the one we read');
  const G_ABA = { key: 'aba1', files: [
    { id: 'together', _meta: { role: 'together', kind: 'aba' } },   // deliberately FIRST
    { id: 'powered',  _meta: { role: 'p',        kind: 'aba' } },
    { id: 'bunit',    _meta: { role: 'b',        kind: 'aba' } },
    { id: 'dummy',    _meta: { role: 'd',        kind: 'aba' } },
  ] };
  ok('a set shot first in the list is not the read target',
     window.__ReadFid(G_ABA) === 'powered', 'got ' + window.__ReadFid(G_ABA));
  ok('every individual unit is still readable',
     JSON.stringify(window.__ReadFiles(G_ABA).map(f => f.id)) ===
     JSON.stringify(['powered', 'bunit', 'dummy']));
  ok('the together shot is excluded from the batch',
     window.__ReadFiles(G_ABA).every(f => f.id !== 'together'));

  const G_TENDER = { key: 't1', files: [
    { id: 'engine', _meta: { role: 'engine', kind: 'tender' } },
    { id: 'tender', _meta: { role: 'tender', kind: 'tender' } },
    { id: 'both',   _meta: { role: 'together', kind: 'tender' } },
  ] };
  ok('engine+tender drops the both-together shot',
     JSON.stringify(window.__ReadFiles(G_TENDER).map(f => f.id)) ===
     JSON.stringify(['engine', 'tender']));

  const G_SET = { key: 's1', files: [
    { id: 'whole', _meta: { role: 'together', kind: 'set' } },
    { id: 'car1',  _meta: { role: 'member',   kind: 'set' } },
    { id: 'car2',  _meta: { role: 'member',   kind: 'set' } },
  ] };
  ok('a set reads its pieces, not the whole-set photo',
     window.__ReadFid(G_SET) === 'car1');

  const G_BOX = { key: 'b1', files: [
    { id: 'item', _meta: { role: 'item', kind: 'box' } },
    { id: 'box',  _meta: { role: 'box',  kind: 'box' } },
  ] };
  ok('a box photo is still read (the number is often on the box)',
     window.__ReadFiles(G_BOX).length === 2);

  const G_ONLY = { key: 'o1', files: [{ id: 'only', _meta: { role: 'together', kind: 'set' } }] };
  ok('a group of nothing but together shots is not made unreadable',
     window.__ReadFid(G_ONLY) === 'only');

  const G_PLAIN = { key: 'p1', files: [{ id: 'p1a' }, { id: 'p1b' }] };
  ok('ungrouped photos are unaffected', window.__ReadFid(G_PLAIN) === 'p1a');
  ok('no _meta at all does not throw', window.__ReadFiles(G_PLAIN).length === 2);

  const body3 = require('fs').readFileSync(SRC, 'utf8');
  ok('no read path still hardcodes files[0]',
     !/var todo = _groups\.filter\(function \(g\) \{ return !ids\[g\.files\[0\]\.id\]/.test(body3));


  section('19. Cancel from an inbox add returns to the inbox');
  const body4 = require('fs').readFileSync(SRC, 'utf8');
  ok('an inbox add states its return page outright',
     /else wizard\.data\._returnPage = 'photo-inbox';/.test(body4));
  ok('For Sale still keeps its own destination',
     /_returnPage = wizard\.data\._returnPage \|\| 'forsale'/.test(body4));
  // the two must be exclusive: forsale branch, else inbox
  const seg = body4.slice(body4.indexOf('alsoListForSale = true'), body4.indexOf('alsoListForSale = true') + 900);
  ok('the inbox default is the else of the For Sale branch',
     seg.indexOf("else wizard.data._returnPage = 'photo-inbox';") > 0);


  section('20. Two-digit numbers, but only with catalog backing');
  // stub the catalog: 58 and 2410 are real, 26 and 210 are not (for this test)
  const REAL = { '58': { itemNum: '58', _tab: 'Lionel PW - Items' },
                 '2410': { itemNum: '2410', _tab: 'Lionel PW - Items' },
                 '2348': { itemNum: '2348', _tab: 'Lionel PW - Items' } };
  global.findMaster = (num) => REAL[String(num)] || null;

  let r = window.__NumFromText('GREAT NORTHERN RAILWAY 58');
  ok('a bare two-digit number needs corroboration now', !r || !r.num, JSON.stringify(r));
  // v0.9.1065 deliberately reversed this: a two-digit read is a lead, not a fact.
  ok('and it is offered as a guess, not stated as fact', r && r.matched === false);

  r = window.__NumFromText('4-6-4 26 WHEELS');
  ok('an unbacked two-digit token is still rejected',
     !r || r.num !== '26', JSON.stringify(r));

  // v0.9.1076c: a match needs some text around it. Short input still OFFERS the
  // number, it just stops calling it confirmed — so this assertion split in two.
  r = window.__NumFromText('SANTA FE 2410');
  ok('ordinary long numbers are still found', r && r.num === '2410');
  ok('but four words is not enough to call it confirmed', r && r.matched === false);
  r = window.__NumFromText('SANTA FE 2410 PULLMAN OBSERVATION CAR LIONEL LINES BUILT 1952');
  ok('with real context around it, it is confirmed', r && r.num === '2410' && r.matched === true);

  r = window.__NumFromText('MINNEAPOLIS & ST LOUIS 2348');
  ok('the one that already worked still works', r && r.num === '2348');

  section('21. The era stamp reaches the catalog lookup');
  let sawPrefer = null;
  global.findMaster = (num, variation, prefer) => { sawPrefer = prefer; return REAL[String(num)] || null; };
  window.__NumFromText('SANTA FE 2410', { era: 'pw', manufacturer: 'Lionel' });
  ok('findMaster receives the era hint',
     sawPrefer && sawPrefer.era === 'pw' && sawPrefer.manufacturer === 'Lionel',
     JSON.stringify(sawPrefer));

  sawPrefer = null;
  window.__NumFromText('SANTA FE 2410');
  ok('no stamp -> no hint, old behaviour', sawPrefer === null || sawPrefer === undefined);

  ok('a stamped group produces a prefer object',
     (function () {
       const g = { key: 'g', files: [{ id: 'a', _meta: { era: 'pw', role: 'p' } }] };
       const p = window.__PreferOf(g);
       return p && p.era === 'pw' && p.manufacturer === 'Lionel';
     })());
  ok('an unstamped group produces none',
     window.__PreferOf({ key: 'g', files: [{ id: 'a' }] }) === null);

  const body5 = require('fs').readFileSync(SRC, 'utf8');
  // v0.9.1101: the auto pass escalates, so it reads twice — both with the hint.
  ok('every free-read path passes the era hint',
     (body5.match(/_freeReadBlob\(blob, ?\d+, ?_p/g) || []).length >= 2 &&
     /_freeReadBlob\(bytes, 1600, pref\)/.test(body5) &&
     /_freeReadBlob\(bytes, 2400, pref\)/.test(body5) &&
     /var pref = _preferForFid\(fileId\)/.test(body5));
  ok('the audit exists and is free', /_pinReaderAudit/.test(body5) && /No credits are used/.test(body5));


  section('22. The audit survives a reload');
  const inbox = require('fs').readFileSync(SRC, 'utf8');
  ok('progress is saved after every photo',
     /_auditSave\(\{ ts: Date\.now\(\), rows: rows/.test(inbox) &&
     inbox.split('_auditSave(').length - 1 >= 3, 'save call sites');
  ok('a re-run skips what is already done', /if \(!fid \|\| seen\[fid\]\) continue;/.test(inbox));
  ok('the tally is recomputed from the rows, never trusted from storage',
     /function _retally\(\)/.test(inbox));
  ok('a long job blocks the deploy reload', /window\._rrLongJob = true;/.test(inbox) &&
     /window\._rrLongJob = false;/.test(inbox));
  ok('the report says when it is partial', /Partial \\u2014 run it again/.test(inbox));
  ok('saved results can be reopened without re-running',
     /_pinAuditShowSaved/.test(inbox));
  ok('and thrown away deliberately', /_pinAuditClear/.test(inbox));

  const html = require('fs').readFileSync('/root/repo/app/index.html', 'utf8');
  ok('the busy guard knows about the audit overlay', /pin-audit-ov/.test(html));
  ok('the busy guard knows about long jobs', /_rrLongJob/.test(html));
  ok('a deploy reload remembers the page', /sessionStorage\.setItem\('rr_resume_page'/.test(html));
  ok('and restores it on the way back', /getItem\('rr_resume_page'\)/.test(html));
  ok('a genuinely fresh visit still opens on the Dashboard',
     /if \(!want \|\| want === 'dashboard'\) return;/.test(html));


  section('23. Acting on the audit');
  global.findMaster = (num) => ({
    '58':1,'2410':1,'2348':1,'5-54':1,'1-48':1,'13':1,'25':1,'6464-475':1,'6017':1
  })[String(num)] ? { itemNum: String(num) } : null;

  let q = window.__NumFromText('PENNSYLVANIA BLT 5-54 CAPY 100000');
  ok('a build date is never an item number', !q || q.num !== '5-54', JSON.stringify(q));
  q = window.__NumFromText('BLT 1-48');
  ok('and neither is 1-48', !q || q.num !== '1-48', JSON.stringify(q));

  // v0.9.1080 changed this on purpose: a bare two-digit number is dropped
  // entirely now, because with thousands of catalog numbers almost any stray
  // pair lands on one. It needs the maker's name beside it, or a description.
  q = window.__NumFromText('GREAT NORTHERN 58');
  ok('a bare two-digit number is no longer offered', !q || !q.num, JSON.stringify(q));
  ok('and the reasoning says what it dropped',
     q && q.dbg && (q.dbg.shortDropped || []).indexOf('58') >= 0, JSON.stringify(q && q.dbg));
  q = window.__NumFromText('GREAT NORTHERN BLT BY LIONEL 58');
  ok('with the maker beside it, the same number is read', q && q.num === '58', JSON.stringify(q));

  q = window.__NumFromText('LIONEL 6017 BLT 5-54');
  ok('a real number beats the build date beside it', q && q.num === '6017' && q.matched);

  q = window.__NumFromText('LIONEL 6464475 NEW HAVEN');
  ok('a dropped dash is repaired against the catalog',
     q && q.num === '6464-475' && q.matched, JSON.stringify(q));

  q = window.__NumFromText('LIONEL 9999999 NOTHING');
  ok('repair never invents a number the catalog rejects',
     !q || q.matched === false, JSON.stringify(q));

  const b6 = require('fs').readFileSync(SRC, 'utf8');
  ok('block mode is now the shipping default', /tessedit_pageseg_mode: '6',/.test(b6));
  ok('the free reader got the winning preprocessing', /_stretchCanvas\(c\)/.test(b6));
  ok('round 2 tests inversion', /id: 'inv6'/.test(b6));
  ok('round 2 tests digits-only', /id: 'digits6'/.test(b6));
  ok('round 2 tests tiling', /id: 'tile6'/.test(b6) && /_auditTile/.test(b6));
  ok('the audit restores the shipping settings when it finishes',
     /tessedit_pageseg_mode: '6',\s*\n\s*tessedit_char_whitelist/.test(b6));


  section('24. The photo\'s era decides which catalog row wins');
  // One number, three catalogs — exactly Brad's 58 (prewar lamp post vs a
  // postwar item) and his 8359 (Lionel MPC vs Atlas).
  const BUCKET = [
    { itemNum: '58', _era: 'prw', _tab: 'Lionel PreWar - Items', description: 'Lamp Post, 7 3/8 high' },
    { itemNum: '58', _era: 'pw',  _tab: 'Lionel PW - Items',     description: 'Great Northern rotary snowplow' },
    { itemNum: '58', _era: 'atlas', _tab: 'Atlas O - Items',     description: 'Something Atlas' },
  ];
  global.window._mbAllGet = () => BUCKET;
  global.state = { personalData: {} };
  global.rrFindOwnedCopy = () => null;

  let m = window.__BestMaster('58', '', null);
  ok('with no hint at all it is still load order (unchanged)', m._era === 'prw');

  m = window.__BestMaster('58', '', { era: 'pw', manufacturer: 'Lionel' });
  ok('a postwar-stamped photo gets the POSTWAR row', m._era === 'pw', m && m._era);
  ok('and therefore the right description', /snowplow/.test(m.description));

  m = window.__BestMaster('58', '', { era: 'atlas', manufacturer: 'Atlas' });
  ok('an Atlas-stamped photo gets the Atlas row', m._era === 'atlas');

  m = window.__BestMaster('58', 'Lionel', { era: 'atlas', manufacturer: 'Atlas' });
  ok('what the reader actually saw still outranks the stamp', m._era === 'prw' || m._era === 'pw');

  m = window.__BestMaster('58', '', { manufacturer: 'Atlas' });
  ok('maker alone is enough when the era is unknown', m._era === 'atlas');

  const lk = window.__Lookup('58', '', { era: 'pw', manufacturer: 'Lionel' });
  ok('the review card lookup carries the hint through', /snowplow/.test(lk.desc || ''), lk.desc);

  const b7 = require('fs').readFileSync(SRC, 'utf8');
  ok('the lookup defaults to the open photo\'s era', /if \(prefer === undefined\) prefer = _rvPrefer\(\);/.test(b7));
  ok('the add path carries it into the wizard', /_prefer: _pinPreferOf\(gs\[0\]\)/.test(b7));


  section('25. Failure copy does not blame the photographer');
  const c1 = require('fs').readFileSync(SRC, 'utf8');
  ok('the crop-tighter scolding is gone', !/crop tight to the label/.test(c1));
  ok('the app owns the failure instead', /free reader could not pick out a number/.test(c1));
  ok('and points at what actually works next', /Read this photo/.test(c1));


  section('26. A guess no longer dresses itself up as an answer');
  const g1 = require('fs').readFileSync(SRC, 'utf8');
  ok('a confirmed read still pre-fills the box',
     /if \(s0\.guess\) sugGuess = String\(s0\.num\); else sug = String\(s0\.num\);/.test(g1));
  ok('a guess is offered as a chip instead', /Best guess from the photo:/.test(g1) && /use this/.test(g1));
  ok('tapping the chip is what runs the lookup', /_pinPickNum\(/.test(g1));
  ok('a failed visual check demotes Add', /_pinDemoteAdd\(true\);/.test(g1));
  ok('a passed one restores it', /_pinDemoteAdd\(false\);/.test(g1));
  ok('and a fresh card always starts undemoted',
     (g1.match(/_pinDemoteAdd\(false\)/g) || []).length >= 2);
  ok('nothing is disabled outright \u2014 only re-styled',
     !/pin-rv-add[^]{0,200}disabled = true/.test(g1));

  section('27. Where a number came from is answerable');
  ok('the reader keeps the words it actually read', /out\.raw = String\(text/.test(g1));
  ok('the raw text is stored with the suggestion',
     (g1.match(/raw: r\.raw \|\| ''/g) || []).length >= 2);
  ok('and shown on the card behind a disclosure', /Where did this come from\?/.test(g1));
  ok('it is escaped, not injected', /rrEsc\(raw\)/.test(g1));
  ok('and capped so a wall of OCR text cannot fill the screen', /slice\(0, 180\)/.test(g1));


  section('28. Capacity stamps and wider date bans');
  global.findMaster = (num, v, prefer) => {
    const CAT = {
      '40200': { itemNum:'40200', _era:'mth_ho' },
      '25000': { itemNum:'25000', _era:'atlas' },
      '6017':  { itemNum:'6017',  _era:'pw' },
      '6445':  { itemNum:'6445',  _era:'pw' },
      '58':    { itemNum:'58',    _era:'pw' },
      '10-2210': { itemNum:'10-2210', _era:'mth_ho' },
    };
    return CAT[String(num)] || null;
  };

  let z = window.__NumFromText('PENNSYLVANIA CAPY 40200 LD LMT 98700 6017');
  ok('a capacity stamp is never the answer', z && z.num !== '40200', JSON.stringify(z));
  ok('and the real number beside it is', z && z.num === '6017' && z.matched);

  z = window.__NumFromText('LIONEL 10-2210');
  ok('a wider date/lot pattern is banned too', !z || z.num !== '10-2210', JSON.stringify(z));

  section('29. The era is a filter, not a tiebreak');
  // 40200 exists, but in another maker's catalog
  z = window.__NumFromText('CAPY 40200 SOMETHING', { era: 'pw', manufacturer: 'Lionel' });
  ok('an off-era number is not confirmed for a stamped photo',
     !z || z.matched !== true, JSON.stringify(z));

  z = window.__NumFromText('LIONEL 6445 FORT KNOX', { era: 'pw', manufacturer: 'Lionel' });
  ok('an in-era number still confirms', z && z.num === '6445' && z.matched === true);

  z = window.__NumFromText('ATLAS 25000 HOPPER', { era: 'pw', manufacturer: 'Lionel' });
  ok('an off-era hit is offered as a lead, not a fact',
     !z || z.matched === false, JSON.stringify(z));
  ok('and is marked as off-era so the UI can say so',
     !z || z.offEra === true || z.num !== '25000', JSON.stringify(z));

  z = window.__NumFromText('ATLAS 25000 HOPPER');
  ok('with no stamp, a long number is still allowed through', z && z.num === '25000');
  z = window.__NumFromText('ATLAS 25000 THREE BAY HOPPER UNDECORATED ROAD READY SERIES');
  ok('and confirmed once there is context for it', z && z.num === '25000' && z.matched === true);

  section('30. Several passes, best answer, early exit');
  const p1 = require('fs').readFileSync(SRC, 'utf8');
  ok('three passes are defined', /_FREE_PASSES = \[/.test(p1) &&
     (p1.match(/mode: '(sharp|invert)'/g) || []).length >= 3);
  ok('tiling goes first \u2014 it won the audit', /\{ mode: 'sharp',  tiles: 3/.test(p1));
  ok('inverted is second', /\{ mode: 'invert', tiles: 0/.test(p1));
  ok('digits-only is last', /wl: 'digits'/.test(p1));
  // v0.9.1072 tightened this: an EMPTY confirmed-nothing result must not stop
  // the loop, so the break now also requires an actual number.
  // v0.9.1096 tightened it again (Brad's 6175-as-"225"): the exit is earned by
  // EVIDENCE — four digits, or the maker's name beside the number — so a bare
  // short confirm scraped off the wrong part of the frame keeps the ladder
  // running and the white-stamp pass gets its turn.
  ok('it stops only on an evidence-backed confirm',
     /if \(best && best\.matched && best\.num\s*\n\s*&& \(String\(best\.num\)\.replace\(\/\\D\/g, ''\)\.length >= 4/.test(p1));
  ok('a confirmed result always beats an unconfirmed one',
     /r\.matched && !best\.matched/.test(p1));
  ok('and any number beats no number', /r\.num && !best\.num/.test(p1));
  ok('the whitelist is put back afterwards', /tessedit_char_whitelist: _WL_FULL/.test(p1));
  ok('the bitmap is released', /if \(bmp\.close\) bmp\.close\(\)/.test(p1));


  section('31. Every read explains itself');
  global.findMaster = (num, v, prefer) => {
    const CAT = { '1111': { itemNum:'1111', _era:'mpc' }, '2412': { itemNum:'2412', _era:'pw' } };
    return CAT[String(num)] || null;
  };
  let d = window.__NumFromText('EO 1111 A 9H OW SROINNTES NERE 2412 H EE S', { era: 'pw', manufacturer: 'Lionel' });
  ok('the stamped photo picks the in-era number', d && d.num === '2412', JSON.stringify(d && d.num));
  ok('and it is confirmed', d && d.matched === true);
  ok('the reasoning is attached', d && d.dbg && d.dbg.era === 'pw');
  ok('it lists what it considered', d && d.dbg.cand.indexOf('1111') >= 0 && d.dbg.cand.indexOf('2412') >= 0);
  ok('it separates in-catalog from other-catalog',
     d.dbg.inEra.join().indexOf('2412') >= 0 && d.dbg.offEra.join().indexOf('1111') >= 0,
     JSON.stringify(d.dbg));

  d = window.__NumFromText('EO 1111 A 9H OW SROINNTES NERE 2412 H EE S');
  ok('with NO stamp the old tiebreak still picks the first', d && d.num === '1111');
  ok('and the reasoning says the filter never ran', d && d.dbg && d.dbg.era === '');

  const q1 = require('fs').readFileSync(SRC, 'utf8');
  ok('the card shows whether the photo was stamped', /no era filter applied/.test(q1));
  ok('and what was considered', /Numbers considered:/.test(q1));


  section('32. A number split across the car is recovered');
  // Brad's ATSF gondola, verbatim from the "Where did this come from?" panel.
  const ATSF = '"2 BE ER - Z SHES BNE EE J EE AT - Z - SE FEA 1 2 T L TC N FEF ARTOE TNE '
             + 'EER GE WEE RTE 2 4 HM - I TW N N E BY SS A 4 A ER RSW 4 7 CAPY 100000 '
             + '3 3 5 6 2 1 LD LMT 128000 BUILT BY CL FT"';
  global.findMaster = (num, v, prefer) => {
    const CAT = { '3562-1': { itemNum:'3562-1', _era:'pw' }, '40200': { itemNum:'40200', _era:'atlas' } };
    return CAT[String(num)] || null;
  };
  let a = window.__NumFromText(ATSF, { era: 'pw', manufacturer: 'Lionel' });
  ok('the split number is recovered from single digits',
     a && a.num === '3562-1', JSON.stringify(a && a.num));
  ok('and it is confirmed, not a guess', a && a.matched === true);
  ok('the reasoning records that it was joined', a && a.dbg && a.dbg.joined === '3562-1');

  ok('the capacity numbers in the same text are not offered',
     !a || (a.num !== '100000' && a.num !== '128000'));

  // must not invent: same text, but the catalog knows nothing
  global.findMaster = () => null;
  a = window.__NumFromText(ATSF, { era: 'pw', manufacturer: 'Lionel' });
  ok('with no catalog backing it never fabricates a joined number',
     !a || a.matched !== true, JSON.stringify(a));

  section('33. Six-digit weights are refused on a stamped photo');
  global.findMaster = (num) => (String(num) === '128000' ? { itemNum:'128000', _era:'mth_ho' } : null);
  a = window.__NumFromText('LD LMT 128000', { era: 'pw', manufacturer: 'Lionel' });
  ok('a six-digit number is not a Lionel catalog number',
     !a || a.num !== '128000', JSON.stringify(a));
  // The capacity ban is keyword-driven and applies with or without a stamp —
  // that is intended, and this assertion was wrong before it was right.
  a = window.__NumFromText('LD LMT 128000');
  ok('a labelled weight is refused even with no stamp', !a || a.num !== '128000');
  a = window.__NumFromText('SOMETHING 128000 ELSE');
  ok('but an unlabelled six-digit number with no stamp is unchanged',
     a && a.num === '128000', JSON.stringify(a));


  section('34. A blank read explains itself too');
  global.findMaster = (num) => (String(num) === '50' ? { itemNum:'50', _era:'pw' } : null);
  let e1 = window.__NumFromText('LIONEL 50', { era: 'pw', manufacturer: 'Lionel' });
  ok('a two-digit number the maker named is offered', e1 && e1.num === '50', JSON.stringify(e1));
  // v0.9.1078 reversed this on purpose: "LIONEL 50" is the maker naming its own
  // number, which is corroboration regardless of how few digits it has.
  ok('and now confidently, because the maker named it',
     e1 && e1.matched === true, JSON.stringify(e1));
  global.findMaster = (n) => (String(n) === '58' ? { itemNum:'58', _era:'pw' } : null);
  e1 = window.__NumFromText('GREAT NORTHERN RAILWAY 58', { era: 'pw', manufacturer: 'Lionel' });
  ok('a short number with NO maker beside it is not offered at all',
     !e1 || !e1.num, JSON.stringify(e1));

  global.findMaster = () => null;
  e1 = window.__NumFromText('NOTHING USEFUL HERE AT ALL', { era: 'pw' });
  ok('a blank read still returns its reasoning', e1 && e1.empty === true && !!e1.dbg);
  ok('and carries no number', e1 && e1.num === '');
  ok('it records that the photo was stamped', e1.dbg.era === 'pw');

  const f1 = require('fs').readFileSync(SRC, 'utf8');
  ok('a blank read is stored on the tried-map, not as a suggestion',
     /f\[fid\] = \{ t: 1, raw:/.test(f1));
  ok('so it still counts as unread for the paid batch',
     /var todo = _groups\.filter\(function \(g\) \{ return !ids\[_pinReadFid\(g\)\]; \}\);/.test(f1));
  ok('the empty state shows the same disclosure', /_pinFailInfo\(\)/.test(f1) && /_pinWhyHtml\(_fi\.raw/.test(f1));
  ok('the why-block is shared, not duplicated', (f1.match(/function _pinWhyHtml/g) || []).length === 1);
  ok('an empty answer never outranks a real one',
     /\(r\.num && !best\.num\)/.test(f1));


  section('35. A fragment must not beat the number it is part of');
  // Brad's ATSF gondola, verbatim from the diagnostic panel.
  const GOND = 'A 4 CHE 1 P E 8 HE 3 BE 1 ENSURE I OF SER SE 28 SESH BE KE SES 1 Z 2 A TE '
             + 'CAPY 100000 L 53 4 35 621 LNT 128000 BUILT BY CEE LT WT 40200 LIONEL NEW 5-54 '
             + 'SS -- TS R ET OTR RE - 4 J E';
  // 621 is a real postwar item. So is 3562-1. The complete number must win.
  global.findMaster = (num) => {
    const CAT = { '621': { itemNum:'621', _era:'pw' }, '3562-1': { itemNum:'3562-1', _era:'pw' } };
    return CAT[String(num)] || null;
  };
  let w = window.__NumFromText(GOND, { era: 'pw', manufacturer: 'Lionel' });
  ok('the complete number beats the fragment', w && w.num === '3562-1', JSON.stringify(w && w.num));
  ok('and is confirmed', w && w.matched === true);
  ok('the reasoning shows what joins were tried',
     w && w.dbg && Array.isArray(w.dbg.joinTried) && w.dbg.joinTried.length > 0);

  // if only the fragment exists in the catalog, the fragment is still the answer
  global.findMaster = (num) => (String(num) === '621' ? { itemNum:'621', _era:'pw' } : null);
  w = window.__NumFromText(GOND, { era: 'pw', manufacturer: 'Lionel' });
  ok('but a fragment still wins when nothing longer confirms', w && w.num === '621');

  // and the weights in that same text stay refused
  ok('the weight stamps are still refused',
     w && ['100000','128000','40200'].indexOf(w.num) < 0);


  section('36. Re-scan clears and re-reads the right photo');
  const rs = require('fs').readFileSync(SRC, 'utf8');
  // v0.9.1150: this sliced a fixed 2,200 characters from the top of the
  // function, so ANY addition to _pinRescan silently pushed later code out of
  // the window and failed four assertions that were still perfectly true —
  // which is exactly what the 1.5 paid-metadata fix did. Bound the slice by the
  // function's real end instead. Same assertions, honest window.
  const rsBody = rs.slice(rs.indexOf('window._pinRescan'), rs.indexOf('window._pinAutoReadCancel'));
  ok('it forgets the stored read', /delete mm\[fid\]/.test(rsBody));
  ok('it forgets the "already tried" marker', /delete ff\[fid\]/.test(rsBody));
  ok('it clears the visual-check cache', /delete _vfCache\[k\]/.test(rsBody));
  // v0.9.1168: `prefer` now carries the rejected-answer list, so the call passes a
  // derived object rather than _preferForFid(fid) directly. Still the same reader,
  // still 2400px, still built from the same filter.
  ok('it re-reads with the full multi-pass reader', /_freeReadBlob\(blob, 2400, _pfR\)/.test(rsBody));
  ok('...on the era filter for that photo, plus what the user has rejected',
     /_preferForFid\(fid\)/.test(rsBody) &&
     /Object\.assign\(\{\}, _pf \|\| \{\}, \{ reject: _rejected \}\)/.test(rsBody));
  ok('it reads the photo on screen (v0.9.1092 supersedes the readable target)',
     /_pinOnScreenFid\(\)/.test(rsBody));
  ok('with a fallback if the group somehow has none',
     /\|\| _rvGroups\[0\]\.files\[0\]\.id/.test(rsBody));
  ok('and it stores the reasoning either way',
     /raw: r\.raw \|\| ''/.test(rsBody) && /raw: \(r && r\.raw\)/.test(rsBody));


  section('37. The token button cannot be mistaken for a balance');
  const tb = require('fs').readFileSync(SRC, 'utf8');
  ok('the label says what the number IS', /Read the ' \+ n \+ ' still unread/.test(tb));
  ok('and that the tokens are a cost', /costs ' \+ n \+ ' token/.test(tb));
  ok('with a tooltip spelling it out', /not what you have left/.test(tb));
  ok('the old balance-looking label is gone', !/Read ' \+ n \+ ' \(' \+ n \+ ' token/.test(tb));

  // the guarantee behind the reassurance
  const rc = tb.slice(tb.indexOf('window._pinReadCropped'), tb.indexOf('window._pinReadCropped') + 3000);
  ok('the free re-read still cannot spend a token', !/aiIdentifyImage/.test(rc));
  ok('nor even check a token balance', !/_qcToken/.test(rc));


  section('38. The maker names its own number');
  // Brad's Lehigh Valley hopper, verbatim from the diagnostic.
  const LV = '- LEH IGH VAL LEY 25000 M IDIMT 128300 WF SE NEW 1-48 BUILT 1-48 LIONEL 6176 '
           + '4 TT B 6 - S EE LEN ITEN VALILEY LV - CT 25000 1 DB CAPY 100000 LD LMT 128300 '
           + 'GR CUFT1880 WE SHW 8 CL P';
  // BOTH are real postwar catalog entries — 25000 is a Mathematics Set.
  global.findMaster = (num) => {
    const CAT = { '25000': { itemNum:'25000', _era:'pw' }, '6176': { itemNum:'6176', _era:'pw' },
                  '1880': { itemNum:'1880', _era:'pw' } };
    return CAT[String(num)] || null;
  };
  let lv = window.__NumFromText(LV, { era: 'pw', manufacturer: 'Lionel' });
  ok('the number stamped beside LIONEL wins', lv && lv.num === '6176', JSON.stringify(lv && lv.num));
  ok('and the reasoning says why', lv && lv.dbg && lv.dbg.viaMaker === '6176');
  ok('the road number is refused outright on a postwar photo',
     lv && lv.dbg.cand.indexOf('25000') < 0, JSON.stringify(lv.dbg.cand));
  ok('so are the weights', lv && lv.dbg.cand.indexOf('100000') < 0 && lv.dbg.cand.indexOf('128300') < 0);

  // the cap is era-aware: MPC and MTH really do use long numbers
  lv = window.__NumFromText('MTH 25000 SOMETHING', { era: 'mth_o', manufacturer: 'MTH' });
  global.findMaster = (num) => (String(num) === '25000' ? { itemNum:'25000', _era:'mth_o' } : null);
  lv = window.__NumFromText('MTH 25000 SOMETHING', { era: 'mth_o', manufacturer: 'MTH' });
  ok('a five-digit number is fine for a maker that uses them', lv && lv.num === '25000');

  section('39. A failed read retries when the reader improves');
  const v1 = require('fs').readFileSync(SRC, 'utf8');
  ok('there is a reader version', /var READER_VER = '\d+';/.test(v1));
  ok('reads are stamped with it', /rv: READER_VER/.test(v1));
  ok('the automatic pass retries anything older', /rec\.rv !== READER_VER/.test(v1));
  // v0.9.1090 reshaped the auto pass around FILES; the same guard reads
  // "return" instead of "return false" inside the forEach.
  ok('a confirmed current read is left alone', /if \(got && got\.rv === READER_VER && !got\.guess\) return;/.test(v1));
  ok('legacy markers count as stale', /typeof rec !== 'object'/.test(v1));

  section('40. The middle of the frame beats the wall behind it');
  ok('the middle band is read on its own first', /var mid = bands\[Math\.floor\(p\.tiles \/ 2\)\]/.test(v1));
  ok('and only a confirmed hit there short-circuits', /if \(rMid && rMid\.matched && rMid\.num\)/.test(v1));
  ok('otherwise the whole frame is still used', /t = \(\(\(await w\.recognize\(_auditCanvas/.test(v1));
  ok('it records that the answer came from the middle', /fromMiddle = true/.test(v1));

  section('41. Short candidates are no longer invisible');
  ok('the diagnostic lists them', /plus short: /.test(v1));


  section('42. Thin reads are never stated as fact');
  global.findMaster = (n) => ({'600':{itemNum:'600',_era:'pw'},'1001':{itemNum:'1001',_era:'pw'}})[String(n)] || null;
  // Brad's 2408 Santa Fe car: this was the ENTIRE text, and it produced
  // "No. 600 — NW2 Switcher" presented as a finding.
  let th = window.__NumFromText('-600 2', { era: 'pw', manufacturer: 'Lionel' });
  ok('the number is still offered', th && th.num === '600');
  ok('but not as a confirmed finding', th && th.matched === false, JSON.stringify(th));
  ok('and the reason is recorded', th && th.dbg.evidence < 18);

  // his M&StL boxcar
  th = window.__NumFromText('- 7 - 5 - 1001- - 4 - 0', { era: 'pw', manufacturer: 'Lionel' });
  ok('the same for four characters of noise', th && th.num === '1001' && th.matched === false);

  // a real read with real context stays confirmed
  global.findMaster = (n) => (String(n) === '6801' ? { itemNum:'6801', _era:'pw' } : null);
  th = window.__NumFromText('RE 5 J BT TT R F ARN 3 6801 J T1T ON EF 1 - 7 NATE SRE ESE N LO',
                            { era: 'pw', manufacturer: 'Lionel' });
  ok('a read with real context is still confirmed', th && th.num === '6801' && th.matched === true);

  // the maker's name is corroboration on its own
  global.findMaster = (n) => (String(n) === '6176' ? { itemNum:'6176', _era:'pw' } : null);
  th = window.__NumFromText('LIONEL 6176', { era: 'pw', manufacturer: 'Lionel' });
  ok('a maker-stamped number is trusted even in short text',
     th && th.num === '6176' && th.matched === true, JSON.stringify(th));

  section('43. The join cannot bypass the rules');
  global.findMaster = (n) => ({'25000':{itemNum:'25000',_era:'pw'},'6176':{itemNum:'6176',_era:'pw'},
                               '1880':{itemNum:'1880',_era:'pw'}})[String(n)] || null;
  let lv2 = window.__NumFromText(LV, { era: 'pw', manufacturer: 'Lionel' });
  ok('the road number cannot be reassembled past the digit cap',
     lv2 && lv2.num === '6176', JSON.stringify(lv2 && lv2.num));
  ok('and the maker-stamped number is what wins', lv2 && lv2.dbg.viaMaker === '6176');
  // The cap is applied when a joined candidate is ACCEPTED, not when it is
  // generated — 35621 has to survive long enough to become 3562-1.
  ok('a bare over-length reassembly is never the answer',
     lv2 && lv2.num.replace(/\D/g, '').length <= 4, JSON.stringify(lv2.num));
  // the split-number recovery must still work
  global.findMaster = (n) => ({'621':{itemNum:'621',_era:'pw'},'3562-1':{itemNum:'3562-1',_era:'pw'}})[String(n)] || null;
  let g2 = window.__NumFromText(GOND, { era: 'pw', manufacturer: 'Lionel' });
  ok('a dashed number longer than the cap is still recoverable',
     g2 && g2.num === '3562-1', JSON.stringify(g2 && g2.num));


  section('44. Identify by what the car says');
  // A small catalog: the words on Brad's cars against real postwar items.
  const ROWS = [
    { itemNum:'55',   _era:'pw', _tab:'PW', description:'Tie-Jector Car', roadName:'Pennsylvania' },
    { itemNum:'54',   _era:'pw', _tab:'PW', description:'Ballast Tamper', roadName:'' },
    { itemNum:'2348', _era:'pw', _tab:'PW', description:'GP9 Diesel', roadName:'Minneapolis & St Louis' },
    { itemNum:'2349', _era:'pw', _tab:'PW', description:'GP9 Diesel', roadName:'Northern Pacific' },
    { itemNum:'6062', _era:'pw', _tab:'PW', description:'Gondola with cable reels', roadName:'New York Central' },
    { itemNum:'9999', _era:'pw', _tab:'PW', description:'Gondola', roadName:'Generic' },
  ];
  const M = new Map();
  ROWS.forEach(r => { M.set(r.itemNum, [r]); });
  global.state = { masterByItem: M, personalData: {} };
  global.window.state = global.state;

  let d1 = window.__DescMatch('GL BALLAST TAMPER N MY WS EEL - BALLAST TAMPER 4 EE BE EE', { era:'pw' });
  ok('a ballast tamper is identified by name', d1 && d1.row.itemNum === '54', JSON.stringify(d1 && d1.row));

  d1 = window.__DescMatch('PRR TIE-JECTOR BLT 58 BY LIONEL', { era:'pw' });
  ok('a tie-jector too', d1 && d1.row.itemNum === '55');

  d1 = window.__DescMatch('TREE BE MINNEAPOLIS ST LOUIS LG S EE LI EY EL TX', { era:'pw' });
  ok('a road name identifies the GP9', d1 && d1.row.itemNum === '2348', JSON.stringify(d1 && d1.row));

  d1 = window.__DescMatch('AN J ST 5 PP PL Y 30 NORTHERN PACIFIC TA EE LE BB', { era:'pw' });
  ok('and the other road name the other one', d1 && d1.row.itemNum === '2349');

  section('45. It refuses to guess when the words are generic');
  d1 = window.__DescMatch('GONDOLA', { era:'pw' });
  ok('one generic word identifies nothing', !d1, JSON.stringify(d1));
  d1 = window.__DescMatch('BUILT BY LIONEL LINES NEW CAR', { era:'pw' });
  ok('stop-words alone identify nothing', !d1);
  d1 = window.__DescMatch('BALLAST TAMPER', {});
  ok('with no era stamped it will not search at all', !d1);
  d1 = window.__DescMatch('', { era:'pw' });
  ok('empty text is safe', !d1);

  const dd = require('fs').readFileSync(SRC, 'utf8');
  ok('it only runs when the numbers failed', /if \(!best \|\| !best\.matched\) \{/.test(dd));
  ok('and never claims certainty', /matched: false, viaDesc: true/.test(dd));
  ok('the card names what it matched on', /Matched by what is written on it/.test(dd));


  section('46. A misread digit plus the lettering');
  const ROWS2 = [
    { itemNum:'321',  _era:'pw', _tab:'PW', description:'Trestle Bridge', roadName:'' },
    { itemNum:'2321', _era:'pw', _tab:'PW', description:'FM Train Master', roadName:'Lackawanna' },
  ];
  const M2 = new Map(); ROWS2.forEach(r => M2.set(r.itemNum, [r]));
  global.state = { masterByItem: M2, personalData: {} };
  global.window.state = global.state;

  const LACK = 'EEEE A Z I 4EL EL AC T DE LACKAWAN NA 1 BR DC C - HEN ET TT 1 9 LE SS 7 FEET '
             + 'EEEEEE PLLA 2 I TE LE ID ES E E 24 -- HE LL E L D321 L AFCO KADWZASNE NIZA LIONEL';
  let dl = window.__DescMatch(LACK, { era:'pw' });
  ok('the road name finds the Train Master', dl && dl.row.itemNum === '2321', JSON.stringify(dl && dl.row));

  const src2 = require('fs').readFileSync(SRC, 'utf8');
  ok('the description is consulted on EVERY read now',
     !/if \(!best \|\| !best\.matched\) \{\s*\n\s*try \{\s*\n\s*var dm/.test(src2));
  ok('a tail agreement is treated as corroboration', /var tailAgrees =/.test(src2));
  ok('and that case is confident', /dbg2\.corroborated[\s\S]{0,200}matched: true/.test(src2));
  ok('a strong name beats a three-digit number', /dm\.score >= 3 && haveNum\.replace\(\/\\D\/g, ''\)\.length <= 3/.test(src2));
  ok('but that disagreement is offered, not asserted', /disagreed: haveNum/.test(src2));
  ok('a long confirmed number is still untouched by it',
     /\} else if \(!best \|\| !best\.matched\) \{/.test(src2));


  section("47. The maker's name survives being misread");
  global.findMaster = (n) => (String(n) === '50' ? { itemNum:'50', _era:'pw' } : null);
  global.state = { masterByItem: new Map(), personalData: {} };
  global.window.state = global.state;
  // Brad's gang car, verbatim: LIONEL came through as IONEL.
  let mk = window.__NumFromText('- 5 - R - 7 OS - J NS EE CS LIONEL - - EE F - ST TR TN 6 AS SE '
    + 'BMRA IR SSE 2 PE - LE PS I - - 8 B - L 10 - HR RT 1 J TSHR IN ER IONEL DE 50 L 3 ET S E',
    { era: 'pw', manufacturer: 'Lionel' });
  ok('a mangled maker name still names the number', mk && mk.num === '50', JSON.stringify(mk && mk.num));
  ok('and that makes it confident despite being two digits',
     mk && mk.matched === true, JSON.stringify(mk));
  ok('the reasoning credits the maker stamp', mk && mk.dbg && mk.dbg.viaMaker === '50');

  section('48. The description index cannot go stale');
  const A = new Map([['1', [{ itemNum:'1', _era:'pw', _tab:'PW', description:'Ballast Tamper' }]]]);
  const B = new Map([['2', [{ itemNum:'2', _era:'pw', _tab:'PW', description:'Ballast Tamper' }]]]);
  global.state = { masterByItem: A, personalData: {} }; global.window.state = global.state;
  let ix = window.__DescMatch('BALLAST TAMPER', { era:'pw' });
  ok('the first catalog answers', ix && ix.row.itemNum === '1');
  global.state = { masterByItem: B, personalData: {} }; global.window.state = global.state;
  ix = window.__DescMatch('BALLAST TAMPER', { era:'pw' });
  ok('a changed catalog is not answered from the old index',
     ix && ix.row.itemNum === '2', JSON.stringify(ix && ix.row));


  section('49. One misread digit');
  // Brad's Boston & Maine boxcar: the reader saw 5464475; the car is 6464-475.
  // 6447 is ALSO a real postwar item and was being cut out of that same run.
  global.state = { masterByItem: new Map(), personalData: {} };
  global.window.state = global.state;
  global.findMaster = (n) => ({
    '6464-475': { itemNum:'6464-475', _era:'pw' },
    '6447':     { itemNum:'6447',     _era:'pw' },
  })[String(n)] || null;
  let bm = window.__NumFromText('3 -5464475 0 20 - 748200 8- -', { era:'pw', manufacturer:'Lionel' });
  ok('a single misread digit is corrected', bm && bm.num === '6464-475', JSON.stringify(bm && bm.num));
  ok('the correction is reported', bm && bm.dbg && /5464475/.test(bm.dbg.oneOff || ''), JSON.stringify(bm && bm.dbg.oneOff));
  ok('a fragment of the same run no longer wins', bm && bm.num !== '6447');

  // it must not invent: nothing in the catalog means no answer
  global.findMaster = () => null;
  bm = window.__NumFromText('3 -5464475 0 20 - 748200 8- -', { era:'pw', manufacturer:'Lionel' });
  ok('with an empty catalog it corrects nothing', !bm || bm.matched !== true, JSON.stringify(bm));

  // only ONE substitution — two is too loose
  global.findMaster = (n) => (String(n) === '1234' ? { itemNum:'1234', _era:'pw' } : null);
  bm = window.__NumFromText('5 6 7 8', { era:'pw', manufacturer:'Lionel' });
  ok('two wrong digits are not corrected into a match',
     !bm || bm.num !== '1234', JSON.stringify(bm && bm.num));

  // an exact run still beats a corrected one
  global.findMaster = (n) => ({'6464475':{itemNum:'6464475',_era:'mth_o'},
                               '6464-475':{itemNum:'6464-475',_era:'pw'}})[String(n)] || null;
  bm = window.__NumFromText('6464475', { era:'pw', manufacturer:'Lionel' });
  ok('an exact dash-repair beats any digit substitution', bm && bm.num === '6464-475');


  section('50. Noise is not a lead');
  global.findMaster = (n) => ({'71':{itemNum:'71',_era:'pw'},'53':{itemNum:'53',_era:'pw'}})[String(n)] || null;
  // Brad's Santa Fe 2414 — the entire recovered text, containing no readable word.
  let nz = window.__NumFromText('3 S EEE 1 SEL AE - ES FA 5 EE N 7 71 XL 4A XA FS-',
                                { era:'pw', manufacturer:'Lionel' });
  ok('a two-digit coincidence in noise is not offered',
     !nz || !nz.num, JSON.stringify(nz && nz.num));
  ok('and the read reports itself as empty', nz && nz.empty === true);

  // v0.9.1080: volume of text was the wrong test — a bare short number is now
  // never offered without something vouching for it.
  nz = window.__NumFromText('GREAT NORTHERN RAILWAY SWITCHER GREEN 53 CAB',
                            { era:'pw', manufacturer:'Lionel' });
  ok('a bare short number is not offered even in real text', !nz || !nz.num);
  ok('but the reasoning says what it dropped and why',
     nz && nz.dbg && (nz.dbg.shortDropped || []).indexOf('53') >= 0, JSON.stringify(nz && nz.dbg));
  global.findMaster = (n) => (String(n) === '50' ? { itemNum:'50', _era:'pw' } : null);
  nz = window.__NumFromText('LIONEL 50 GANG CAR', { era:'pw', manufacturer:'Lionel' });
  ok('the maker vouching for it is enough', nz && nz.num === '50' && nz.matched === true);

  section('51. A local threshold for reflective bodies');
  const lt = require('fs').readFileSync(SRC, 'utf8');
  ok('there is a local-threshold mode', /mode === 'local'/.test(lt));
  ok('it uses an integral image rather than a per-pixel scan', /var integral = new Float64Array/.test(lt));
  // v0.9.1081 promoted this to the best-channel variant, which is a strict
  // superset — identical on neutral bodies, far better on coloured ones.
  ok('the thresholded pass is still LAST, so it costs nothing when earlier ones work',
     /\{ mode: 'sharp',  tiles: 0, wl: 'digits' \},\s*\n\s*\{ mode: 'chan'/.test(lt));
  ok('and the audit can measure it', /id: 'local6'/.test(lt));


  section('52. One word is not an identification');
  const ROWS3 = [
    { itemNum:'3428', _era:'pw', _tab:'PW', description:'U.S. Mail Operating Boxcar', roadName:'U.S. Mail' },
    { itemNum:'1866', _era:'pw', _tab:'PW', description:'Mail Car', roadName:'Western & Atlantic' },
  ];
  const M3 = new Map(); ROWS3.forEach(r => M3.set(r.itemNum, [r]));
  global.state = { masterByItem: M3, personalData: {} }; global.window.state = global.state;
  let one = window.__DescMatch('MAIL MAIL MAIL', { era:'pw' });
  ok('a single repeated word identifies nothing', !one, JSON.stringify(one && one.row));
  let two = window.__DescMatch('WESTERN ATLANTIC MAIL', { era:'pw' });
  ok('two distinct words do', two && two.row.itemNum === '1866', JSON.stringify(two && two.row));

  const dw = require('fs').readFileSync(SRC, 'utf8');
  // v0.9.1085 added a third argument so the paid reader's answer shows too.
  ok('the description card shows its own reasoning too', /_pinWhyHtml\(s\.raw, s\.dbg, s\)/.test(dw));
  ok('rows are deduped within one word', /var seenRow = \{\};/.test(dw));


  section('53. A rare long word can stand alone');
  ok('TIE-JECTOR alone is enough (one item, ten characters)',
     (function () {
       const R = [{ itemNum:'55', _era:'pw', _tab:'PW', description:'Tie-Jector Car', roadName:'Pennsylvania' },
                  { itemNum:'99', _era:'pw', _tab:'PW', description:'Boxcar', roadName:'Pennsylvania' }];
       const MM = new Map(); R.forEach(r => MM.set(r.itemNum, [r]));
       global.state = { masterByItem: MM, personalData: {} }; global.window.state = global.state;
       const r2 = window.__DescMatch('PRR TIE-JECTOR BLT 58 BY LIONEL', { era:'pw' });
       return r2 && r2.row.itemNum === '55';
     })());
  ok('MAIL alone is still not (short, and several items)',
     (function () {
       const R = [{ itemNum:'3428', _era:'pw', _tab:'PW', description:'U.S. Mail Operating Boxcar', roadName:'U.S. Mail' },
                  { itemNum:'1866', _era:'pw', _tab:'PW', description:'Mail Car', roadName:'Western & Atlantic' }];
       const MM = new Map(); R.forEach(r => MM.set(r.itemNum, [r]));
       global.state = { masterByItem: MM, personalData: {} }; global.window.state = global.state;
       return !window.__DescMatch('MAIL MAIL MAIL', { era:'pw' });
     })());


  section('54. The colour channel that actually shows the lettering');
  const ch = require('fs').readFileSync(SRC, 'utf8');
  ok('there is a best-channel pass', /mode === 'chan'/.test(ch));
  ok('it measures each channel rather than assuming one', /bestSd/.test(ch) && /sumSq/.test(ch));
  ok('it samples rather than scanning every pixel', /step = Math\.max\(4/.test(ch));
  ok('it reuses the local threshold instead of copying it',
     (ch.match(/function _localThreshold/g) || []).length === 1 &&
     (ch.match(/_localThreshold\(c\)/g) || []).length >= 2);
  ok('it replaced the plain local pass in the live reader',
     /\{ mode: 'chan',   tiles: 3, wl: 'full'   \},/.test(ch) &&
     !/\{ mode: 'local',  tiles: 3, wl: 'full'   \},/.test(ch));
  ok('and the audit can still compare the two', /id: 'local6'/.test(ch) && /id: 'chan6'/.test(ch));


  section('55. Every band gets the same treatment as the whole frame');
  const am = require('fs').readFileSync(SRC, 'utf8');
  ok('processing is one shared function', (am.match(/function _applyMode/g) || []).length === 1);
  ok('the whole frame uses it', /return _applyMode\(c, mode\);/.test(am));
  ok('and so does each band', /try \{ return _applyMode\(c, mode\); \}/.test(am));
  ok('the band no longer hard-codes a plain stretch',
     !/ctx\.drawImage\(bmp, 0, y0[\s\S]{0,80}try \{ _stretchCanvas\(c\); \} catch \(e\) \{\}\s*\n\s*return c;/.test(am));
  ok('a band failure still falls back rather than throwing',
     /catch \(e\) \{ try \{ _stretchCanvas\(c\); \} catch \(e2\) \{\} \}/.test(am));


  section('56. The paid reader is told which era it is looking at');
  const aiSrc = require('fs').readFileSync(SRC, 'utf8');
  const aiid = require('fs').readFileSync('/root/repo/app/ai-id.js', 'utf8');
  ok('hints are built from the photo stamp', /function _pinAiHints\(group, extra\)/.test(aiSrc));
  ok('no paid call site passes empty hints any more',
     !/aiIdentifyImage2\(\[?[a-z]+\]?, \{\}\)/.test(aiSrc), 'found a bare {} hint');
  ok('the batch keeps the verify note as well as the era',
     /_pinAiHints\(g,\s*\n?\s*\(typeof _vfNote/.test(aiSrc));
  ok('the single-photo read is hinted', /_pinAiHints\(_rvGroups && _rvGroups\[0\]\)/.test(aiSrc));
  ok('the shared question can name a period', /opts\.eraLabel/.test(aiid));
  ok('and it names the trap explicitly', /Celebration Series/.test(aiid));
  ok('it asks for the ORIGINAL, not the reissue', /ORIGINAL production piece/.test(aiid));
  ok('an unstamped photo still asks the plain question',
     /var eraPhrase = '';/.test(aiid));
  ok('the Google/Research query carries it too', /rrIdentifyQuery\(\{ eraLabel:/.test(aiSrc));


  section('57. Reading the reader properly');
  // Brad's 6801 boat flatcar. The reader said POSTWAR and named 6801-75; the app
  // filed 6-16661, a modern reissue SKU.
  global.findMaster = (n, v, prefer) => ({
    '6801':    { itemNum:'6801',    _era:'pw'  },
    '6801-75': { itemNum:'6801-75', _era:'pw'  },
    '6175':    { itemNum:'6175',    _era:'pw'  },
    '6-16661': { itemNum:'6-16661', _era:'mpc' },
    '6-39457': { itemNum:'6-39457', _era:'mpc' },
  })[String(n)] || null;

  const TXT1 = 'Lionel Lionel Lines Lionel 6801-75 O/O27 Gauge Postwar Red Flat Freight Car '
             + '- vintage model train accessory manufactured by Lionel in 1958 (1957) - No. 6-16661';
  let rcn = window.__Reconcile({ itemNum: '6-16661', description: 'with boat' }, TXT1,
                              { era: 'pw', manufacturer: 'Lionel' });
  ok('the postwar number in the answer is preferred', rcn.num === '6801-75', JSON.stringify(rcn));
  ok('and the modern SKU is remembered, not discarded', rcn.swappedFrom === '6-16661');

  // his rocket flatcar: the postwar number was only in the DESCRIPTION
  rcn = window.__Reconcile({ itemNum: '6-39457', description: 'Postwar "6175" Flatcar with rocket' },
                          'Lionel N&W Postwar black flatcar with US Navy rocket load (1958) - No. 6-39457',
                          { era: 'pw', manufacturer: 'Lionel' });
  ok('a number hidden in the description is found', rcn.num === '6175', JSON.stringify(rcn));

  // an answer already in the right catalog is left alone
  rcn = window.__Reconcile({ itemNum: '6801' }, 'Lionel 6801 postwar flatcar',
                          { era: 'pw', manufacturer: 'Lionel' });
  ok('a correct answer is untouched', rcn.num === '6801' && !rcn.swappedFrom);

  // an MPC-stamped photo must KEEP the modern SKU
  rcn = window.__Reconcile({ itemNum: '6-16661' }, 'Lionel 6-16661 reissue of the 6801',
                          { era: 'mpc', manufacturer: 'Lionel' });
  ok('a modern-stamped photo keeps the modern number', rcn.num === '6-16661', JSON.stringify(rcn));

  // with no era stamped, nothing is second-guessed
  rcn = window.__Reconcile({ itemNum: '6-16661' }, TXT1, null);
  ok('an unstamped photo is left exactly as the reader answered', rcn.num === '6-16661');

  section('58. A modern SKU is not a build date');
  global.findMaster = (n) => (String(n) === '6-16661' ? { itemNum:'6-16661', _era:'mpc' } : null);
  let bd = window.__NumFromText('LIONEL 6-16661 REISSUE', { era:'mpc', manufacturer:'Lionel' });
  ok('6-16661 survives on a modern-stamped photo', bd && bd.num === '6-16661', JSON.stringify(bd && bd.num));
  global.findMaster = (n) => (String(n) === '5-54' ? { itemNum:'5-54', _era:'pw' } : null);
  bd = window.__NumFromText('PENNSYLVANIA BLT 5-54', { era:'pw', manufacturer:'Lionel' });
  ok('but a build date is still refused on a postwar one', !bd || bd.num !== '5-54');
  bd = window.__NumFromText('PENNSYLVANIA BLT 5-54');
  ok('and on an UNSTAMPED photo too, where we cannot tell the difference',
     !bd || bd.num !== '5-54', JSON.stringify(bd && bd.num));


  section('59. The paid reader records what it said');
  const pr = require('fs').readFileSync(SRC, 'utf8');
  ok('the batch stores the AI answer', /aiRaw: String\(ai\.text \|\| ''\)/.test(pr));
  ok('the single read stores it too', /aiRaw: _aiRaw, aiSku: _aiSku,/.test(pr));
  ok('it is capped so one answer cannot fill storage', /slice\(0, 900\)/.test(pr));
  ok('the swapped-out SKU is kept', /aiSku: \(meta && meta\._aiSku\)|aiSku: _aiSku/.test(pr));
  ok('the disclosure can show it', /The paid reader answered/.test(pr));
  ok('and explains a swap in plain words', /a closer one from its own answer was used instead/.test(pr));
  ok('it is escaped, not injected', /rrEsc\(ai\.aiRaw\)/.test(pr));
  ok('a free-only read still reads naturally', /The free reader saw/.test(pr));
  // v0.9.1092 supersedes: stored under the ON-SCREEN photo, readable fallback.
  ok('the single read stores under the photo on screen',
     /var fid0 = _pinOnScreenFid\(\) \|\| _pinReadFid\(gs\[0\]\)/.test(pr));


  section('60. The paid read actually stores its result');
  // v0.9.1085 referenced a variable that does not exist in this function. Syntax
  // checking passed; every paid read threw and was swallowed. This test CALLS it.
  localStorage.setItem('rr_inbox_ids', '{}');
  window._pinReview = () => {};
  const grp = { key: 'k', files: [{ id: 'f1', _meta: { era: 'pw', role: 'p' } }] };
  T.groups = [grp];
  let threw = null, okRet = null;
  try {
    okRet = window.__ApplyMeta({ itemNum: '6175', description: 'Flatcar with rocket' },
                               [grp], 'Lionel N&W Postwar black flatcar - No. 6-39457');
  } catch (e) { threw = e; }
  ok('it does not throw', !threw, threw && threw.message);
  ok('it reports success', okRet === true);
  const stored = JSON.parse(localStorage.getItem('rr_inbox_ids') || '{}').f1 || {};
  ok('the number is stored', stored.num === '6175', JSON.stringify(stored.num));
  ok('the paid answer is stored with it', /6-39457/.test(stored.aiRaw || ''), JSON.stringify(stored.aiRaw));

  const am2 = require('fs').readFileSync(SRC, 'utf8');
  ok('the text is a parameter, not a borrowed name',
     /function _pinApplyMeta\(meta, gs, aiText\)/.test(am2));
  ok('no caller forgets to pass it',
     (am2.match(/_pinApplyMeta\(meta, gs\)/g) || []).length === 0);
  ok('a failure to store is no longer silent',
     /could not be saved/.test(am2) && /console\.error\('\[Inbox\] could not store the read:'/.test(am2));


  section('61. Reconciliation reaches every paid path, once');
  const w1 = require('fs').readFileSync(SRC, 'utf8');
  ok('the stacked triplicate is gone', !/could not reconcile the read/.test(w1));
  ok('reconcile lives inside _pinApplyMeta',
     /function _pinApplyMeta[\s\S]{0,1400}_pinReconcileAiNum\(meta, aiText/.test(w1));
  ok('the batch has its own call, with its own group',
     /batch reconcile failed/.test(w1) && /_pinReconcileAiNum\(meta, ai\.text, _pinPreferOf\(g\)\)/.test(w1));
  ok('the screenshot path no longer references a group it does not have',
     (function () {
       const i0 = w1.indexOf('async function _pinProcessShot');
       const seg = w1.slice(i0, w1.indexOf('function _pinProcessText', i0));
       return i0 > 0 && !/_pinPreferOf\(g\)/.test(seg);
     })());

  // and PROVE the token-button path now swaps: __ApplyMeta with an off-era SKU
  global.findMaster = (n, v, prefer) => ({
    '6175':    { itemNum:'6175',    _era:'pw'  },
    '6-39457': { itemNum:'6-39457', _era:'mpc' },
  })[String(n)] || null;
  localStorage.setItem('rr_inbox_ids', '{}');
  const grpB = { key: 'kb', files: [{ id: 'fb1', _meta: { era: 'pw', role: 'p' } }] };
  T.groups = [grpB];
  window.__ApplyMeta({ itemNum: '6-39457', description: 'Postwar "6175" Flatcar with rocket' },
                     [grpB], 'Lionel N&W Postwar black flatcar with US Navy rocket load (1958) - No. 6-39457');
  let st = JSON.parse(localStorage.getItem('rr_inbox_ids')).fb1;
  ok('a paid read through ApplyMeta reconciles to the stamped era',
     st.num === '6175', JSON.stringify(st.num));
  ok('the modern SKU is kept for the disclosure', st.aiSku === '6-39457');
  ok('and it is no longer marked a guess', !st.guess);

  section('62. Answers already paid for are repaired free');
  // Brad's actual situation: the stored read carries 6-39457 with the full
  // answer text alongside it. No new read — just re-read what we bought.
  localStorage.setItem('rr_inbox_ids', JSON.stringify({
    fb1: { num: '6-39457', guess: 0, tried: 1, desc: 'Postwar "6175" Flatcar with rocket',
           aiRaw: 'Lionel Lionel Lines 6175 LIONEL flatcar with US NAVY rocket - No. 6-39457' },
  }));
  window.__RepairStored();
  st = JSON.parse(localStorage.getItem('rr_inbox_ids')).fb1;
  ok('the stored answer is repaired from its own text', st.num === '6175', JSON.stringify(st.num));
  ok('the old SKU is preserved', st.aiSku === '6-39457');
  // idempotent: run again, nothing changes
  window.__RepairStored();
  ok('running it again changes nothing',
     JSON.parse(localStorage.getItem('rr_inbox_ids')).fb1.num === '6175');
  // an unstamped group is never second-guessed
  localStorage.setItem('rr_inbox_ids', JSON.stringify({
    fu1: { num: '6-39457', tried: 1, aiRaw: 'something 6175 something' },
  }));
  T.groups = [{ key: 'ku', files: [{ id: 'fu1' }] }];
  window.__RepairStored();
  ok('an unstamped photo keeps its answer as paid for',
     JSON.parse(localStorage.getItem('rr_inbox_ids')).fu1.num === '6-39457');

  section('63. The paid disclosure actually renders');
  // Count CODE, not comments. A comment in the app that merely names this UI
  // string used to break this assertion (it has now happened seven times across
  // this suite in one evening). Line comments only — a whole-file block-comment
  // strip is its own trap, see the note in section 132.
  const w1c = w1.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok('the stale inline copy is gone',
     (w1c.match(/Where did this come from\?/g) || []).length === 1,
     'copies: ' + (w1c.match(/Where did this come from\?/g) || []).length);
  ok('the normal branch uses the shared builder', /_pinWhyHtml\(s\.raw, s\.dbg, s\) \+/.test(w1));
  // v0.9.1091: the on-screen photo's slot first, with a fallback to the
  // group's readable slot — an existing read must never be hidden by keying
  // on a photo that has not been read yet.
  ok('the card reads the on-screen slot with a readable-slot fallback',
     /\(fid && ids0\[fid\]\)[\s\S]{0,120}_pinReadFid\(_rvGroups\[0\]\)/.test(w1));


  section('64. The repair cannot manufacture evidence');
  // Brad's 6817 scraper car, stamped Modern: the reader saw only the WALL —
  // 1015 (a real prewar transformer), 110, 108, 950 — and the repair turned
  // 1015 into 1615, "Cannonball Express Set", confirmed. From a wall poster.
  global.findMaster = (n, v, prefer) => ({
    '1015': { itemNum:'1015', _era:'prewar' },
    '1615': { itemNum:'1615', _era:'mpc' },
    '950':  { itemNum:'950',  _era:'pw' },
  })[String(n)] || null;
  let mf = window.__NumFromText('MN 1015 45 W T B 0F MW 1C HG R 110 GIA L M BRIT',
                                { era: 'mpc', manufacturer: 'Lionel' });
  ok('a real number from another catalog is never mutated into a match',
     !mf || mf.num !== '1615', JSON.stringify(mf && mf.num));
  ok('the off-era number is offered honestly instead',
     mf && mf.num === '1015' && mf.matched === false && mf.offEra === true,
     JSON.stringify(mf));

  // four digits of nothing must not become an answer either
  global.findMaster = (n) => (String(n) === '2412' ? { itemNum:'2412', _era:'pw' } : null);
  mf = window.__NumFromText('JUNK 2418 MORE JUNK WORDS HERE FOR EVIDENCE COUNT',
                            { era: 'pw', manufacturer: 'Lionel' });
  ok('a four-digit token is not repaired \u2014 too little left to trust',
     !mf || mf.num !== '2412', JSON.stringify(mf && mf.num));

  // the case the repair was BUILT for still works: long, in no catalog
  global.findMaster = (n) => ({
    '6464-475': { itemNum:'6464-475', _era:'pw' },
    '6447':     { itemNum:'6447',     _era:'pw' },
  })[String(n)] || null;
  mf = window.__NumFromText('3 -5464475 0 20 - 748200 8- -', { era:'pw', manufacturer:'Lionel' });
  ok('the seven-digit misread is still repaired', mf && mf.num === '6464-475', JSON.stringify(mf && mf.num));

  const rv = require('fs').readFileSync(SRC, 'utf8');
  ok('the reader version moved past the looser logic, so stale reads retry',
     (function () { const m = rv.match(/var READER_VER = '(\d+)';/); return m && parseInt(m[1], 10) >= 1088; })());


  section('65. The tag settles it');
  // Brad's 6817 Celebration Series scraper car, correctly tagged Modern. The
  // catalog bridge: the Modern row quotes the postwar number in its description.
  const QROWS = [
    { itemNum:'6817',    _era:'pw',  _tab:'PW',  description:'Flatcar with Allis-Chalmers scraper' },
    { itemNum:'6-38424', _era:'mpc', _tab:'MPC', description:'Postwar "6817" Flatcar with Allis-Chalmers scraper' },
  ];
  const QM = new Map(); QROWS.forEach(r => { QM.set(r.itemNum, [r]); });
  global.state = { masterByItem: QM, personalData: {} }; global.window.state = global.state;
  global.findMaster = (n, v, prefer) => (QM.get(String(n)) || [null])[0];

  let qz = window.__QuoteMatch('6817', { era: 'mpc' });
  ok('the Modern row that quotes 6817 is found', qz && qz.row.itemNum === '6-38424');
  ok('a year in a description is never a quote', !window.__QuoteMatch('1958', { era: 'mpc' }));
  ok('no stamp, no bridge', !window.__QuoteMatch('6817', {}));

  // free read on the Modern-tagged photo
  qz = window.__NumFromText('6817 LIONEL PW ALLIS CHALMERS', { era: 'mpc', manufacturer: 'Lionel' });
  ok('a Modern-tagged photo reading 6817 lands on the reissue',
     qz && qz.num === '6-38424' && qz.matched === true, JSON.stringify(qz && qz.num));
  ok('the reasoning names the bridge', qz && qz.dbg && /6817/.test(qz.dbg.quoted || ''));

  // the same read on a POSTWAR-tagged photo stays postwar
  qz = window.__NumFromText('6817 LIONEL ALLIS CHALMERS', { era: 'pw', manufacturer: 'Lionel' });
  ok('a Postwar-tagged photo keeps the postwar row', qz && qz.num === '6817' && qz.matched === true);

  // ambiguity means the user picks — two Modern rows quoting the same number
  const QM2 = new Map();
  [{ itemNum:'6817', _era:'pw', _tab:'PW', description:'Flatcar' },
   { itemNum:'6-38424', _era:'mpc', _tab:'MPC', description:'Postwar "6817" reissue' },
   { itemNum:'6-52999', _era:'mpc', _tab:'MPC', description:'Anniversary "6817" set' }].forEach(r => {
     QM2.set(r.itemNum, (QM2.get(r.itemNum) || []).concat([r]));
   });
  global.state = { masterByItem: QM2, personalData: {} }; global.window.state = global.state;
  ok('two quoting rows do not auto-settle', !window.__QuoteMatch('6817', { era: 'mpc' }));

  // the paid reconciler takes the same bridge
  global.state = { masterByItem: QM, personalData: {} }; global.window.state = global.state;
  let qr = window.__Reconcile({ itemNum: '6817', description: '' }, 'Lionel 6817 postwar flatcar with scraper',
                              { era: 'mpc', manufacturer: 'Lionel' });
  ok('a paid read of 6817 on a Modern photo resolves to the reissue',
     qr.num === '6-38424' && qr.viaQuote === '6817', JSON.stringify(qr));


  section('66. A set is several items');
  const SETG = { key: 'set1', files: [
    { id: 'together', _meta: { role: 'together', kind: 'set' } },
    { id: 'engine',   _meta: { role: 'member',   kind: 'set' } },
    { id: 'car1',     _meta: { role: 'member',   kind: 'set' } },
    { id: 'car2',     _meta: { role: 'member',   kind: 'set' } },
  ] };
  let ftr = window.__FilesToRead(SETG).map(f => f.id);
  ok('every member of a set gets its own read',
     JSON.stringify(ftr) === JSON.stringify(['engine', 'car1', 'car2']), JSON.stringify(ftr));
  ok('the together shot still never reads', ftr.indexOf('together') < 0);

  const ABAG = { key: 'aba1', files: [
    { id: 'p', _meta: { role: 'p', kind: 'aba' } },
    { id: 'b', _meta: { role: 'b', kind: 'aba' } },
    { id: 'd', _meta: { role: 'd', kind: 'aba' } },
  ] };
  ok('an ABA reads all three units',
     window.__FilesToRead(ABAG).length === 3);

  const BOXG = { key: 'box1', files: [
    { id: 'item', _meta: { role: 'item', kind: 'box' } },
    { id: 'box',  _meta: { role: 'box',  kind: 'box' } },
  ] };
  ok('an item-plus-box is ONE item — one read',
     window.__FilesToRead(BOXG).length === 1);
  const SINGLEG = { key: 's1', files: [{ id: 'only' }] };
  ok('a plain single is unchanged', window.__FilesToRead(SINGLEG).length === 1);

  const mm1 = require('fs').readFileSync(SRC, 'utf8');
  ok('the auto pass works per FILE now', /todo\.push\(\{ g: g, fid: fid \}\)/.test(mm1));
  ok('the paid batch never sends a set as angles of one item',
     /_pinFilesToRead\(g\)\.length > 1 \? _flA\.slice\(0, 1\)/.test(mm1));
  ok('thumbnails carry their own numbers', (mm1.match(/data-rvfid/g) || []).length >= 3 &&
     /_tNum \? '<div style="position:absolute/.test(mm1));
  ok('the From-the-photo line follows the photo on screen',
     /_pinAiLine\(fid\)/.test(mm1) && /pin-rv-ailine/.test(mm1));
  ok('the cropped re-read covers members', /jobs\.push\(\{ g: g2, fid: f2\.id \}\)/.test(mm1));


  section('67. Read buttons mean the photo on screen');
  const os = require('fs').readFileSync(SRC, 'utf8');
  ok('there is one helper for the on-screen photo', /function _pinOnScreenFid\(\)/.test(os));
  ok('re-scan reads it', /var fid = _pinOnScreenFid\(\) \|\| _rvGroups\[0\]\.files\[0\]\.id;/.test(os));
  ok('re-scan returns to it afterwards',
     /window\._pinReview\(key\);\s*\n\s*\/\/ Come back to the photo[\s\S]{0,80}_pinRvSetMain\(fid\)/.test(os));
  ok('the paid read reads it', /var _curFid = _pinOnScreenFid\(\);/.test(os));
  ok('and stores under it', /var fid0 = _pinOnScreenFid\(\) \|\| _pinReadFid\(gs\[0\]\)/.test(os));
  ok('a set member is sent ALONE, never as angles of the group',
     /_pinFilesToRead\(g\)\.length > 1[\s\S]{0,120}filter\(function \(f\) \{ return f\.id === _curFid; \}\)/.test(os));
  ok('the re-opened card returns to the photo that was read',
     /if \(fid0\) window\._pinRvSetMain\(fid0\)/.test(os));


  section('68. A number scraped from a photo is never a set number');
  // Brad: "why are we matching to set item numbers." His 6817 came back
  // "1545 — 027 Diesel Freight Set" and earlier "1615 — Cannonball Express
  // Set". A number painted on a car is an item number; set numbers live on
  // boxes and paperwork.
  global.state = { masterByItem: new Map(), personalData: {} }; global.window.state = global.state;
  global.findMaster = (n, v, prefer) => ({
    '1545': { itemNum:'1545', _era:'mpc', _tab:'Lionel MPC - Sets', description:'027 Diesel Freight Set' },
    '1615': { itemNum:'1615', _era:'mpc', _tab:'Lionel MPC - Sets', description:'Cannonball Express Set' },
    '6817': { itemNum:'6817', _era:'pw',  _tab:'Lionel PW - Items', description:'Flatcar with scraper' },
  })[String(n)] || null;
  let sr = window.__NumFromText('ON E L SE W C M 1015 45 W T CO 7 N S11 1545 MORE WALL TEXT HERE',
                                { era:'mpc', manufacturer:'Lionel' });
  ok('a set row cannot confirm a scraped number', !sr || sr.num !== '1545' || sr.matched !== true,
     JSON.stringify(sr && { num: sr.num, matched: sr.matched }));
  sr = window.__NumFromText('LIONEL 6817 FLATCAR LONG ENOUGH TEXT FOR EVIDENCE',
                            { era:'pw', manufacturer:'Lionel' });
  ok('item rows still confirm exactly as before', sr && sr.num === '6817' && sr.matched === true);

  section('69. Two real windows = a question, not an answer');
  // Brad's Summit: "12446" is 2446 with a junk digit; 1244 is also real.
  global.findMaster = (n) => ({
    '1244': { itemNum:'1244', _era:'pw', _tab:'Lionel PW - Items' },
    '2446': { itemNum:'2446', _era:'pw', _tab:'Lionel PW - Items' },
  })[String(n)] || null;
  let wa = window.__NumFromText('TE STE EE 2 - S SH 0 LS - 12446 - FILLER WORDS FOR EVIDENCE',
                                { era:'pw', manufacturer:'Lionel' });
  ok('neither window is stated as fact', wa && wa.matched === false, JSON.stringify(wa));
  ok('both choices are offered', wa && (wa.alts || []).indexOf('1244') >= 0 && (wa.alts || []).indexOf('2446') >= 0,
     JSON.stringify(wa && wa.alts));
  ok('the reasoning says why', wa && wa.dbg && /1244/.test(wa.dbg.windowAmbig || ''));

  section('70. Catalog-note words never name a train');
  const NROWS = [
    { itemNum:'MAN-track-templates-prin-027', _era:'pw', _tab:'Lionel PW - Items',
      description:'Appears to be an error since O Gauge track is shown - see revised form below' },
    { itemNum:'55', _era:'pw', _tab:'Lionel PW - Items', description:'Tie-Jector Car', roadName:'Pennsylvania' },
  ];
  const NM = new Map(); NROWS.forEach(r => NM.set(r.itemNum, [r]));
  global.state = { masterByItem: NM, personalData: {} }; global.window.state = global.state;
  ok('"SEE, ERROR" matches nothing', !window.__DescMatch('EEE SEE DE VA ERROR HN ER', { era:'pw' }));
  ok('a real name still matches', (function () {
    const r = window.__DescMatch('PRR TIE-JECTOR BLT BY LIONEL', { era:'pw' });
    return r && r.row.itemNum === '55';
  })());

  const eg = require('fs').readFileSync(SRC, 'utf8');
  ok('a number found only at the frame edge is demoted', /edgeOnly = true/.test(eg) &&
     /_midDigits\.indexOf\(_digits\) < 0/.test(eg));
  ok('unless the maker named it', /!\(rAll\.dbg && rAll\.dbg\.viaMaker\)/.test(eg));
  ok('free reads store their alternatives', /alts: r\.alts \|\| \[\]/.test(eg));

  section('71. The set list cannot answer for its members — word index');
  // Brad's Ballast Tamper, near-verbatim: the reader saw the NAME twice and a
  // stray 138, and the card said "138 — Water Tower". The word index included
  // set rows, whose descriptions name their member cars — tied scores, no pick.
  const BRAD_BT = 'YL TR - IY BALLAST TAMPER I 138 1 F A 229 540 HN BALLAST TAMPER';
  const SROWS = [
    { itemNum:'54',   _era:'pw', _tab:'Lionel PW - Items', description:'Ballast Tamper', roadName:'' },
    { itemNum:'138',  _era:'pw', _tab:'Lionel PW - Items', description:'Operating Water Tower', roadName:'' },
    { itemNum:'229',  _era:'pw', _tab:'Lionel PW - Items', description:'Alco Diesel', roadName:'' },
    { itemNum:'1615', _era:'pw', _tab:'Lionel PW - Sets',
      description:'Work Train set with Ballast Tamper and crane', roadName:'' },
    { itemNum:'2528WS', _era:'pw', _tab:'Lionel PW - Sets',
      description:'Five-Star Frontier set including Ballast Tamper', roadName:'' },
  ];
  const SM = new Map(); SROWS.forEach(r => SM.set(r.itemNum, [r]));
  global.state = { masterByItem: SM, personalData: {} }; global.window.state = global.state;

  ok('a set row is recognized as one', window.__IsSetRow(SROWS[3]) === true);
  ok('an item row is not', window.__IsSetRow(SROWS[0]) === false);
  ok('itemType marks a set even off a Sets tab',
     window.__IsSetRow({ _tab:'Lionel PW - Items', itemType:'Set' }) === true);

  let bt = window.__DescMatch(BRAD_BT, { era:'pw' });
  ok('BALLAST TAMPER names the 54 despite the set rows',
     bt && bt.row.itemNum === '54', JSON.stringify(bt && bt.row));
  ok('and with enough weight to challenge a number', bt && bt.score >= 3, JSON.stringify(bt && bt.score));

  section('72. A strong name overrules a bare three-digit token');
  // The arbitration itself, CALLED, with Brad's text — a confirmed 138 goes in,
  // an offered 54 comes out, and both candidates are named.
  global.findMaster = (n) => ({
    '54':  { itemNum:'54',  _era:'pw', _tab:'Lionel PW - Items' },
    '138': { itemNum:'138', _era:'pw', _tab:'Lionel PW - Items' },
    '229': { itemNum:'229', _era:'pw', _tab:'Lionel PW - Items' },
  })[String(n)] || null;
  let arb = window.__DescArbitrate({ num:'138', matched:true, dbg:{} }, BRAD_BT, { era:'pw' });
  ok('the lettering wins over the stray token', arb && arb.num === '54', JSON.stringify(arb && arb.num));
  ok('but as an offer, not an assertion', arb && arb.matched === false);
  ok('the overruled number is remembered', arb && arb.disagreed === '138', JSON.stringify(arb && arb.disagreed));
  ok('and the card can say what matched', arb && (arb.descWords || []).join(',').indexOf('BALLAST') >= 0);
  // v0.9.1166 SUPERSEDES the old rule here. This used to assert that a confirmed
  // FOUR-digit number stands against the lettering, matched:true — a confident
  // answer. That is precisely what produced Brad's MKT steam locomotive being
  // offered as "2900 — Lockon", a track accessory: 2900 is a real Lionel number,
  // so it was asserted, and the M-K-T herald on the tender — a word naming ONE row
  // in 23,236 — could not contradict it because the only branch that could
  // required three digits or fewer.
  //
  // The digit count was a proxy for "weak number". Near-uniqueness is a better
  // proxy on the other side: a number can be read off anything in the frame, while
  // lettering is ON the item. So a fingerprint word now leads — offered, never
  // asserted, with the number named beside it.
  arb = window.__DescArbitrate({ num:'6464', matched:true, dbg:{} }, BRAD_BT, { era:'pw' });
  ok('a fingerprint word now contradicts even a confirmed four-digit number',
     arb && arb.num === '54' && arb.matched === false, JSON.stringify(arb));
  ok('…with the number kept beside it, so the user settles it',
     arb && arb.disagreed === '6464');
  ok('…and the disclosure says the lettering and the number disagree',
     arb && arb.dbg && /6464 \(the number read\)/.test(String(arb.dbg.nameVsNumber || '')),
     arb && arb.dbg ? String(arb.dbg.nameVsNumber) : '-');
  // But GENERIC words must still lose to a confirmed number — the rule turns on
  // near-uniqueness, not on words being present at all.
  arb = window.__DescArbitrate({ num:'6464', matched:true, dbg:{} },
                               'GONDOLA CAR LIONEL LINES', { era:'pw' });
  ok('generic words do NOT overturn a confirmed number',
     arb && arb.num === '6464' && arb.matched === true, JSON.stringify(arb));
  // no number at all still gets the description answer
  arb = window.__DescArbitrate({ num:'', matched:false, dbg:{} }, BRAD_BT, { era:'pw' });
  ok('no number → the name is offered', arb && arb.num === '54' && arb.matched === false);
  ok('with nothing marked as overruled', arb && !arb.disagreed, JSON.stringify(arb && arb.disagreed));

  section('73. The quote index skips set rows too');
  const QSROWS = [
    { itemNum:'X1587S', _era:'pw', _tab:'Lionel PW - Sets',
      description:'Freight set with "6817" scraper and caboose', roadName:'' },
  ];
  const QSM = new Map(); QSROWS.forEach(r => QSM.set(r.itemNum, [r]));
  global.state = { masterByItem: QSM, personalData: {} }; global.window.state = global.state;
  ok('a number quoted only by a set resolves nothing', !window.__QuoteMatch('6817', { era:'pw' }));
  const QSROWS2 = QSROWS.concat([{ itemNum:'6-39457', _era:'pw', _tab:'Lionel PW - Items',
    description:'Postwar "6817" Flatcar with scraper', roadName:'' }]);
  const QSM2 = new Map(); QSROWS2.forEach(r => QSM2.set(r.itemNum, [r]));
  global.state = { masterByItem: QSM2, personalData: {} }; global.window.state = global.state;
  let qs2 = window.__QuoteMatch('6817', { era:'pw' });
  ok('an item row quoting it still settles it', qs2 && qs2.row.itemNum === '6-39457',
     JSON.stringify(qs2 && qs2.row));

  const sd = require('fs').readFileSync(SRC, 'utf8');
  ok('free reads persist the disagreement',
     // v0.9.1131 gave the re-read path the full record too, so there are 4 writers now
     (sd.match(/disagreed: r\.disagreed \|\| ''/g) || []).length === 4);
  ok('the card names the overruled number', /names a different item/.test(sd));
  ok('the set rule lives in ONE place',
     (sd.match(/function _pinIsSetRow/g) || []).length === 1 &&
     // v0.9.1119 added a third consumer: _pinDemotedRow folds the set rule
     // into the promo/paper demotion — still one definition, three callers.
     (sd.match(/_pinIsSetRow\(row\)\) return/g) || []).length === 3);

  section('74. The white-stamp pass — light numbers on a coloured body');
  const ws = require('fs').readFileSync(SRC, 'utf8');
  // Order is the safety property: it must be the LAST pass, so a photo that any
  // earlier pass confirms never reaches it, and it can only add reads.
  const passesBlk = ws.slice(ws.indexOf('var _FREE_PASSES'), ws.indexOf('];', ws.indexOf('var _FREE_PASSES')));
  const passLines = passesBlk.split('\n').filter(l => /mode:/.test(l));
  ok('the stamp pass exists', passLines.some(l => /'stamp'/.test(l)));
  ok('and runs last', /'stamp'/.test(passLines[passLines.length - 1]), passLines[passLines.length - 1]);
  ok('digits-only, so letters cannot masquerade', /mode: 'stamp',\s*tiles: 0,\s*wl: 'digits'/.test(ws));
  // The sheet: min-channel, top third skipped, sparse mode set AND restored.
  ok('min-channel whiteness detector', /Math\.min\(px\[i\], px\[i \+ 1\], px\[i \+ 2\]\)/.test(ws));
  ok('the top third never reaches it', /rI = 1; rI <= 2/.test(ws));
  ok('sparse-text mode for the sheet', /tessedit_pageseg_mode: '11'/.test(ws));
  ok('block mode restored right after', /tessedit_pageseg_mode: '6' \}\); \} catch \(ePr\)/.test(ws));
  ok('the read is marked for the disclosure', /r\.dbg\.stampPass = true/.test(ws));
  // v0.9.1098: the cell loop now sits between the sheet read and the marking,
  // so the assertion follows the marking itself rather than adjacency.
  ok('the sheet result obeys the same number rules',
     /r = _numberFromText\(t, prefer\);/.test(ws) && /r\.dbg\.stampPass = true/.test(ws));

  section('75. A short confirm cannot silence the later passes');
  const el = require('fs').readFileSync(SRC, 'utf8');
  ok('the early exit demands four digits or the maker\'s name',
     /String\(best\.num\)\.replace\(\/\\D\/g, ''\)\.length >= 4\s*\n\s*\|\| \(best\.dbg && best\.dbg\.viaMaker\)/.test(el));
  ok('a longer in-era confirm turns into a pick, not a fact',
     /r\.matched = false;\s*\n\s*r\.alts = \[String\(r\.num\), _shortN\]/.test(el));
  ok('the disagreement is named in the reasoning', /dbg\.shortVsLong = _shortN/.test(el));
  ok('and rendered for the user', /Two catalog numbers disagree/.test(el));
  ok('the stamp pass reports what it saw even when it loses',
     /best\.dbg\.stampSaw = stampSaw/.test(el) && /The light-numbers pass saw/.test(el));
  // v0.9.1100 (Brad's 3512/959 card): the chip, input and lookup panel read
  // the SAME record as the headline card, in the same order — on-screen photo
  // first, readable slot as fallback.
  ok('the chip and input read the same slot as the card',
     /var s0 = _ids\(\)\[_rvGroups\[0\]\.files\[0\]\.id\]\s*\n\s*\|\| _ids\(\)\[_pinReadFid\(_rvGroups\[0\]\)/.test(el));

  section('76. Reconstructions need stronger paperwork');
  // Brad's 6175: raw text near-verbatim; 1523 is a SET row hiding in the
  // items list — only its description gives it away.
  global.state = { masterByItem: new Map(), personalData: {} };
  global.window.state = global.state;
  global.findMaster = (n) => ({
    '225':  { itemNum:'225',  _era:'pw', _tab:'Lionel PW - Items', description:'Alco Diesel' },
    '1523': { itemNum:'1523', _era:'pw', _tab:'Lionel PW - Items', description:'Diesel Freight Set, 81' },
  })[String(n)] || null;
  const RKT = 'TT FS CI 1 N Y YOY CT T TT - 1 0 1 3 15 23 - 2 - 225 4 1 4 5 - - 7 3';
  let rk = window.__NumFromText(RKT, { era:'pw', manufacturer:'Lionel' });
  ok('a glued-together number cannot land on a set row',
     rk && rk.num !== '1523', JSON.stringify(rk && rk.num));
  ok('the direct token wins instead', rk && rk.num === '225', JSON.stringify(rk && rk.num));

  // ...but a DIRECT token on a set-described row still reads (110 Trestle Set).
  global.findMaster = (n) => (String(n) === '110'
    ? { itemNum:'110', _era:'pw', _tab:'Lionel PW - Items', description:'Trestle Set' } : null);
  let ts2 = window.__NumFromText('LIONEL 110 GRADUATED TRESTLE FOR TRAINS', { era:'pw', manufacturer:'Lionel' });
  ok('a direct token still reads a set-described item row',
     ts2 && ts2.num === '110', JSON.stringify(ts2 && ts2.num));

  section('77. An era-less reconstruction is a guess by definition');
  // Brad's fresh, untagged 3545 photo: "250 1" glued into 2501, found in the
  // ATLAS list, asserted on a Lionel car.
  global.findMaster = (n) => ({
    '250':  { itemNum:'250',  _era:'prewar', _tab:'Lionel Prewar - Items', description:'Locomotive' },
    '2501': { itemNum:'2501', _era:'atlas',  _tab:'Atlas O - Items',      description:'Undecorated (High Nose)' },
  })[String(n)] || null;
  const TVR = 'RR RE SOR EE 3 TT - J J J QO BANE EE WU - 250 1 TONE BE Y 3 E - -';
  let tv = window.__NumFromText(TVR, null);
  ok('the cross-catalog join is not asserted', tv && tv.matched === false, JSON.stringify(tv));
  ok('but both readings are offered',
     tv && (tv.alts || []).indexOf('2501') >= 0 && (tv.alts || []).indexOf('250') >= 0,
     JSON.stringify(tv && tv.alts));
  ok('and the reasoning says why', tv && tv.dbg && tv.dbg.noEraJoin === true);
  // With an era stamped, the same text behaves as before (era filter rules).
  let tv2 = window.__NumFromText(TVR, { era:'prewar' });
  ok('a stamped photo is unaffected', tv2 && tv2.num === '250', JSON.stringify(tv2 && tv2.num));

  const nj = require('fs').readFileSync(SRC, 'utf8');
  ok('the demotion is explained to the user', /Assembled from split digits with no maker\/era tag/.test(nj));
  ok('era-less uploads announce themselves', /no maker\/era tag yet, so reads will be unfiltered/.test(nj));

  section('78. Backing beats length between two guesses');
  // Brad's Great Northern snowplow: "194" (in NO catalog) was offered while
  // the cab's 58 — read repeatedly, and IS in the stamped catalog — was
  // dropped as short. Near-verbatim raw plus the stamp pass's "0 58 0 58".
  global.state = { masterByItem: new Map(), personalData: {} };
  global.window.state = global.state;
  global.findMaster = (n) => ({
    '58': { itemNum:'58', _era:'pw', _tab:'Lionel PW - Items', description:'Great Northern Rotary Snowplow' },
    '25': { itemNum:'25', _era:'pw', _tab:'Lionel PW - Items', description:'Illuminated Bumper' },
  })[String(n)] || null;
  let gn = window.__NumFromText('4 25 5 - -8 6 194 1 - - - 58 5 - 7 7 9 5\n0 58 0 58',
                                { era:'pw', manufacturer:'Lionel' });
  ok('the backed short wins the guess slot', gn && gn.num === '58', JSON.stringify(gn && gn.num));
  ok('as a guess, never asserted', gn && gn.matched === false);
  ok('frequency picked 58 over 25', gn && gn.num !== '25');
  ok('the unbacked token is still offered as the other chip',
     gn && (gn.alts || []).indexOf('194') >= 0, JSON.stringify(gn && gn.alts));
  ok('the reasoning names the ranking', gn && gn.dbg && gn.dbg.shortBacked === '58');
  // v0.9.1080 rule untouched: a backed short with NO longer token stays dropped.
  let gn2 = window.__NumFromText('EE RE 58 TT BB', { era:'pw', manufacturer:'Lionel' });
  ok('a bare backed short alone is still never offered',
     !gn2 || !gn2.num, JSON.stringify(gn2 && gn2.num));

  section('79. The stamp pass reads two ways');
  const tw = require('fs').readFileSync(SRC, 'utf8');
  ok('sheet first in sparse mode', /tessedit_pageseg_mode: '11'/.test(tw));
  ok('then fine cells one at a time', /function _stampCells/.test(tw) && /_stampCells\(bmp, dim\)/.test(tw));
  ok('cells only when the sheet confirmed nothing', /if \(!\(r && r\.matched && r\.num\)\) \{\s*\n\s*var _cells/.test(tw));
  ok('block mode restored before the cell reads', /catch \(ePr\) \{\}\s*\n\s*r = _numberFromText/.test(tw));
  ok('cells stop the moment four in-era digits confirm',
     /String\(r\.num\)\.replace\(\/\\D\/g, ''\)\.length >= 4\) break;/.test(tw));
  ok('the fine cells skip the wall quarter', /H \* 0\.25/.test(tw));
  ok('cells overlap vertically so a straddling number is whole somewhere', /vPad/.test(tw));

  section('80. Paper rows cannot vote, and the passes compare notes');
  // Brad's Ballast Tamper, THIRD diagnosis — the master carries the item, its
  // BOX, and its INSTRUCTION SHEET, all named 'Ballast Tamper'. The item tied
  // with its own paperwork and the matcher called it ambiguous.
  const PROWS = [
    { itemNum:'54',  _era:'pw', _tab:'Lionel PW - Items', description:'Ballast Tamper', roadName:'Ballast Tamper' },
    { itemNum:'54',  _era:'pw', _tab:'Lionel PW - Boxes', description:'Ballast Tamper, 90', roadName:'' },
    { itemNum:'IS1-54', _era:'pw', _tab:'Lionel PW - Instruction Sheets', description:'Track Ballast Tamper', roadName:'' },
    { itemNum:'2954', _era:'pw', _tab:'Lionel PW - Items', description:'Boxcar DOES NOT APPEAR TO HAVE BEEN TAMPERED WITH', roadName:'Pennsylvania' },
    { itemNum:'138', _era:'pw', _tab:'Lionel PW - Items', description:'Operating Water Tower', roadName:'' },
    { itemNum:'229', _era:'pw', _tab:'Lionel PW - Items', description:'Alco Diesel', roadName:'Minneapolis & St. Louis' },
  ];
  const PM = new Map();
  PROWS.forEach(r => { const k = r.itemNum; PM.set(k, (PM.get(k) || []).concat([r])); });
  global.state = { masterByItem: PM, personalData: {} }; global.window.state = global.state;
  global.findMaster = (n) => { const rs = PM.get(String(n)); return rs ? rs[0] : null; };
  const BT99 = 'YL TR - IY BALLAST TAMPER I 138 1 F A IS 0 EF A 2 J1 O20 MH 229 1 1 VAS NEP 0 OA I 2 TE NEAR RV 5 3 S 540 HN BALLAST TAMPER SJ TPS S- LL CO A SE H TET K 3 B41 EE GLA J 0 BD BS EE I';
  let pb = window.__DescMatch(BT99, { era:'pw' });
  ok('the item no longer ties with its own box', pb && pb.row.itemNum === '54', JSON.stringify(pb && pb.row));
  ok('and the winning row is the ITEM row', pb && /Items/.test(pb.row._tab));
  let pa = window.__DescArbitrate(window.__NumFromText(BT99, { era:'pw', manufacturer:'Lionel' }), BT99, { era:'pw' });
  ok('the Ballast Tamper card finally says 54', pa && pa.num === '54', JSON.stringify(pa && pa.num));
  ok('and does not say its name twice', pa && pa.descOf === 'Ballast Tamper', JSON.stringify(pa && pa.descOf));

  const pl = require('fs').readFileSync(SRC, 'utf8');
  ok('every pass contributes to the pooled text', /textAll \+= \(textAll \? '\\n' : ''\) \+ t;/.test(pl));
  ok('the pooled text gets the final word when nothing confirmed', /rPool = _numberFromText\(textAll, prefer\)/.test(pl));
  ok('and the arbitration reads the pooled words', /_pinDescArbitrate\(best, textAll \|\| text, prefer\)/.test(pl));

  section('81. Noise tokens cannot be answers');
  global.state = { masterByItem: new Map(), personalData: {} }; global.window.state = global.state;
  global.findMaster = () => null;
  let zz = window.__NumFromText('BEB 0000 83 1 - CL LT PE - FL 2 EE RE CR 2 2 OY EE BF', { era:'pw' });
  ok('all-zero tokens are never offered', !zz || zz.num !== '0000', JSON.stringify(zz && zz.num));

  // A stray three-digit token seen ONCE is a guess, not a fact (Brad's 988/213/225).
  global.findMaster = (n) => (String(n) === '988'
    ? { itemNum:'988', _era:'pw', _tab:'Lionel PW - Items', description:'Railroad Structure Set' } : null);
  let so = window.__NumFromText('R6 EEE 53 A3F 2 - A A 25 TE J - SF SEI 4 - B 6 8 988 - - LONG ENOUGH TEXT HERE FOR EVIDENCE',
                                { era:'pw', manufacturer:'Lionel' });
  ok('a once-seen three-digit token is offered, not asserted',
     so && so.num === '988' && so.matched === false, JSON.stringify(so));
  // Either caution can fire first here: the space-joined "6 8 988" makes an
  // unexplained five-digit run, which is the same argument said differently.
  ok('the reasoning says why', so && so.dbg && (so.dbg.shortSolo === '988' || !!so.dbg.longerUnexplained),
     JSON.stringify(so && so.dbg && { shortSolo: so.dbg.shortSolo, longer: so.dbg.longerUnexplained }));
  // ...but read twice, it still confirms.
  let so2 = window.__NumFromText('LIONEL 988 STRUCTURE AND AGAIN 988 WITH PLENTY OF CONTEXT AROUND IT',
                                 { era:'pw', manufacturer:'Lionel' });
  ok('the same token seen twice still confirms', so2 && so2.num === '988' && so2.matched === true,
     JSON.stringify(so2));

  section('82. The color veto and the automatic full-size read');
  // word extraction — colors only, buckets normalized
  let cw = window.__ColorWords('UNPAINTED YELLOW SHELL, WITH BLACK HEAT STAMPED LETTERING');
  ok('color words are extracted and bucketed', cw.indexOf('yellow') >= 0 && cw.indexOf('black') >= 0);
  ok('grey and silver both mean gray', window.__ColorWords('GREY BODY SILVER ROOF').join(',') === 'gray');
  ok('words that are not colors say nothing', window.__ColorWords('OPERATING WATER TOWER').length === 0);

  // clash logic: a yellow/black photo against a gray/orange-only answer = veto
  const TOWER = [{ description:'Water Tower with GRAY plastic top', roadName:'' },
                 { description:'Water Tower, ORANGE plastic roof', roadName:'' }];
  let cc = window.__ColorClash(['yellow','black'], TOWER);
  ok('a yellow item cannot be a gray-and-orange answer', /yellow/.test(cc) && /gray|orange/.test(cc), cc);
  // ...but any variation matching, or a near-color, clears it
  ok('a matching variation clears the veto',
     window.__ColorClash(['yellow','black'], TOWER.concat([{ description:'YELLOW roof variant' }])) === '');
  ok('near-colors clear it too (red vs brown)',
     window.__ColorClash(['red','black'], [{ description:'TUSCAN BROWN body' }]) === '');
  ok('an answer naming no color is never vetoed',
     window.__ColorClash(['red'], [{ description:'Flatcar with boat' }]) === '');
  ok('a photo with no read colors never vetoes', window.__ColorClash(null, TOWER) === '');

  const cv = require('fs').readFileSync(SRC, 'utf8');
  ok('the veto only ever demotes', /if \(out\.matched\) out\.matched = false;/.test(cv));
  ok('the card explains a color veto', /Colors disagree: /.test(cv));
  ok('the auto pass escalates to full size', /_freeReadBlob\(bytes, 1600, pref\)/.test(cv)
     && /_freeReadBlob\(bytes, 2400, pref\)/.test(cv));
  ok('escalation only when the fast read fell short', /if \(!\(r && r\.matched && r\.num\)\) \{\s*\n\s*var r2/.test(cv));
  ok('the bigger read cannot erase a smaller answer', /r2\.num \|\| !\(r && r\.num\)/.test(cv));

  section('83. The curated Body Color outranks prose');
  // A row with bodyColor set: the column IS the answer, prose is ignored.
  let bc = window.__ColorClash(['yellow'], [{ description:'RED body all over', bodyColor:'yellow, black (photo)' }]);
  ok('bodyColor clears a veto prose would have fired', bc === '', bc);
  bc = window.__ColorClash(['red'], [{ description:'RED body', bodyColor:'yellow, black' }]);
  ok('and fires a veto prose would have cleared', /red/.test(bc) && /yellow/.test(bc), bc);
  // prose fallback reads the variation TEXT field
  const bsrc = require('fs').readFileSync(SRC, 'utf8');
  ok('prose fallback uses varDesc, not the variation number', /rw && rw\.varDesc/.test(bsrc));
  const adata = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
  // v0.9.1133: this used to assert `bodyColor: r[21]` — the fixed position that
  // was the whole problem, since the fetch stopped one column short of it and
  // column 21 means UPC on the MTH-family tabs. The parser now finds the column
  // by name, so that is what gets asserted. See section 109 for the behaviour.
  ok('the master parser locates Body Color by header name, not by position',
     /\['bodyColor',\s+null,\s+\['bodycolor', 'bodycolour'\]\]/.test(adata) &&
     !/bodyColor:\s+r\[21\]/.test(adata));

  section('84. Between two real numbers, evidence beats position');
  // Brad's 6816 bulldozer flat asserted as '1043 — Transformer': 1043 came
  // once, off the wall catalog page; 6816 was read three times, twice by the
  // light-numbers pass straight off the car. Position was the tiebreak.
  global.state = { masterByItem: new Map(), personalData: {} };
  global.window.state = global.state;
  global.findMaster = (n) => ({
    '1043': { itemNum:'1043', _era:'pw', _tab:'Lionel PW - Items', description:'Transformer' },
    '6816': { itemNum:'6816', _era:'pw', _tab:'Lionel PW - Items', description:'Flatcar with Allis-Chalmers Bulldozer' },
  })[String(n)] || null;
  const BLDZ = 'WEF ARAIL ORL C 11 TUN NN TBARS 7 N 4498 PF 1 1043 - AY FW 2 - 1 ON E IL EE WE HH T\n6816 1 2 4 6816 1 11 441 - -';
  let fp = window.__NumFromText(BLDZ, { era:'pw', manufacturer:'Lionel' });
  ok('the number read most often wins', fp && fp.num === '6816', JSON.stringify(fp && fp.num));
  ok('and the reasoning says so', fp && fp.dbg && /6816/.test(fp.dbg.freqPick || ''), JSON.stringify(fp && fp.dbg && fp.dbg.freqPick));
  // a single candidate is untouched by the new rule
  let fp2 = window.__NumFromText('LIONEL 1043 TRANSFORMER WITH PLENTY OF CONTEXT', { era:'pw', manufacturer:'Lionel' });
  ok('a lone candidate still reads as before', fp2 && fp2.num === '1043');
  const fsrc = require('fs').readFileSync(SRC, 'utf8');
  ok('the card explains the frequency pick', /kept the one read most often/.test(fsrc));

  section('85. A number READ beats numbers GLUED');
  // Brad's Modern-tagged Celebration 6817: windows assembled 38994 and 9475
  // (both real Modern numbers) from fragments, while 6817 — read straight off
  // the car, a real POSTWAR number — sat parked as an off-era lead.
  global.state = { masterByItem: new Map(), personalData: {} };
  global.window.state = global.state;
  global.findMaster = (n, x, pref) => {
    const CAT = {
      '38994': { itemNum:'38994', _era:'mpc', _tab:'Lionel MPC-Modern', description:'Boxcar' },
      '9475':  { itemNum:'9475',  _era:'mpc', _tab:'Lionel MPC-Modern', description:'Boxcar' },
      '6817':  { itemNum:'6817',  _era:'pw',  _tab:'Lionel PW - Items', description:'Flatcar with Allis-Chalmers Motor Scraper' },
    };
    return CAT[String(n)] || null;
  };
  const CEL = 'GEE Y CC TCE ON ER ERT 2 WP I COU F M T 27 G CB 3 8 9 9 4 7 5 2 MW 1C HG R GIA L\n- - 5 4 6817 - 1 - - 6817 4 3 4';
  let ol = window.__NumFromText(CEL, { era:'mpc', manufacturer:'Lionel' });
  ok('the directly-read off-era number leads the pick',
     ol && ol.num === '6817' && ol.matched === false, JSON.stringify(ol && { num: ol.num, matched: ol.matched }));
  ok('marked off-era so the UI can say so', ol && ol.offEra === true);
  ok('the glued windows ride along as chips',
     ol && (ol.alts || []).indexOf('38994') >= 0, JSON.stringify(ol && ol.alts));
  ok('the reasoning names the lead', ol && ol.dbg && ol.dbg.offEraLead === '6817');

  // ...and when the stamped era's catalog QUOTES the number, the tag settles it.
  const QROWS3 = [
    { itemNum:'6-26024', _era:'mpc', _tab:'Lionel MPC-Modern',
      description:'Postwar Celebration "6817" Flatcar with scraper', roadName:'' },
  ];
  const QM3 = new Map(); QROWS3.forEach(r => QM3.set(r.itemNum, [r]));
  global.state = { masterByItem: QM3, personalData: {} }; global.window.state = global.state;
  let ol2 = window.__NumFromText(CEL, { era:'mpc', manufacturer:'Lionel' });
  ok('the tag settles it when the catalog quotes the number',
     ol2 && ol2.num === '6-26024' && ol2.matched === true, JSON.stringify(ol2 && ol2.num));

  section('86. The reading line tells you when it will finish');
  const et = require('fs').readFileSync(SRC, 'utf8');
  ok('an ETA joins the status after a few photos', /about ' \+ _minLeft \+ ' min left/.test(et));
  ok('with a finish clock time', /done around ' \+ _hh \+ ':' \+ _mm/.test(et));
  ok('recomputed from live pace, not guessed once', /_per = \(Date\.now\(\) - _arT0\) \/ i/.test(et));
  ok('quiet until the pace is knowable', /if \(i >= 3\)/.test(et));

  section('87. The sill strips — a thin line of text read as a line');
  const sst = require('fs').readFileSync(SRC, 'utf8');
  ok('thin sliding bands join the stamp cells', /var bandH = Math\.max\(8, Math\.floor\(BH \/ 4\)\)/.test(sst));
  ok('half-overlapping so a sill straddling a cut is whole somewhere', /var step = Math\.max\(4, Math\.floor\(bandH \/ 2\)\)/.test(sst));
  ok('blown up hard for tiny sill stamps', /Math\.min\(8, Math\.floor\(3200 \/ sw\)/.test(sst));
  ok('bounded so they cannot run away', /bIdx < 8/.test(sst));

  section('88. A starving crop gets the full frame');
  const bcx = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'barcode.js'), 'utf8');
  ok('the wizard lettering retries on the full frame when the crop reads nothing',
     /fullCanvas\.width > workCanvas\.width \* 1\.15/.test(bcx)
     && /T\.recognize\(_bcPreprocessForOCR\(fullCanvas\)/.test(bcx));
  ok('only when the crop found no item number',
     /!\(_extractItemNumberCandidates\(ocrText \|\| ''\) \|\| \[\]\)\.length/.test(bcx));

  section('89. The camera waits for the framing, not just the barcode');
  const bcy = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'barcode.js'), 'utf8');
  ok('a locked barcode starts a countdown instead of firing the shutter',
     /pull back to fit the whole label/.test(bcy) && /capturing in 1/.test(bcy));
  ok('the barcode is kept from the lock either way', /lockedBc: bc/.test(bcy));
  ok('a cancelled camera does not fire mid-countdown',
     (bcy.match(/if \(stopLoop\) return;/g) || []).length >= 2);

  section('90. Auto-capture is a choice');
  const bcz = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'barcode.js'), 'utf8');
  ok('the camera has a remembered auto-capture checkbox',
     /rr_bi_autosnap/.test(bcz) && /Auto-capture when a barcode locks/.test(bcz));
  ok('manual mode holds the lock and hands over the shutter',
     /heldBc = bc;/.test(bcz) && /press \\ud83d\\udcf8 Capture when the label is framed/.test(bcz));
  ok('a manual snap keeps the held barcode', /lockedBc: heldBc/.test(bcz));

  section('91. The self-learning barcode map');
  const bmz = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'barcode.js'), 'utf8');
  ok('every decode consults the learned map first',
     /_bcMapEnsureLoaded\(\)/.test(bmz) && /learned from your earlier scan/.test(bmz));
  ok('a confirmed scan with a locked barcode saves its pairing',
     /rrBcMapLearn\(cap\.lockedBc\.rawValue, res\.itemNum/.test(bmz));
  ok('a label correction saves the strongest pairing of all',
     /rrBcMapLearn\(result\.upc, _ci\._labelResult\.itemNum/.test(bmz) && /label-correction/.test(bmz));
  ok('EAN-13 and UPC-A normalize to one key',
     /v\.charAt\(0\) === '0'\) v = v\.substring\(1\)/.test(bmz));
  ok('the map lives on the personal sheet, visible and durable',
     /'Barcode Map'!A1:E1/.test(bmz) && /addSheet/.test(bmz));
  ok('learning never blocks the flow', /could not save the pairing/.test(bmz));

  section('92. Pairings flow to the community sheet — opted-in, queued, flagged');
  const cs = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'barcode.js'), 'utf8');
  ok('sharing respects the Vault opt-in, everywhere',
     (cs.match(/vaultIsOptedIn\(\)\) return;/g) || []).length >= 2);
  ok('pairings queue locally until the backend accepts',
     /rr_bcpair_q/.test(cs) && /queue holds and retries/.test(cs));
  ok('the drain sends through the existing community pipe',
     /vaultPost\(\{ action: 'barcode_pair', token: token, pairs: q \}\)/.test(cs));
  ok('not-in-master items go through flagged for catalog review',
     /scan-new-item/.test(cs) && /!res\.notInMaster\);/.test(cs));
  ok('queued pairs drain at map load', /_bcPairDrain\(\); \} catch \(e4\)/.test(cs));

  section('93. A photo group can add the WHOLE set');
  const sw = require('fs').readFileSync(SRC, 'utf8');
  ok('the review card offers the whole set when two or more members are read',
     /Add the whole set/.test(sw) && /_setNums\.length >= 2/.test(sw));
  ok('it enters the wizard\'s EXISTING set flow, not a new one',
     /tab: 'set',\s*\n\s*data: \{ tab: 'set', set_knowsNum: 'No', _enteredNums: nums\.slice\(0\)/.test(sw));
  // v0.9.1115: `wizard` is a top-level let — window.wizard is a decoy. The
  // bare assignment is the whole fix for the stale-Want-wizard priority bug.
  ok('the wizard binding is assigned bare, never via window',
     !/window\.wizard = \{/.test(sw) && /\n    wizard = \{/.test(sw));
  ok('the members come from each photo\'s own read', /_pinFilesToRead\(g\)\.forEach/.test(sw));
  ok('finishing returns to the photo inbox', /_returnPage: 'photo-inbox' \}/.test(sw));
  ok('the identify steps are skipped \u2014 the reads did that part',
     /_skip = \{ set_knowsNum: 1, set_num: 1, set_loco: 1 \}/.test(sw));
  ok('a group without enough reads says so instead of guessing',
     /Fewer than two member numbers are read/.test(sw));

  section('94. Quick Entry is gone from the set flow too');
  const wz = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
  ok('no Save Quick Entry button in the set flow', !/se-qe-save/.test(wz));
  ok('no QE Photo button either', !/se-photo-btn/.test(wz));
  ok('one path remains and it walks each item', /Add each item/.test(wz));
  const wzs = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-steps.js'), 'utf8');
  ok('the step title no longer asks HOW', !/How would you like to add ' \+ label/.test(wzs));

  section('95. Set members carry their own photos and their own decade');
  const pv = require('fs').readFileSync(SRC, 'utf8');
  // v0.9.1122: one id per number became a LIST per number, so a set holding
  // the same car twice gives each slot its own picture.
  ok('the group hands each member number its own photo id',
     /\(memberPhotos\[n0\] = memberPhotos\[n0\] \|\| \[\]\)\.push\(f\.id\)/.test(pv) &&
     /_setMemberPhotos: memberPhotos/.test(pv));
  const wsv = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  ok('the walk threads the photo map through every member',
     /_setMemberPhotos = d\._setMemberPhotos/.test(wsv) && /_addPhotoDriveId = _mpList\[_occ\] \|\| _mpList\[0\]/.test(wsv));
  ok('a member resolves to the row from the SET\'S year',
     /_setYr >= _y1 - 1 && _setYr <= _y2 \+ 1/.test(wsv));
  ok('year preference only ever swaps between rows of the same number',
     /normalizeItemNum\(mm\.itemNum\) === normalizeItemNum\(itemNum\)/.test(wsv));
  const wzk = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
  // wizard.js has exactly ONE name-filtered key list (the confirm-review
  // _skipKeys at ~5282); the save path maps columns explicitly, so one
  // mention is the correct count — sibling keys like '_setQEPhotos' and
  // '_addPhotoDriveId' also appear exactly once.
  ok('the photo map is save-metadata, never a sheet field',
     (wzk.match(/'_setMemberPhotos'/g) || []).length === 1);

  section('97. A promo row never outranks the real item (Brad\'s 2338)');
  // The master legitimately holds a "Promotional / Nabisco Promo" 2338 row
  // (Train-O-Rama) AND the EMD GP-7 rows — the promo row loads first and was
  // winning the lookup by load order, sending the reference link to the
  // Train-O-Rama page instead of the GP-7 page.
  const B2338 = [
    { itemNum: '2338', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Promotional',
      description: 'Nabisco Promo', refLink: 'https://cornucopiaoftoytrains.com/lionel-nabisco-shreaded-wheat-train-o-rama-1956-a/' },
    { itemNum: '2338', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Diesel Locomotive',
      description: 'EMD GP-7 Milwaukee Road', refLink: 'https://cornucopiaoftoytrains.com/motive-power-gp-7-gp-9-a/' },
  ];
  global.window._mbAllGet = () => B2338;
  let m8 = window.__BestMaster('2338', '', { era: 'pw', manufacturer: 'Lionel' });
  ok('an era-stamped 2338 lands on the GP-7, not the promo', /GP-7/.test(m8.description), m8 && m8.description);
  m8 = window.__BestMaster('2338', '', null);
  ok('even with no hint the real item beats the promo', /GP-7/.test(m8.description));
  m8 = window.__BestMaster('2338', 'Lionel', null);
  ok('a maker seen by the reader still lands on the real item', /GP-7/.test(m8.description));
  global.window._mbAllGet = () => [B2338[0]];
  m8 = window.__BestMaster('2338', '', null);
  ok('a promo row still wins when it is the only row there is', /Nabisco/.test(m8.description));
  const dm1 = require('fs').readFileSync(SRC, 'utf8');
  ok('word boundaries keep Boxcar and friends out of the demotion',
     /\\b\(promo\|promotional\|paper\|boxes\|catalog\|catalogs\|display\|displays\|instruction\|instructions\)\\b/.test(dm1));

  section('98. Blank-variation items light exactly one catalog row (Brad\'s 1562W)');
  // Members saved without a variation were lighting the BOX/paper rows for
  // 2444/2445/2446 and BOTH MPC-era 1053 sets instead of the postwar
  // transformer — number+blank-variation lookalikes across tabs and eras.
  const brw = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'browse.js'), 'utf8');
  const pin8 = require('fs').readFileSync(SRC, 'utf8');
  ok('the demotion rule is shared, not duplicated',
     /window\.rrDemotedRow = _pinDemotedRow/.test(pin8) && /window\.rrDemotedRow === 'function'/.test(brw));
  ok('adoption scores the saved era first',
     /_pEra && r\._era === _pEra\) s \+= 4/.test(brw));
  ok('row kind must agree with the item\'s own kind',
     /_dem === _pPaper\) s \+= 2/.test(brw));
  ok('one resolver serves the filter, the sorter and the renderer',
     (brw.match(/_rrPdForRow\(/g) || []).length >= 5 && /function _rrPdForRow\(item\)/.test(brw));
  ok('an adopted row lights up and lookalikes let go',
     /_ad\.row === item\) _p = _ad\.pd/.test(brw) && /_p === _ad\.pd && _ad\.row !== item\) _p = null/.test(brw));
  ok('adopted items leave the personal-only lane',
     /adopted items display on their catalog row instead/.test(brw));
  ok('manual entries are never adopted',
     /if \(String\(p\.era \|\| ''\) === 'Manual'\) return;/.test(brw));
  const wsv8 = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  ok('set members now save the matched row\'s variation',
     /wizard\.data\.variation = String\(wizard\.matchedItem\.variation\)/.test(wsv8));

  section('99. Whole sets fold to one expandable row in My Collection');
  ok('only SET-… groups fold — pairs and GRP-… groups are untouched',
     /\^SET-\/i\.test\(String\(_fp\.groupId\)\)/.test(brw));
  ok('folding is display-only and skips search and column-sort views',
     /state\.filters\.owned && !\(state\.filters\.search \|\| ''\)\.trim\(\) && !\(state\._collSort && state\._collSort\.col\)/.test(brw));
  ok('an expanded set renders its members beneath the set row',
     /if \(_openFolds\[_gid\]\) _foldedFD\.push\(it\);/.test(brw));
  ok('the set row shows number, name, piece count and worth',
     /piece\$\{item\.members\.length !== 1 \? 's' : ''\}/.test(brw) && /_fs\.setName, _fs\.year/.test(brw));
  ok('tapping the row toggles the fold',
     /window\._rrToggleSetFold = function \(gid\)/.test(brw) && /_rrToggleSetFold\('\$\{String\(item\.groupId\)/.test(brw));

  section('96. The whole-set add clears its photo group after the save');
  const pv6 = require('fs').readFileSync(SRC, 'utf8');
  // v0.9.1122: the note is written at click time but PARKED in staging —
  // see section 100 for why it may not be armed until the member saves.
  ok('the set add writes one pending note per member',
     /stage0\[n1\] = \{ link: '', fromFid: '', toFid: ''/.test(pv6) &&
     /localStorage\.setItem\(SETSTAGE_KEY, JSON\.stringify\(stage0\)\)/.test(pv6));
  ok('the notes carry every photo that read that number, first one as RSV',
     /numFiles\[n0\] = numFiles\[n0\] \|\| \[\]/.test(pv6) && /rsvFid: fl\[0\]\.id, files: fl/.test(pv6));
  ok('the flush resolves Drive folders at move time, not at click time',
     /if \(!rec\.fromFid\) rec\.fromFid = await _folder\(\)/.test(pv6) &&
     /if \(!rec\.toFid\) rec\.toFid = await driveEnsureItemFolder\(num\)/.test(pv6));
  ok('a folder failure retries next build instead of dropping the note',
     /will retry:', eF\); continue;/.test(pv6));
  ok('the flush matches saved members through the number normalizer',
     /normalizeItemNum\(String\(p\.itemNum\)\) === normalizeItemNum\(num\)/.test(pv6));

  section('100. A set may hold the same car twice, and photos wait for a real save');
  const wzz = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
  const wsz = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  const pnz = require('fs').readFileSync(SRC, 'utf8');
  const bwz = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'browse.js'), 'utf8');

  // — duplicates —
  ok('the catalog decides how many of each piece a set holds',
     /var out   = \(rs\.items \|\| \[\]\)\.slice\(\);/.test(wzz) && /repeats are real/.test(wzz));
  ok('the collapsing Map is gone from BOTH build sites',
     !/new Map\(\[\.\.\._rs\.items/.test(wzz));
  ok('one shared builder serves both build sites',
     (wzz.match(/_rrBuildSetItems\(/g) || []).length >= 3 && /function _rrBuildSetItems\(rs, enteredNums\)/.test(wzz));
  ok('alts and hand-typed add-ons still de-duplicate against the set',
     /if \(!out\.some\(function \(o\) \{ return normalizeItemNum\(o\) === normalizeItemNum\(x\); \}\)\) out\.push\(x\)/.test(wzz));
  ok('each repeated slot reads its own photo out of the list',
     /if \(normalizeItemNum\(items\[_oi\]\) === normalizeItemNum\(itemNum\)\) _occ\+\+/.test(wsz));
  ok('a pre-1122 single-id note still works',
     /Array\.isArray\(_mpVal\) \? _mpVal : \[_mpVal\]/.test(wsz));

  // — photos wait for a save that actually happened —
  ok('set notes park in staging, not in the live pending list',
     /var SETSTAGE_KEY = 'rr_inbox_setstage'/.test(pnz) &&
     !/pend0\[n1\] = \{ link/.test(pnz));
  ok('a note is armed only when its member is written to the sheet',
     /window\.rrPinSetPhotoSaved = function \(itemNum\)/.test(pnz) &&
     /rrPinSetPhotoSaved\(itemNum\)/.test(wsz));
  ok('arming happens before the dashboard build that flushes it',
     wsz.indexOf('rrPinSetPhotoSaved(itemNum)') < wsz.indexOf('buildDashboard();\n      renderBrowse();'));
  ok('arming never clobbers a single-add note',
     /if \(!pend\[n\]\) pend\[n\] = stage\[key\]/.test(pnz));
  ok('an armed note leaves staging so it cannot fire twice',
     /delete stage\[key\]/.test(pnz));

  // — abandoned set entries —
  ok('an abandoned set is a SET- group with no My Sets record behind it',
     /\^SET-\/i\.test\(String\(p\.groupId\)\) \|\| known\[p\.groupId\]\) return;/.test(bwz));
  ok('removal runs through the SAME code the cancel dialog uses',
     /window\.rrRemoveSetGroup = rrRemoveSetGroup/.test(wzz) &&
     /await rrRemoveSetGroup\(gid\)/.test(bwz) &&
     /const _nRemoved = await rrRemoveSetGroup\(groupId\)/.test(wzz));
  ok('rows are deleted bottom-up so row numbers stay valid',
     /keys\.sort\(function \(a, b\) \{ return \(state\.personalData\[b\]\.row \|\| 0\) - \(state\.personalData\[a\]\.row \|\| 0\); \}\)/.test(wzz));
  ok('the notice names the leftover items and asks before removing',
     /Unfinished set entry/.test(bwz) && /ok: 'Remove them', cancel: 'Keep them'/.test(bwz));

  section('101. A photo on the detail page also shows as a thumbnail');
  const drv = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'drive.js'), 'utf8');
  const dsh = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'dashboard.js'), 'utf8');
  const bwt = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'browse.js'), 'utf8');
  ok('the list thumbnail pass uses the shared resolver, not a strict findPD',
     !/const pd2 = item\._personalOnly \? item : findPD\(/.test(bwt) && /const pd2 = _rrPdForRow\(item\)/.test(bwt));
  ok('a blank photo-link cell no longer means no thumbnail',
     !/if \(!pd2 \|\| !pd2\.owned \|\| !pd2\.photoItem\) return;/.test(bwt) &&
     /driveFindItemFolder\(_displayItemNum\(item\)\)/.test(bwt));
  // Scope the slice to driveFindItemFolder ITSELF — the migration that follows
  // it in the file creates era folders on purpose, which is not what this
  // check is about.
  ok('the folder lookup NEVER creates a folder',
     /async function driveFindItemFolder/.test(drv) &&
     !/driveFindOrCreateFolder/.test(drv.slice(
        drv.indexOf('async function driveFindItemFolder'),
        drv.indexOf('window.driveFindItemFolder = driveFindItemFolder'))));
  ok('phone rows and the dashboard reel get the same fallback',
     /_link = await driveFindItemFolder\(pd\.itemNum\)/.test(dsh));
  ok('a folded set header asks for no thumbnail',
     /if \(item\._setFold\) return;                       \/\/ folded set header/.test(bwt));

  section('102. Audit fixes — Lens return trip, and set members reach memory');
  const auP = require('fs').readFileSync(SRC, 'utf8');
  const auW = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  // The Lens watcher referenced `ai`, a local belonging to its three sibling
  // callers — every successful Google return trip threw and was swallowed.
  const _lensFn = auP.slice(auP.indexOf('function _pinLensCheck()'), auP.indexOf('window._pinReviewResearch'));
  // Match the CALL, not the comment above it that quotes the old code.
  ok('the Lens watcher no longer reaches for a variable it does not have',
     !/if \(_pinApplyMeta\(meta, gs, ai && ai\.text\)\)/.test(_lensFn) &&
     /if \(_pinApplyMeta\(meta, gs, txt\)\)/.test(_lensFn));
  ok('the three callers that DO own an `ai` still pass it',
     (auP.match(/_pinApplyMeta\(meta, gs, ai && ai\.text\)/g) || []).length === 2);
  // Set members returned before the optimistic insert every other path gets.
  const _setHook = auW.slice(auW.indexOf('if (d._setMode && tab === \'collection\')'),
                             auW.indexOf('launchSetItemWizard();'));
  ok('a saved set member lands in memory, not just on the sheet',
     /state\.personalData\[_setOptId\] = \{/.test(_setHook) && /owned: true/.test(_setHook));
  ok('it carries the group so a cancel can find and remove it',
     /inventoryId: _setOptId, groupId: groupId \|\| ''/.test(_setHook));
  ok('it is stamped like every other optimistic insert',
     /_stampSaved\(state\.personalData\[_setOptId\]\)/.test(_setHook));
  ok('the insert runs BEFORE the photo note is armed and flushed',
     _setHook.indexOf('state.personalData[_setOptId]') < _setHook.indexOf('rrPinSetPhotoSaved(itemNum)'));

  section('103. Item photos file under their era, and the migration is safe');
  const dv = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'drive.js'), 'utf8');
  // The finder MUST ship before anything moves, or a migrated folder vanishes.
  ok('the finder looks in the root AND every era folder',
     /async function _driveItemFolderAnywhere\(itemNum\)/.test(dv) &&
     /const parents = \[driveCache\.photosId\]\.concat/.test(dv));
  ok('ensure-folder reuses an existing folder before creating a second one',
     /folderId = await _driveItemFolderAnywhere\(key\)/.test(dv) &&
     dv.indexOf('_driveItemFolderAnywhere(key)') < dv.indexOf('folderId = await driveFindOrCreateFolder(key, parentId)'));
  ok('the find-only lookup searches everywhere too',
     /const id = await _driveItemFolderAnywhere\(name\)/.test(dv));
  ok('an unknown era leaves the folder at the top level, never guessed',
     /let parentId = driveCache\.photosId;/.test(dv) && /if \(eraName\) \{/.test(dv));
  ok('a manual entry has no catalog era and is left alone',
     /if \(String\(own\.era\) === 'Manual'\) return '';/.test(dv));
  // v0.9.1126: the AA/ABA base-number bridge. Brad's 204/205/210…520 folders
  // are named for the base while the owned rows are 204-P / 204-D, so without
  // this the bare number falls to the catalog and hits the PREWAR item.
  ok('a base-number folder inherits the era of its suffixed owned rows',
     /baseItemNum\(String\(p\.itemNum\)\) === n/.test(dv) &&
     /String\(p\.itemNum\) !== n/.test(dv));
  ok('the exact owned match is still tried first',
     dv.indexOf("String(p.itemNum) === n && p.era") < dv.indexOf('baseItemNum(String(p.itemNum)) === n'));
  ok('a corrective pass can re-file folders already inside an era folder',
     /async function driveRefileItemFolders/.test(dv) &&
     /if \(should && should !== eraName\) wrong\.push/.test(dv));
  ok('the corrective pass also moves rather than copies',
     /'\/files\/' \+ w\.id \+ '\?addParents='/.test(dv) && /removeParents=' \+ eras\[w\.from\]/.test(dv));
  ok('ONE level — the era label, not era+maker+scale',
     /driveEraFolderNameFor/.test(dv) && !/eraName \+ '\/' \+ .*manufacturer/.test(dv));
  // Migration
  ok('the migration MOVES folders, so ids and every stored link survive',
     /addParents=' \+ eras\[p\.era\] \+\s*\n?\s*'&removeParents=/.test(dv) &&
     /the folder id is unchanged/.test(dv));
  ok('era folders are destinations, never things to move',
     /if \(eraLabels\[f\.name\]\) return;/.test(dv));
  ok('items with no determinable era are skipped, not guessed',
     /skipped\.push\(\{ name: f\.name, why: 'era unknown/.test(dv));
  ok('it pages through every folder, not just the first 200',
     /while \(pageToken\)/.test(dv));
  ok('a dry run touches nothing',
     /if \(dryRun\) return result;/.test(dv));
  ok('one failure does not abort the rest',
     /result\.failed\.push\(\{ name: p\.name/.test(dv));

  section('104. A tender\'s photos reach its own row (audit #3, #4, #7, #9)');
  const ws4 = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  ok('the tender row carries its own photo links',
     /photoItem: anyTenderLink/.test(ws4) && /photoBox: anyTenderBoxLink/.test(ws4));
  ok('the links are derived the same way the engine derives its own',
     /Object\.values\(d\.photosTenderItem \|\| \{\}\)\.find\(v => v\)/.test(ws4));
  ok('the B unit and the second A unit get theirs too',
     /Object\.values\(d\.photosUnit2Item \|\| \{\}\)\.find/.test(ws4) &&
     /Object\.values\(d\.photosUnit3Item \|\| \{\}\)\.find/.test(ws4));
  ok('companion box rows no longer hardcode a blank photo link',
     !/_buildGroupBoxRow\(u2Num, d\.unit2BoxCond \|\| '', '',/.test(ws4) &&
     !/_buildGroupBoxRow\(tNum, d\.tenderBoxCond \|\| '', '',/.test(ws4));
  // audit #7 — the tender's variation was hardcoded blank
  ok('the tender takes its matched catalog row\'s variation',
     /let tVariation = '';/.test(ws4) &&
     /if \(_tm && String\(_tm\.variation \|\| ''\)\.trim\(\)\) tVariation = String\(_tm\.variation\);/.test(ws4));
  ok('the old hardcoded blank is gone',
     !/const tVariation = '';/.test(ws4));
  // audit #9 — inventory id collision
  ok('the tender draws a real inventory id from the allocator',
     /inventoryId: \(typeof nextInventoryId === 'function'\)/.test(ws4) &&
     !/inventoryId: String\(parseInt\(_engineInvId\) \+ 1\),/.test(ws4));
  // audit #4 — companion box rows keyed by the wrong column
  ok('box companions are keyed by inventoryId, not by matchedTo (index 20)',
     !/BoxRow\[20\]/.test(ws4) && /BoxRow\[PERSONAL_FIELD_INDEX\.inventoryId\]/.test(ws4));

  section('105. Reconnecting photos that were uploaded but never linked');
  const dv5 = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'drive.js'), 'utf8');
  ok('only rows with a BLANK link are touched',
     /\.filter\(function \(x\) \{ return x\.pd && x\.pd\.owned && x\.pd\.itemNum && !x\.pd\.photoItem; \}\)/.test(dv5));
  ok('the per-copy subfolder is named for the row\'s inventory id',
     /name='" \+ String\(pd\.inventoryId\)/.test(dv5));
  ok('loose photos are only claimed when exactly ONE copy is owned',
     /if \(\(copies\[pd\.itemNum\] \|\| 1\) === 1\) hit = link;/.test(dv5));
  ok('with several copies and no per-copy folder it gives up rather than guess',
     /ambiguous\.push\(\{ item: pd\.itemNum, copies: copies\[pd\.itemNum\]/.test(dv5));
  ok('a dry run writes nothing',
     /if \(dryRun\) return result;/.test(dv5.slice(dv5.indexOf('async function driveRepairPhotoLinks'))));
  ok('it writes the photoItem column by name, never a hardcoded letter',
     /personalColLetter\('photoItem'\) \+ p\.row/.test(dv5));
  ok('an unsaved row is skipped instead of writing to row 99999',
     /if \(!p\.row \|\| p\.row === 99999\)/.test(dv5));
  ok('one failure does not abort the rest',
     /result\.failed\.push\(\{ item: p\.item, error:/.test(dv5));

  section('106. Audit quick wins — crop-skip setting, single-add cancel');
  const a6src = require('fs').readFileSync(SRC, 'utf8');
  const a6prefs = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'prefs.js'), 'utf8');
  const a6wsave = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  // #12 — the setting that nothing could ever set
  ok('the crop-skip setting finally has a writer',
     /toggle\('skipreadcrop', 'rr_skip_read_crop'/.test(a6prefs));
  ok('and it still honours anything stored in the old format',
     /v === '1' \|\| v === 'true'/.test(a6src));
  // #4 — a cancelled single add must not file its photos
  ok('the single add parks its note in staging, not the live list',
     /stage1\[num\] = \{ link: link/.test(a6src) &&
     /localStorage\.setItem\(SETSTAGE_KEY, JSON\.stringify\(stage1\)\)/.test(a6src));
  ok('nothing writes PENDING_KEY before a save any more',
     !/pend\[num\] = \{ link: link/.test(a6src));
  ok('a real single-item save is what arms it',
     /if \(typeof rrPinSetPhotoSaved === 'function'\) rrPinSetPhotoSaved\(itemNum\); \} catch \(ePs\)/.test(a6wsave));
  ok('arming happens before the wizard closes',
     a6wsave.indexOf('rrPinSetPhotoSaved(itemNum); } catch (ePs)') < a6wsave.indexOf("d._saveComplete = true;\n    closeWizard();"));
  ok('the flush files onto the copy just added, not the first match',
     /var _fresh = _cands\.filter\(function \(p\) \{ return !p\.photoItem; \}\)/.test(a6src) &&
     /parseInt\(b\.inventoryId\) \|\| 0\) - \(parseInt\(a\.inventoryId\)/.test(a6src));

  section('107. The inbox sees past 200 photos, and re-reads survive');
  const a7 = require('fs').readFileSync(SRC, 'utf8');
  ok('the inbox listing pages to the end instead of stopping at 200',
     /nextPageToken,files\(id,name,createdTime,appProperties\)/.test(a7) &&
     /_pageTok = \(res && res\.nextPageToken\) \|\| '';/.test(a7));
  ok('a truncated listing is recorded, not assumed complete',
     /_pinListComplete = false; break;/.test(a7));
  ok('the prune NEVER runs against a listing we know is truncated',
     /if \(!_pinListComplete\) \{ console\.warn\(.\[Inbox\] listing truncated/.test(a7));
  ok('the badge counts the whole inbox, not the first page',
     /async function _pinCountAll\(q\)/.test(a7) && /_navBadge\(await _pinCountAll\(q\)\)/.test(a7));
  ok('the failed-read record is pruned too, so storage cannot fill forever',
     /var ft = _freeTried\(\), ch2 = false;/.test(a7));
  ok('a re-read is stamped with the reader version like every other writer',
     /rv: READER_VER, viaDesc: !!r\.viaDesc,\n                     descOf/.test(a7));
  ok('a re-read miss stores an object, not a bare 1',
     !/f2\[fid\] = 1; _freeTriedSave\(f2\);/.test(a7));
  ok('the lead-photo fallback is per group, not global',
     /var before = jobs\.length;/.test(a7) && /jobs\.length === before && _pinReadFid\(g2\)/.test(a7));

  section('108. Split apart works on phone-captured stacks (audit #6)');
  const a8 = require('fs').readFileSync(SRC, 'utf8');
  ok('ungroup writes a deliberate marker, not an empty value',
     /\{ grp: '-', kind: 'single', role: '' \}/.test(a8) &&
     !/\{ grp: '', kind: 'single', role: '' \}/.test(a8));
  ok('the marker reads back as no-group',
     /grp:  \(ap\.rrGrp === '-'\) \? '' : \(ap\.rrGrp \|\| ''\)/.test(a8));
  ok('and the FILENAME fallback is skipped for a split-apart photo',
     /if \(!out\.grp && ap\.rrGrp !== '-' && file && file\.name\)/.test(a8));
  ok('re-grouping still overwrites the marker with a real id',
     /_pinMetaSet\(files\[i\]\.id, \{ grp: gid, kind: kindId/.test(a8));
  // the harness drives the real function, so prove the round trip
  ok('a filename-grouped photo groups, splits, and stays split',
     (function () {
       const f = { id: 'x1', name: 'INBOX 3 gG9ABC front.jpg', appProperties: {} };
       const before = window.__MetaOf(f).grp;
       const after  = window.__MetaOf({ id: 'x1', name: f.name, appProperties: { rrGrp: '-' } }).grp;
       const regrp  = window.__MetaOf({ id: 'x1', name: f.name, appProperties: { rrGrp: 'G777' } }).grp;
       return before === 'G9ABC' && after === '' && regrp === 'G777';
     })());

  section('109. Master columns read by HEADER NAME, not position (v0.9.1133)');
  // This section is BEHAVIOURAL, not source-regex: it extracts the real
  // functions from app-data.js and runs them. The bug it guards — Body Color
  // never loading because the fetch stopped at column U — is precisely the
  // class a source-shape assertion cannot see, because the code looked right.
  (function () {
    const ad = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
    const s0 = ad.indexOf('function _normHdr');
    const s1 = ad.indexOf('function _deduplicateMaster');
    ok('the header-name reader is present in app-data.js', s0 > 0 && s1 > s0);
    if (s0 < 0 || s1 < s0) return;
    const blk = ad.slice(s0, s1)
      + '\nfunction _fmtYearProd(s){var t=String(s).trim();var m=t.match(/^(\\d{4})-\\d{1,2}-\\d{1,2}/);return m?m[1]:t;}\n'
      + 'return {_normHdr:_normHdr,buildMasterColMap:buildMasterColMap,parseMasterRow:parseMasterRow};';
    const M = new Function(blk)();

    const PW  = ['Item Number','Item Type','Sub-Type','Unit','Powered/Dummy','Control','Road Name','Description','Gauge','Year Produced','Variation #','Variation Details','Reference Link','Notes','Est. Market Value','Source','COTT Code','Original COTT Desc','Category','Track Power','MSRP','Body Color','Stamped Markings'];
    const MTH = ['Item Number','Item Type','Sub Type','Unit','Powered/Dummy','Control','Road Name','Description','Gauge','Year Produced','Variation #','Variation Details','Reference Link','Notes','Est. Market Value','Source','COTT Code','Original Description','Category','Track Power','MSRP','UPC / Barcode'];
    const PRE = PW.slice(0, 18);
    const cmPW = M.buildMasterColMap(PW), cmMTH = M.buildMasterColMap(MTH), cmPRE = M.buildMasterColMap(PRE);

    ok('Body Color is found on Lionel PW - Items', !!cmPW && cmPW.bodyColor === 21);
    ok('Stamped Markings is found on Lionel PW - Items', !!cmPW && cmPW.stampedMarkings === 22);
    ok('UPC / Barcode is found on MTH O', !!cmMTH && cmMTH.upc === 21);
    ok('MTH O has NO Body Color — column V no longer means two things',
       !!cmMTH && cmMTH.bodyColor === undefined);
    ok('Pre-War, which stops at column R, gains no phantom extension columns',
       !!cmPRE && cmPRE.msrp === undefined && cmPRE.bodyColor === undefined);
    ok('"Original COTT Desc" and "Original Description" both map',
       cmPW.originalDesc === 17 && cmMTH.originalDesc === 17);
    ok('"Track/Power" and "Track Power" normalise to the same key',
       M._normHdr('Track/Power') === M._normHdr('Track Power'));

    // The regression that matters most: a barcode must never read as a colour.
    const mthRow = ['30-1234','Boxcar','','','','','Santa Fe','Boxcar','O','2004','','','','','','MTH','','','Rolling Stock','3-Rail','89.95','0748998801234'];
    const pm = M.parseMasterRow(mthRow, 'MTH O', cmMTH);
    ok('an MTH row exposes its barcode as upc', pm.upc === '0748998801234');
    ok('and its bodyColor stays BLANK, not the barcode', pm.bodyColor === '');

    const pwRow = ['6017','Caboose','','','','','Lionel Lines','SP Type Caboose','O','1956','1','brown','http://x','','','COTT','SPC6017','','','','','brown','LIONEL LINES 6017'];
    const pp = M.parseMasterRow(pwRow, 'Lionel PW - Items', cmPW);
    ok('a Lionel PW row finally delivers its Body Color', pp.bodyColor === 'brown');
    ok('and its Stamped Markings', pp.stampedMarkings === 'LIONEL LINES 6017');
    ok('while its upc stays blank', pp.upc === '');

    ok('a garbage header row is rejected rather than trusted',
       M.buildMasterColMap(['a','b','c']) === null && M.buildMasterColMap([]) === null);
    const legacy = M.parseMasterRow(pwRow, 'Master Inventory', null);
    ok('the legacy positional fallback still parses the core fields',
       legacy.itemNum === '6017' && legacy.roadName === 'Lionel Lines');
    ok('but name-only columns stay blank under it, never guessed by position',
       legacy.bodyColor === '' && legacy.upc === '');

    const yr = M.parseMasterRow(['1','','','','','','','','','2022-04-01'], 't', cmPW);
    ok('yearProd is still display-formatted', yr.yearProd === '2022');
    ok('and _yearRaw still keeps the full date for the dedupe key',
       yr._yearRaw === '2022-04-01');
  })();

  section('110. The master fetch actually asks for the new columns');
  const a9 = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
  const cfg9 = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'config.js'), 'utf8');
  ok('the multi-tab range starts at A1 so the header row arrives',
     /_mt\.map\(t => `\$\{t\}!A1:AD`\)/.test(a9));
  ok('and no master-tab fetch stops at column U any more',
     !/_mt\.map\(t => `\$\{t\}!A2:U`\)/.test(a9));
  ok('the header row is consumed as a header, not parsed as an item',
     /const cm = buildMasterColMap\(vals\[0\]\);/.test(a9) &&
     /for \(let n = 1; n < vals\.length; n\+\+\)/.test(a9));
  ok('the catalog cache version moved, so the wider fetch happens at once',
     /CATALOG_CACHE_VER\s*=\s*'126'/.test(cfg9));

  section('111. Every real master tab layout still maps to its legacy columns');
  // The alias table is the risk in v0.9.1133: the master spells the same column
  // several ways across its tabs, and a missing alias silently blanks that field
  // wherever the other spelling is used. These are the TEN header layouts that
  // actually exist across the workbook's 28 items tabs. For each one, every
  // field the tab really has must resolve by NAME to the same index the old
  // positional parser used — no regression, no field quietly lost.
  (function () {
    const ad2 = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
    const blk2 = ad2.slice(ad2.indexOf('function _normHdr'), ad2.indexOf('function _deduplicateMaster'))
      + '\nfunction _fmtYearProd(s){return String(s);}\n'
      + 'return {buildMasterColMap:buildMasterColMap,MASTER_COL_SPEC:MASTER_COL_SPEC};';
    const M2 = new Function(blk2)();
    const LAYOUTS = [
    { tabs: ["Lionel PW - Items"],
      hdr: ["Item Number", "Item Type", "Sub-Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation #", "Variation Details", "Reference Link", "Notes", "Est. Market Value", "Source", "COTT Code", "Original COTT Desc", "Category", "Track Power", "MSRP", "Body Color"] },
    { tabs: ["Lionel Pre-War", "Lionel MPC-Modern"],
      hdr: ["Item Number", "Item Type", "Sub-Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation #", "Variation Details", "Reference Link", "Notes", "Est. Market Value", "Source", "COTT Code", "Original COTT Desc"] },
    { tabs: ["Lionel PW - Service Tools", "Lionel PW - Boxes"],
      hdr: ["Item Number", "Item Type", "Sub-Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation #", "Variation Details", "Reference Link", "Notes", "Est. Market Value", "Source", "COTT Code", "Original COTT Desc", "", "", "", "", "", "", "", ""] },
    { tabs: ["Atlas O", "Atlas HO"],
      hdr: ["Item #", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Item Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track/Power", "MSRP"] },
    { tabs: ["MTH O", "MTH HO"],
      hdr: ["Item Number", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track Power", "MSRP", "UPC / Barcode"] },
    { tabs: ["MTH S Gauge", "MTH G Scale"],
      hdr: ["Item Number", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track Power", "MSRP", "", "", "", "", "", "UPC / Barcode"] },
    { tabs: ["Weaver O", "USA Trains G"],
      hdr: ["Item Number", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track Power", "MSRP"] },
    { tabs: ["Menards O", "3rd Rail O"],
      hdr: ["Item Number", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track Power", "MSRP", "", "", "", "", ""] },
    { tabs: ["Atlas Z"],
      hdr: ["Item #", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Item Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track/Power", "MSRP", "", "", "", "", ""] },
    { tabs: ["Other O Brands"],
      hdr: ["Item Number", "Item Type", "Sub Type", "Unit", "Powered/Dummy", "Control", "Road Name", "Description", "Gauge", "Year Produced", "Variation", "Variation Description", "Reference Link", "Notes", "Market Value", "Source", "COTT Code", "Original Description", "Category", "Track Power", "MSRP", "UPC / Barcode", "Manufacturer"] },
    ];
    let bad = [];
    LAYOUTS.forEach(function (L) {
      const cm = M2.buildMasterColMap(L.hdr);
      if (!cm) { bad.push(L.tabs[0] + ': header not recognised at all'); return; }
      M2.MASTER_COL_SPEC.forEach(function (sp) {
        const field = sp[0], pos = sp[1];
        if (pos === null) return;                       // name-only column
        if (L.hdr[pos] === undefined || L.hdr[pos] === '') return;  // tab lacks it
        if (cm[field] !== pos) {
          bad.push(L.tabs[0] + ' ' + field + ': name->' + cm[field] + ' legacy->' + pos + ' ("' + L.hdr[pos] + '")');
        }
      });
    });
    ok('all ' + LAYOUTS.length + ' real tab layouts reproduce their legacy column positions',
       bad.length === 0, bad.slice(0, 4).join(' | '));
    // and the specific spellings that would otherwise have been lost
    const atlas = M2.buildMasterColMap(LAYOUTS.filter(function (L) { return L.hdr[0] === 'Item #'; })[0].hdr);
    ok('"Item #" is recognised as the item number (Atlas tabs)', !!atlas && atlas.itemNum === 0);
    ok('"Item Description" is recognised as the description', !!atlas && atlas.description === 7);
    ok('"Variation Description" is recognised as varDesc', !!atlas && atlas.varDesc === 11);
    ok('"Market Value" is recognised as marketVal', !!atlas && atlas.marketVal === 14);
  })();

  section('112. Beta blockers (v0.9.1135)');
  const P = require('path');
  const rd = f => fs.readFileSync(P.join(__dirname, '..', f), 'utf8');
  const pi = rd('app/photo-inbox.js');

  // 1.8 — the GDPR deletion address must not be the mailbox that does not exist
  ['index.html', 'privacy/index.html', 'terms/index.html'].forEach(function (f) {
    ok(f + ' does not send users to the dead admin@ mailbox',
       !/admin@therailroster\.com/.test(rd(f)));
  });
  ok('privacy policy gives a working deletion address',
     /support@therailroster\.com/.test(rd('privacy/index.html')));

  // 6.7 — the public landing page is not still "Coming Soon"
  ok('the landing page title is not "Coming Soon"',
     !/<title>[^<]*Coming Soon/i.test(rd('index.html')));

  // 1.6 — the reader audit can actually be stopped
  ok('_status takes a stop handler and builds a real button',
     /function _status\(msg, stopFn\)/.test(pi) &&
     /b\.onclick = stopFn;/.test(pi));
  ok('the audit passes its cancel function rather than an HTML string',
     /_status\('Auditing item [\s\S]{0,120}?window\._pinReaderAuditCancel\)/.test(pi));
  ok('no Stop button is smuggled through _status as markup any more',
     !/_status\([^)]*<button/.test(pi));
  ok('_status still escapes its message — read text is never trusted as markup',
     /String\(msg\)\.replace\(\/<\/g, '&lt;'\)/.test(pi));

  // 1.7 — neither long job can leave the page permanently busy
  (function () {
    const audit = (function () {
      const i = pi.indexOf('window._pinReaderAudit = async function');
      return pi.slice(i, pi.indexOf('window._pinAuditShowSaved', i));
    })();
    ok('the reader audit releases _busy in a finally',
       /\} finally \{[\s\S]{0,200}_busy = false; window\._rrLongJob = false;/.test(audit));
    const rc = (function () {
      const i = pi.indexOf('window._pinReadCropped = async function');
      return pi.slice(i, pi.indexOf('// ══ v0.9.1063', i));
    })();
    ok('re-read cropped releases _busy in a finally',
       /\} finally \{[\s\S]{0,200}_busy = false; _status\(''\);/.test(rc));
    ok('and re-enables its button there too, so it cannot stay disabled',
       /finally \{[\s\S]{0,240}btn\.disabled = false/.test(rc));
  })();

  // 1.4 — Identify on ticked photos must confirm BEFORE deleting anything
  (function () {
    const i = pi.indexOf('window._pinIdentifySelected = async function');
    const sel = pi.slice(i, pi.indexOf('async function _pinIdentifyRun', i));
    ok('Identify-selected asks before spending tokens',
       /_pinConfirm\(msg0/.test(sel) && /if \(!go0\) return;/.test(sel));
    ok('and states the cost in tokens',
       /uses ' \+ n0 \+ ' of your token/.test(sel));
    ok('and warns when existing readings will be replaced',
       /will be replaced/.test(sel));
    ok('the old readings are deleted AFTER the yes, not before',
       sel.indexOf('if (!go0) return;') < sel.indexOf('delete ids[_pinReadFid(g)]'));
  })();

  // 5.4 — the FOR SALE badge must be a real colour, not a CSS variable
  (function () {
    const s = rd('app/sell.js');
    ok('no share card passes a CSS variable to canvas fillStyle',
       !/var accent = [^\n]*var\(--accent\)/.test(s));
    ok('the for-sale accent is a real hex colour',
       (s.match(/var accent = [^\n]*'#f05008'/g) || []).length === 2);
  })();

  // 6.1 — the tutorial must not point at a button that does not exist
  (function () {
    // Strip // comments first. The comment recording this fix necessarily
    // quotes the dead option name, and would otherwise fail the assertion —
    // the same self-match that has bitten this suite before.
    const t = rd('app/tutorial.js').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const w = rd('app/wizard.js');
    ok('no tutorial step still tells the user to tap "Lionel Item #"',
       !/Lionel Item #/.test(t));
    ok('and the option it now names really is on the wizard\'s first screen',
       /My Collection<\/strong>/.test(t) && /'collection','✓ My Collection'/.test(w));
  })();

  section('113. Community contributions actually get fed (v0.9.1136)');
  (function () {
    const P2 = require('path');
    const rd2 = f => fs.readFileSync(P2.join(__dirname, '..', f), 'utf8');
    const pi2 = rd2('app/photo-inbox.js');
    const vj  = rd2('app/vault.js');
    const bc  = rd2('app/barcode.js');

    // The relay was probed black-box on 2026-07-28 and DOES implement
    // barcode_pair, answering {ok:true,received:N}. The client check reads
    // r.ok first, so it passes. The pipe works — this section is about
    // whether anything is put into it. See RELAY_PROBE.md.
    ok('the client still checks r.ok first, which is what the relay returns',
       /if \(r && \(r\.ok \|\| r\.success/.test(bc));

    // 1.2 — the Photo Inbox must contribute the barcodes it resolves
    ok('the Photo Inbox now feeds resolved barcodes to rrBcMapLearn',
       /rrBcMapLearn\(rawValue, itemNum, mfr \|\| '', 'photo-inbox', inMaster\)/.test(pi2));
    ok('it tags them with their own provenance, so they are distinguishable',
       /'photo-inbox'/.test(pi2));
    ok('and learning never blocks or breaks a read',
       /\.catch\(function \(\) \{\}\);\s*\/\/ never let a pairing failure disturb a read/.test(pi2));
    (function () {
      const i = pi2.indexOf('async function _readBarcode(blob)');
      const fn = pi2.slice(i, pi2.indexOf('\n  }', pi2.indexOf('return null;', i)));
      ok('a barcode the catalog does NOT know is still learned',
         /var known = !!\(r\.masterItem && !r\.notInMaster\);[\s\S]{0,120}_bcLearn\(rv, r\.itemNum/.test(fn));
      ok('but is not returned as a read, since it cannot fill in an item',
         /_bcLearn\(rv, r\.itemNum, r\.manufacturer, known\);[\s\S]{0,80}if \(known\) return/.test(fn));
      ok('the fallback paths learn too',
         (fn.match(/_bcLearn\(rv, /g) || []).length === 3);
    })();

    // 1.3 — the contribution guard must ask whether the catalog LOADED,
    // not how big it happens to be
    // Comments stripped: the note recording this fix necessarily quotes the old
    // expression. This is the fourth time this suite has matched its own prose —
    // when asserting that something is GONE, always strip comments first.
    const vjCode = vj.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    ok('the new-item guard no longer keys off an item count',
       !/masterSet\.size >= 500/.test(vjCode));
    ok('it asks whether the catalog actually loaded',
       /const canFlag = masterSet\.loaded === true;/.test(vj));
    ok('and _vaultMasterSet reports that honestly',
       /set\.loaded = loaded;/.test(vj) &&
       /if \(add\(state\.masterData\) > 0\) loaded = true;/.test(vj));
    ok('a small era can now contribute — 158 rows is a real catalog, not a failure',
       /Other O Brands is 158 rows/.test(vj));
  })();

  section('114. Wizard backgrounds follow the theme (v0.9.1137)');
  (function () {
    const css = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app.css'), 'utf8');
    // Strip /* */ comments — the note recording this change quotes the old
    // hex values, and would otherwise fail the "they are gone" assertions.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    ok('the brown collection wash is gone', !/#1a0e08/.test(code));
    ok('the want and sold washes are gone from the wizard',
       !/background:\s*#08101a/.test(code) && !/background:\s*#081a0e/.test(code));
    const wiz = code.slice(code.indexOf('#wizard-modal .modal.wiz-collection'),
                           code.indexOf('.modal-overlay.open .modal'));
    ok('all nine wizard surfaces use var(--bg)',
       (wiz.match(/background:\s*var\(--bg\)/g) || []).length === 9);
    // The accent must still tell the three lists apart
    ok('collection still reads orange', /wiz-collection[\s\S]{0,400}rgba\(232,64,28,0\.4\)/.test(wiz) &&
       /wiz-collection #wizard-progress \{ background: var\(--accent\)/.test(wiz));
    ok('want still reads blue', /wiz-want[\s\S]{0,400}rgba\(41,128,185,0\.4\)/.test(wiz) &&
       /wiz-want #wizard-progress \{ background: #2980b9/.test(wiz));
    ok('sold still reads green', /wiz-sold[\s\S]{0,400}rgba\(46,204,113,0\.4\)/.test(wiz) &&
       /wiz-sold #wizard-progress \{ background: #2ecc71/.test(wiz));
    // The light-theme bug this incidentally fixes
    ok('the light theme really does redefine --bg, so the wizard now follows it',
       /html\[data-theme="light"\][\s\S]{0,200}--bg:\s*#f8e8c0/.test(code));
  })();

  section('115. Buttons inherit a readable colour (v0.9.1138)');
  (function () {
    const css = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app.css'), 'utf8');
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    ok('there is a base colour for <button>', /\bbutton \{ color: var\(--text\); \}/.test(code));
    // It must be a BARE element selector — anything more specific would stop
    // class rules and inline styles from overriding it.
    ok('and it is the lowest-specificity selector, so everything still overrides it',
       !/[.#][\w-]+\s+button \{ color: var\(--text\); \}/.test(code));
    // --text must actually be re-scoped per context, or one rule cannot serve
    // both the dark chrome and the cream page area.
    ok('--text is cream at :root', /:root \{[\s\S]*?--text:\s*#f8e8c0/.test(code));
    ok('and near-black inside .main, which is the cream page',
       /\.main \{[\s\S]{0,400}?--text:\s*#2a2015/.test(code));

    // The specific button Brad reported: the Upgrade picker rows.
    const ap = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app-pages.js'), 'utf8');
    const i = ap.indexOf('window._upgPickApply');
    const pick = ap.slice(i, ap.indexOf('window._upgPickFilter', i));
    ok('the upgrade picker still renders a bare condition number',
       /condition-pip[\s\S]{0,80}' \+ cond \+ '/.test(pick));
    ok('and it sets no colour of its own, so it now takes the cream default',
       !/condition-pip[\s\S]{0,120}color:/.test(pick));
  })();

  section('116. Upgrade modal headings (v0.9.1139)');
  (function () {
    const ap = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app-pages.js'), 'utf8');
    const code = ap.split('\n').filter(l => !/^\s*(\/\/|<!--)/.test(l)).join('\n');
    ok('no modal heading is purple any more',
       !/font-family:var\(--font-head\)[^"]*color:#8b5cf6/.test(code));
    // v0.9.1140: the three headings graduated from matching inline styles to
    // the shared .rr-card-title class — the same cream/Oswald/600 standard,
    // now defined once in app.css instead of three times inline.
    ok('all three upgrade headings use the standard title class',
       (code.match(/class=\\?"rr-card-title\\?">(?:↑ Add to Upgrade List|Pick the item)/g) || []).length === 3);
    ok('the picker heading is now the instruction itself',
       /rr-card-title[^>]*>Pick the item you\\?'d like to upgrade</.test(code));
    ok('and the duplicate title above it is gone',
       !/color:#8b5cf6[^>]*>\\u2191 Add to Upgrade List/.test(code));
    // Purple must survive where it actually means something.
    ok('purple is still the Upgrade accent on buttons and values',
       (code.match(/8b5cf6/g) || []).length >= 8);
  })();

  section('117. One pop-up standard, one filter size (v0.9.1140)');
  (function () {
    const P3 = require('path');
    const rd3 = f => fs.readFileSync(P3.join(__dirname, '..', 'app', f), 'utf8');
    const css = rd3('app.css').replace(/\/\*[\s\S]*?\*\//g, '');

    // The standard exists, and it IS the wizard's look: app background, 16px.
    ok('.rr-card is defined once in app.css',
       /\.rr-card \{[\s\S]{0,400}background: var\(--bg\);[\s\S]{0,300}border-radius: 16px;[\s\S]{0,300}max-width: 520px;/.test(css));
    ok('.rr-card-title is the one heading style',
       /\.rr-card-title \{[\s\S]{0,200}font-family: var\(--font-head\);[\s\S]{0,200}color: var\(--text\);/.test(css));

    // SCOPE (Brad, after seeing a wider first pass): the standard covers the
    // ADD flows — collection, want, sale, sold, upgrade, parts, add-by-photo,
    // add-by-barcode — and the research screens that serve them. Detail cards,
    // contacts, backups, tutorials etc. deliberately keep their own styling,
    // so they must appear in NEITHER list here.
    const inScope = ['app-pages.js','app-collection.js','browse.js','research.js',
                     'wizard.js','wizard-handlers.js','photo-inbox.js','barcode.js'];
    const outOfScope = ['contacts.js','dashboard.js','prefs.js','backup.js','vault.js',
                        'sell.js','share.js','dispatch-board.js','app-misc.js',
                        'migration-ui.js','tutorial.js','app-setup.js','tutorial-gifs-config.js',
                        'wizard-utils.js'];
    let uses = 0;
    inScope.forEach(function (f) { uses += (rd3(f).match(/rr-card/g) || []).length; });
    ok('the standard covers the add and research pop-ups (35+ call sites)',
       uses >= 35, 'uses=' + uses);
    let strays = [];
    outOfScope.forEach(function (f) {
      if (/rr-card/.test(rd3(f))) strays.push(f);
    });
    ok('and nothing OUTSIDE that scope was converted — the cards are left alone',
       strays.length === 0, strays.join(','));

    // Filters: one size, from one config value, in BOTH filter rows.
    ok('the filter config is 17px (Brad picked it over the 21px mock)',
       /fontPx:\s*17,/.test(rd3('item-search-filters-config.js')));
    const wp = rd3('wizard-pickers.js');
    ok('_wpSellFilterRow reads the shared config instead of hardcoding 0.78rem',
       /ITEM_SEARCH_FILTERS\.sizing/.test(wp) && !/font-size:0\.78rem[^']*font-family:var\(--font-body\)'/.test(wp));
    ok('the picker search inputs match at 17px',
       /upg-pick-q[^>]*font-size:17px/.test(rd3('app-pages.js')) &&
       /pick-full-search[^>]*font-size:17px/.test(wp));

    // The Photo-ID research panel matches the standard too.
    ok('#identify-panel sits on the app background at 16px like the standard',
       /#identify-panel \{[\s\S]{0,200}background: var\(--bg\);[\s\S]{0,200}border-radius: 16px;/.test(css));
  })();

  section('118. Research screens present as cards, not pages (v0.9.1142)');
  (function () {
    const P4 = require('path');
    const rd4 = f => fs.readFileSync(P4.join(__dirname, '..', 'app', f), 'utf8');
    const bc4 = rd4('barcode.js');
    ok('the box-identify shell is a dim scrim, not a full-bleed page',
       /d\.style\.cssText = 'position:fixed;inset:0;z-index:99997;background:rgba\(0,0,0,0\.7\)/.test(bc4) &&
       !/z-index:99997;background:#0b0d1d/.test(bc4));
    ok('it centres the standard card',
       /align-items:center;justify-content:center/.test(bc4.slice(bc4.indexOf('function _biOverlay'), bc4.indexOf('var _biStream'))));
    // v0.9.1143: the accent top edge moved from an inline style here into
    // .rr-card itself — Brad asked for the orange bar on ALL of these.
    ok('every phase renders inside the standard card',
       /d\.innerHTML = '<div class="rr-card">' \+ inner \+ '<\/div>';/.test(bc4));
    ok('the accent top bar is part of the standard now, one place',
       /\.rr-card \{[\s\S]{0,400}border-top: 3px solid var\(--accent\);/.test(rd4('app.css').replace(/\/\*[\s\S]*?\*\//g, '')));
    const css4 = rd4('app.css').replace(/\/\*[\s\S]*?\*\//g, '');
    ok('#identify-modal dims like the wizard so its card has visible edges',
       /#identify-modal \{[\s\S]{0,300}background: rgba\(0,0,0,0\.7\);/.test(css4));
  })();

  section('119. The wizard top line says what you are doing (v0.9.1143)');
  (function () {
    const P5 = require('path');
    const rd5 = f => fs.readFileSync(P5.join(__dirname, '..', 'app', f), 'utf8');
    const wz = rd5('wizard.js');
    // v0.9.1144: the full sentences became compact tags after Brad found the
    // sentence + question stack "redundant or too wordy". The tag answers only
    // "which list?"; the question-style step titles keep the friendly voice.
    ok('_wizFlowTitle carries a compact tag per flow',
       /case 'collection': return 'Collection';/.test(wz) &&
       /case 'want':\s+return 'Want List';/.test(wz) &&
       /case 'forsale':\s+return 'Sale List';/.test(wz) &&
       /case 'sold':\s+return 'Sold';/.test(wz));
    ok('and no flow title is a sentence any more',
       !/Add Item to Your /.test(wz.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')));
    ok('the step label leads with the flow title on every render',
       /_wizFlowTitle\(\) \+ ' · Step ' \+ current \+ ' of ' \+ total/.test(wz));
    // The scope trap this fix nearly shipped: a function declared INSIDE
    // another function passes node --check but is invisible to its caller.
    (function () {
      const idx = wz.indexOf('function _wizFlowTitle');
      let d = 0;
      for (const ch of wz.slice(0, idx)) { if (ch === '{') d++; else if (ch === '}') d--; }
      ok('_wizFlowTitle is declared at TOP LEVEL, in scope of its caller', d === 0, 'depth=' + d);
    })();
    ok('the research chooser asks the question in Brad\'s words',
       /What Item Do You Want to Research\?/.test(rd5('barcode.js')));
  })();

  section('120. The accent top bar matches everywhere (v0.9.1145)');
  (function () {
    const css6 = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    ok('the wizard shell wears the same 3px top bar as .rr-card',
       /#wizard-modal \.modal \{ border-top: 3px solid var\(--accent\); \}/.test(css6));
    // v0.9.1146: Brad's correction — ONE colour, not colour-coordinated.
    // Every top bar is var(--accent); flow identity stays on the progress
    // line and Next button where it always was.
    ok('every wizard flow wears the SAME orange bar — no blue, no green',
       /wiz-collection \{[\s\S]{0,200}border-top: 3px solid var\(--accent\);/.test(css6) &&
       /wiz-want \{[\s\S]{0,200}border-top: 3px solid var\(--accent\);/.test(css6) &&
       /wiz-sold \{[\s\S]{0,200}border-top: 3px solid var\(--accent\);/.test(css6) &&
       !/border-top: 3px solid #2980b9/.test(css6) &&
       !/border-top: 3px solid #2ecc71/.test(css6));
    ok('and .rr-card still carries its bar, so the two families agree',
       /\.rr-card \{[\s\S]{0,400}border-top: 3px solid var\(--accent\);/.test(css6));
  })();

  section('121. Collection pickers match the upgrade list style (v0.9.1147)');
  (function () {
    const wp7 = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-pickers.js'), 'utf8');
    const ap7 = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'app-pages.js'), 'utf8');
    ok('all three row titles are accent orange at the upgrade size',
       (wp7.match(/font-family:var\(--font-mono\);font-size:0\.92rem;color:var\(--accent\);font-weight:600/g) || []).length === 3);
    ok('none are gold any more',
       !/color:var\(--accent2\);font-weight:600/.test(wp7));
    // The row shell — surface2 card, 8px radius, bordered, spaced — must be
    // the upgrade picker's shell, in all three renderers.
    const shell = /display:flex;align-items:center;gap:0\.6rem;padding:0\.65rem 0\.85rem;border-radius:8px;background:var\(--surface2\);border:1px solid var\(--border\)/g;
    ok('all three renderers use the upgrade card shell', (wp7.match(shell) || []).length === 3);
    // Fresh non-global regex here: reusing the /g one above would carry its
    // lastIndex into .test() and miss — a classic /g footgun. And the upgrade
    // picker splits its style string across concatenated source lines, so the
    // concatenation ('… ' + '…') is collapsed before matching: the comparison
    // is about the RENDERED style, not the source line-wrapping.
    ok('which really is the upgrade picker\'s shell',
       /display:flex;align-items:center;gap:0\.6rem;padding:0\.65rem 0\.85rem;border-radius:8px;background:var\(--surface2\);border:1px solid var\(--border\)/
         .test(ap7.slice(ap7.indexOf('window._upgPickApply')).replace(/'\s*\n\s*\+\s*'/g, '')));
    ok('no picker row is a flat border-bottom row any more',
       !/padding:0\.5+\drem 0\.7+\drem;cursor:pointer;border-bottom/.test(wp7));
    ok('condition renders as the right-side pip, same as the upgrade list',
       /function _wpCondPip/.test(wp7) && (wp7.match(/\+ _wpCondPip\(pd\)/g) || []).length === 2 &&
       /condition-pip ' \+ k \+ '/.test(wp7));
  })();

  section('122. The Appearance editor (v0.9.1148)');
  (function () {
    const path8 = require('path');
    const cfg8 = fs.readFileSync(path8.join(__dirname, '..', 'app', 'config.js'), 'utf8');
    const idx8 = fs.readFileSync(path8.join(__dirname, '..', 'app', 'index.html'), 'utf8');
    const pf8  = fs.readFileSync(path8.join(__dirname, '..', 'app', 'prefs.js'), 'utf8');
    const ap8  = fs.readFileSync(path8.join(__dirname, '..', 'app', 'appearance.js'), 'utf8');
    const css8 = fs.readFileSync(path8.join(__dirname, '..', 'app', 'app.css'), 'utf8');

    // The one-line hide switch Brad asked for.
    ok('config.js has the APPEARANCE_ENABLED flag (the one-line hide switch)',
       /const APPEARANCE_ENABLED = (true|false);/.test(cfg8));
    ok('the flag is exported to window so late scripts can read it',
       /window\.APPEARANCE_ENABLED = APPEARANCE_ENABLED/.test(cfg8));

    // Trio-lockstep: the script tag must ride the same ?v as everything else.
    const appVerNum = (cfg8.match(/APP_VERSION = 'v0\.9\.(\d+)'/) || [])[1];
    const scriptVer = (idx8.match(/appearance\.js\?v=(\d+)/) || [])[1];
    ok('index.html loads appearance.js at the SAME ?v as APP_VERSION',
       !!appVerNum && scriptVer === appVerNum, 'app=' + appVerNum + ' script=' + scriptVer);

    // Preferences row: present, gated on the flag, opens the editor.
    ok('the Preferences row exists and is gated on APPEARANCE_ENABLED',
       /APPEARANCE_ENABLED !== 'undefined' && APPEARANCE_ENABLED\) \?/.test(pf8) &&
       /openAppearance\(\)/.test(pf8));

    // The editor itself refuses to open when hidden — belt AND suspenders,
    // so a stale cached prefs.js can't resurrect the row's behaviour.
    ok('openAppearance() itself bails when the flag is off',
       /typeof APPEARANCE_ENABLED !== 'undefined' && !APPEARANCE_ENABLED\) return/.test(ap8));

    // New semantic variables land in :root (census §2 — the missing vars).
    const root8 = css8.slice(css8.indexOf(':root {'), css8.indexOf('\n  }', css8.indexOf(':root {')));
    ok(':root defines the new semantic vars at their census values',
       /--want:\s*#2980b9/.test(root8) && /--forsale:\s*#e67e22/.test(root8) &&
       /--danger:\s*#e74c3c/.test(root8) && /--warn:\s*#f0b429/.test(root8) &&
       /--info:\s*#3498db/.test(root8) && /--on-accent:\s*#ffffff/.test(root8));
    // v0.9.1153: this asserted the ALIAS form `var(--surface2)`, which turned out
    // to be the bug — a custom property resolves where it is declared, so :root's
    // dark value inherited into the light .main island. Section 127 now asserts
    // the opposite (a literal per scope, never an alias). Landmine #4 is still
    // closed; what matters is that :root defines it at all.
    ok(':root finally defines --bg-card (census landmine #4 — was used-but-undefined)',
       /--bg-card:\s*#[0-9a-f]{6}/i.test(root8));

    // Persistence rides the EXISTING plumbing — lv_skin_custom + lv_theme,
    // then applyTheme() replays it. No second theme system.
    ok('Save & Use persists through A11Y customStorageKey / lv_skin_custom',
       /customStorageKey\) \|\| 'lv_skin_custom', JSON\.stringify\(map\)/.test(ap8));
    ok("…and flips lv_theme to 'custom' so applyTheme() replays the skin",
       /storageKey\) \|\| 'lv_theme', 'custom'/.test(ap8));
    ok('close always re-runs applyTheme() and clears the live experiment vars',
       /applyTheme === 'function'\) applyTheme\(\)/.test(ap8) &&
       /removeProperty\(v\)/.test(ap8));

    // Every id the TARGETS wiring map points at must exist in the scene
    // HTML — the "nothing buried or wired wrong" guarantee: a chip whose
    // target id vanished would silently point at nothing.
    (function () {
      const tBlock = ap8.slice(ap8.indexOf('var TARGETS'), ap8.indexOf('};', ap8.indexOf('var TARGETS')));
      const ids = [...new Set((tBlock.match(/'(r[aw]-[a-z0-9-]+)'/g) || []).map(s => s.slice(1, -1)))];
      const missing = ids.filter(id => !new RegExp('id="' + id + '"').test(ap8));
      ok('every TARGETS id exists in the scene HTML (' + ids.length + ' checked)',
         ids.length >= 12 && missing.length === 0, 'missing: ' + missing.join(','));
    })();
    ok('the editor exposes exactly the 11 approved variables',
       (ap8.slice(ap8.indexOf('var EDIT_VARS'), ap8.indexOf('];', ap8.indexOf('var EDIT_VARS')))
          .match(/\['--[a-z0-9-]+'/g) || []).length === 11);
  })();

  section('123. Logo → palette (v0.9.1149)');
  (function () {
    const path9 = require('path');
    const ap9 = fs.readFileSync(path9.join(__dirname, '..', 'app', 'appearance.js'), 'utf8');
    // Absence assertions run on comment-stripped source (recorded-five-times rule).
    const ap9c = ap9.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

    ok('the editor renders the logo bar and its builder',
       /rrap-logobar/.test(ap9) && /function _logoBarHtml/.test(ap9));
    ok('the drop zone accepts paste, drag-drop, AND a file picker',
       /addEventListener\('paste', _onPaste\)/.test(ap9) &&
       /addEventListener\('drop', _onDrop\)/.test(ap9) &&
       /accept="image\/\*"/.test(ap9));
    ok('…and every listener is removed again on close (no leak into the app)',
       /removeEventListener\('paste', _onPaste\)/.test(ap9) &&
       /removeEventListener\('drop', _onDrop\)/.test(ap9) &&
       /removeEventListener\('dragover', _onDrag\)/.test(ap9));

    // The extraction is pixel math on a canvas — nothing leaves the device.
    ok('palette extraction samples pixels locally (canvas getImageData)',
       /getImageData/.test(ap9c) && /function _extractColors/.test(ap9));
    ok('and makes NO network call of any kind',
       !/fetch\(/.test(ap9c) && !/XMLHttpRequest/.test(ap9c) && !/navigator\.sendBeacon/.test(ap9c));

    // The palette maps onto brand slots ONLY — status colors survive any
    // logo ("owned is green, wanted is blue" is meaning, not branding).
    const palFn = ap9.slice(ap9.indexOf('function _paletteFromColors'), ap9.indexOf('function _applyLogoPalette'));
    ok('the logo drives the 7 brand slots',
       ['--bg', '--surface', '--surface2', '--border', '--text', '--accent', '--accent2']
         .every(v => palFn.includes("'" + v + "'")));
    ok('…and never touches the status colors',
       !palFn.includes('--green') && !palFn.includes('--want') &&
       !palFn.includes('--forsale') && !palFn.includes('--accent3'));

    // Storage: downscaled PNG (transparency kept) under rr_skin_logo; the
    // palette must be applied BEFORE the storage attempt so a full
    // localStorage can never block the feature's main point.
    ok('the logo is stored downscaled as PNG under rr_skin_logo',
       /LOGO_KEY = 'rr_skin_logo'/.test(ap9) && /mx = 360/.test(ap9) &&
       /toDataURL\('image\/png'\)/.test(ap9));
    ok('palette applies before storage, so a full localStorage cannot block it',
       ap9.indexOf('_applyLogoPalette(img)', ap9.indexOf('function _rrapLogoLoad'))
         < ap9.indexOf('localStorage.setItem(LOGO_KEY', ap9.indexOf('function _rrapLogoLoad')));

    // The watermark: faint, untouchable, removable, and applied on boot
    // regardless of APPEARANCE_ENABLED (a saved look outlives the editor).
    ok('the watermark can never block a tap and stays faint',
       /pointer-events:none/.test(ap9) && /opacity:0\.05/.test(ap9));
    ok('turning the watermark off removes the element',
       /rec\.mode !== 'watermark'\) \{ if \(el\) el\.remove\(\); return; \}/.test(ap9));
    ok('the backdrop is applied at boot, outside the editor gate',
       /^\s*applyLogoBackdrop\(\);\s*\n\}\)\(\);/m.test(ap9));

    // User-facing copy never says "AI" (standing rule) — strip comments,
    // then check only quoted strings.
    (function () {
      const strings = ap9c.match(/'(?:[^'\\]|\\.)*'/g) || [];
      ok('no user-facing string says "AI"',
         !strings.some(s => /\bAI\b/.test(s)));
    })();
  })();

  section('124. Beta punch list — the pre-invite sweep (v0.9.1150)');
  (function () {
    const pathA = require('path');
    const rd = f => fs.readFileSync(pathA.join(__dirname, '..', f), 'utf8');
    const strip = s => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const sh  = rd('app/share.js'),   shc = strip(sh);
    const ap  = rd('app/app-pages.js');
    const pi  = rd('app/photo-inbox.js');
    const tu  = rd('app/tutorial.js');
    const am  = rd('app/app-misc.js'), amc = strip(am);
    const idx = rd('app/index.html'),  root = rd('index.html');

    // ── 5.2 PDF share dropped every photo ──
    ok('5.2 the share sheet reads the photo RADIOS that exist, not the dead #sf-photo checkbox',
       /input\[name="rr-photomode"\]:checked/.test(shc) && !/getElementById\('sf-photo'\)/.test(shc));
    ok('5.2 …and "All photos of item" actually fetches more than one',
       /allPhotos:/.test(shc) && /_photoExtras/.test(shc) && /p <= 4/.test(shc));
    ok('5.2 extra photos are drawn, and only when they exist (main-only layout untouched)',
       /if \(_extras\) cardH \+= 52/.test(shc) &&
       /_extras = \(fields\.allPhotos && it\._photoExtras && it\._photoExtras\.length\)/.test(shc));

    // ── 5.3 Want/Upgrade share arrived empty ──
    (function () {
      const blk = ap.slice(ap.indexOf('_shareDataMap[_wuShareKey]'), ap.indexOf('var _wuTrAttrs'));
      ok('5.3 the Want/Upgrade page registers the NESTED shape share.js reads',
         /want:\s*Object\.assign/.test(blk) && /master:\s*master/.test(blk) && /pd:\s*pd/.test(blk));
      ok('5.3 …and no longer registers the flat keys nothing consumed',
         !/listType:\s*u\.listType/.test(blk) && !/priority:\s*u\.priority/.test(blk));
      ok('5.3 group markers stay out of notes a recipient sees',
         /_wlStripGrp\(u\.notes \|\| ''\)/.test(blk));
      // The shape must match what the PDF builder actually destructures.
      ok('5.3 which is the same shape the PDF builder reads',
         /var master = it\.master \|\| \{\}/.test(sh) && /var want\s+= it\.want\s+\|\| \{\}/.test(sh));
    })();

    // ── 1.5 re-scan destroyed paid metadata ──
    (function () {
      const rs = pi.slice(pi.indexOf('window._pinRescan'), pi.indexOf('window._pinAutoReadCancel'));
      const rsc = strip(rs);
      ok('1.5 re-scan snapshots the previous read BEFORE deleting it',
         rsc.indexOf('_prevRead = JSON.parse') < rsc.indexOf('delete mm[fid]'));
      // v0.9.1151: this asserted the literal expression
      // `_hadPaid && _sameNum(_prevRead.num, r.num)`, which section 125's fix
      // replaced with the broader `_keepPaid(r.num)` (same rule, plus the
      // blank-previous-number case). Assert the CARRY-ACROSS, not the shape of
      // the condition — section 125 proves the predicate itself with real inputs.
      ok('1.5 paid detail carries across when the number comes back the same',
         /if \(_keepPaid\(r\.num\)\)/.test(rsc) &&
         /'mfr', 'desc', 'road', 'year', 'gauge', 'subType'/.test(rsc));
      ok('1.5 a failed re-scan restores the paid read instead of leaving nothing',
         /if \(_hadPaid\) \{ m\[fid\] = _prevRead; _idsSave\(m\); \}/.test(rsc));
      ok('1.5 and the user is told which of those three things happened',
         /your earlier identification has been kept/.test(rs) &&
         /were for a different item, so they were cleared/.test(rs));
    })();

    // ── 6.3 welcome card was unreachable ──
    ok('6.3 the Help Center can replay the welcome card (force flag finally has a caller)',
       /showWelcomeCard\(true\)/.test(tu));
    ok('6.3 …and the force flag still does what the caller needs',
       /function showWelcomeCard\(force\)/.test(am) && /!force && localStorage\.getItem\(WELCOME_SEEN_KEY\)/.test(amc));

    // ── §7 entry-point copy over-promised the reader ──
    ok('§7 the welcome card no longer promises the app identifies photos for you',
       !/snap a photo and let the app identify it/.test(amc));
    ok('§7 …it leads with the reliable path and calls the reader a helper',
       /type the item number/.test(amc) && /the photo reader is a helper/.test(amc));

    // ── 5.1 link previews ──
    ['index.html (landing)', 'app/index.html (app)'].forEach(function (label, i) {
      const h = i === 0 ? root : idx;
      ok('5.1 ' + label + ' carries og: + twitter: preview tags',
         /property="og:image"/.test(h) && /property="og:title"/.test(h) &&
         /name="twitter:card" content="summary_large_image"/.test(h));
      ok('5.1 ' + label + ' uses ABSOLUTE urls (crawlers do not resolve relative paths)',
         /content="https:\/\/therailroster\.com\/app\/share-card\.png"/.test(h));
    });
    ok('5.1 the 1200x630 card exists and is declared at that size',
       fs.existsSync(pathA.join(__dirname, '..', 'app', 'share-card.png')) &&
       /og:image:width" content="1200"/.test(root) && /og:image:height" content="630"/.test(root));

    // ── census landmine 14: three disagreeing "app dark" values ──
    ok('the browser chrome finally agrees with --bg (one theme-color, matching app.css)',
       (idx.match(/<meta name="theme-color"/g) || []).length === 1 &&
       /<meta name="theme-color" content="#0f1220">/.test(idx) &&
       JSON.parse(rd('app/manifest.json')).theme_color === '#0f1220');
  })();

  section('125. Pre-beta audit — blockers and the two half-fixes (v0.9.1151)');
  (function () {
    const pB = require('path');
    const rd = f => fs.readFileSync(pB.join(__dirname, '..', f), 'utf8');
    const strip = s => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const auth = rd('app/app-auth.js'), setup = rd('app/app-setup.js');
    const pin = rd('app/photo-inbox.js'), pages = rd('app/app-pages.js');

    // ── BLOCKER 1: sign-out must release the sheet, not just the login ──
    (function () {
      const so = strip(auth.slice(auth.indexOf('function handleSignOut'),
                                  auth.indexOf('function handleSignOut') + 2500));
      ['lv_personal_id', 'lv_vault_id', 'lv_photos_id', 'lv_sold_photos_id'].forEach(function (k) {
        ok('sign-out clears ' + k + ' (else the next account inherits it)',
           new RegExp("removeItem\\('" + k + "'\\)").test(so));
      });
      // The reason it matters: the sign-in fallback trusts this key blindly.
      ok('…which is exactly the key the sign-in fallback trusts',
         /state\.personalSheetId = localStorage\.getItem\('lv_personal_id'\)/.test(auth));
    })();

    // ── BLOCKER 2: a failed create must store NOTHING ──
    (function () {
      const cp = setup.slice(setup.indexOf('async function createPersonalSheet'),
                             setup.indexOf('async function createPersonalSheet') + 2600);
      const cpc = strip(cp);
      ok('sheet creation checks the response before trusting it',
         /if \(!res\.ok \|\| !data\.spreadsheetId\)/.test(cpc));
      ok('…and throws instead of storing, so "undefined" can never be persisted',
         cpc.indexOf('throw new Error') < cpc.indexOf("setItem('lv_personal_id'"));
      ok('…with a message naming the real reason',
         /data\.error && data\.error\.message/.test(cpc));
    })();

    // ── BLOCKER 3: paid reads must be invisible to the background reader ──
    (function () {
      // Both paid writers stamp rv. Find them by their signature field.
      const writers = pin.split('mfr: trim(meta.manufacturer').slice(1);
      ok('there are exactly the two known paid writers', writers.length === 2, 'found ' + writers.length);
      writers.forEach(function (w, i) {
        // rv is stamped in the same object literal, just above mfr.
        const before = pin.slice(0, pin.indexOf(w)).slice(-700);
        ok('paid writer #' + (i + 1) + ' stamps rv: READER_VER',
           /rv: READER_VER/.test(before));
        ok('paid writer #' + (i + 1) + ' also marks itself paid',
           /paid: 1/.test(before));
      });
      // And the skip test that consumes it still reads the way we assumed.
      ok('the auto-reader skips any record stamped with the current READER_VER',
         /if \(got && got\.rv === READER_VER\) return;/.test(pin));
      ok('…and would otherwise have treated an unstamped record as never-read',
         /if \(!rec\) return true;/.test(pin) && /return rec\.rv !== READER_VER;/.test(pin));
    })();

    // ── Finding 4: my 1.5 fix mishandled a paid read with no number ──
    (function () {
      const rs = pin.slice(pin.indexOf('window._pinRescan'), pin.indexOf('window._pinAutoReadCancel'));
      const rsc = strip(rs);
      ok('a blank previous number no longer counts as "a different item"',
         /var _keepPaid = function/.test(rsc) && /!_prevHadNum \|\| _sameNum/.test(rsc));
      ok('both the carry-across and the message use that same rule',
         /if \(_keepPaid\(r\.num\)\)/.test(rsc) && /_hadPaid && !_keepPaid\(r\.num\)/.test(rsc));
      ok('and the "different item" message can only fire when it is TRUE',
         !/_hadPaid && !_sameNum\(_prevRead\.num, r\.num\)/.test(rsc));
      // Prove the predicate, don't just grep it.
      (function () {
        const n = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const sameNum = (a, b) => !!n(a) && n(a) === n(b);
        const keep = (prevNum, hadPaid, newNum) => {
          const prevHadNum = !!String(prevNum || '').trim();
          return hadPaid && (!prevHadNum || sameNum(prevNum, newNum));
        };
        ok('predicate: paid read with NO number keeps its detail', keep('', true, '2408') === true);
        ok('predicate: same number keeps its detail',              keep('2408', true, '2408') === true);
        ok('predicate: a genuinely different number does not',      keep('2408', true, '6464') === false);
        ok('predicate: nothing paid, nothing to keep',              keep('2408', false, '2408') === false);
      })();
    })();

    // ── Finding 5: my 5.3 fix only reached the desktop branch ──
    (function () {
      const up = pages.slice(pages.indexOf('function buildUpgradePage'));
      const mobileStart = up.indexOf('if (isMobile) {');
      const desktopStart = up.indexOf('} else {', mobileStart);
      const mobile = up.slice(mobileStart, desktopStart);
      ok('the MOBILE Want/Upgrade cards register share data (they registered none)',
         /_shareDataMap\[_wuMKey\]/.test(mobile));
      ok('…render a checkbox and a share-card id so a tap can select',
         /share-cb-\$\{_wuMKey\}/.test(mobile) && /share-card-\$\{_wuMKey\}/.test(mobile));
      ok('…and use the SAME nested payload as the desktop branch',
         /want: Object\.assign\(\{\}, u, \{ notes: _wlStripGrp/.test(mobile) &&
         /master: master \|\| \{\}/.test(mobile));
      ok('…keyed identically, so phone and desktop selections are interchangeable',
         /'wu-' \+ \(u\.inventoryId \|\| \(\(u\.itemNum\|\|''\) \+ '-' \+ \(u\.variation\|\|''\)\)\) \+ '-' \+ \(u\.listType\|\|''\)/.test(mobile));
    })();
  })();

  section('126. Only offer what the user filters (v0.9.1152)');
  (function () {
    const pF = require('path');
    const rd = f => fs.readFileSync(pF.join(__dirname, '..', f), 'utf8');
    const cfg = rd('app/config.js'), aid = rd('app/ai-id.js');
    const pin = rd('app/photo-inbox.js'), bc = rd('app/barcode.js');
    const wp = rd('app/wizard-photos.js');

    // ── the shared resolver ──
    ok('there is ONE resolver for "what is the user filtered to"',
       /function rrActiveFilter\(photoEra\)/.test(cfg) && /window\.rrActiveFilter = rrActiveFilter/.test(cfg));
    // v0.9.1157 SUPERSEDES this. "era === 'all' means no constraint" was the
    // bug: the hierarchy chips run in 'all' mode BY DESIGN, so this early
    // return blanked the filter exactly when the user had visibly set one.
    // Left as an inverted assertion so the old shortcut cannot come back.
    ok('all-eras mode no longer means "no constraint" — superseded, see §130',
       !/if \(!era \|\| era === 'all'\) return null;/.test(cfg));
    ok('it carries maker AND scale, not just the era label',
       /manufacturer: d\.manufacturer/.test(cfg) && /scale:\s*\(typeof ERA_SCALE/.test(cfg));

    // Prove the whole filter engine against real rows, in-process.
    (function () {
      const ERAS = { mpc:{label:'Lionel MPC-Modern',years:'1970-present',manufacturer:'Lionel'},
                     mth_ho:{label:'MTH HO',manufacturer:'MTH'}, atlas:{label:'Atlas O',manufacturer:'Atlas'},
                     mth_o:{label:'MTH O',manufacturer:'MTH'} };
      const ERA_SCALE = { mpc:'O', mth_ho:'HO', atlas:'O', mth_o:'O', usatrains:'g', mth_g:'G' };
      const ERA_TABS = { mpc:{items:'Lionel MPC-Modern'}, mth_ho:{items:'MTH HO'},
                         atlas:{items:'Atlas O'}, mth_o:{items:'MTH O'} };
      let _currentEra = 'mpc';
      // No chips set: this section tests the single-era route. §130 covers what
      // happens when the chips ARE set.
      const _phState = () => ({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' });
      const window = { WHAT_I_COLLECT: {} };
      // v0.9.1157: the slice starts at the shared tables now, because
      // rrActiveFilter leans on _rrFilterForEra and rrErasMatchingChips.
      const body = cfg.slice(cfg.indexOf('var _RR_CHIP_SCALE_LABEL'), cfg.indexOf('// ── Keys that hold browseable'))
                      .replace(/if \(typeof window !== 'undefined'\) window\.\w+ = \w+;/g, '');
      // Wrap in an IIFE and hand the functions back — declaring them with `let`
      // first collides with the function declarations inside `body`.
      const api = eval('(function(){' + body
        + '\nreturn { rrActiveFilter: rrActiveFilter, rrSameScale: rrSameScale,'
        + ' rrEraOfRow: rrEraOfRow, rrSplitByFilter: rrSplitByFilter };})')();
      const rrActiveFilter = api.rrActiveFilter, rrSameScale = api.rrSameScale,
            rrSplitByFilter = api.rrSplitByFilter;
      const rows = [
        { itemNum:'8359', _tab:'Lionel MPC-Modern' },
        { itemNum:'8359', _tab:'Atlas O' },
        { itemNum:'8359', _tab:'MTH HO' },
        { itemNum:'8359', _tab:'MTH O' },
        { itemNum:'8359' },
      ];
      const s = rrSplitByFilter(rows);
      ok('engine: the filtered era\'s row is in-era', s.inEra.some(r => r._tab === 'Lionel MPC-Modern'));
      ok('engine: an untagged row is treated as in-era, never hidden on a guess',
         s.inEra.some(r => !r._tab));
      ok('engine: same-scale other eras are offered SEPARATELY, labelled',
         s.offEra.length === 2 && s.offEra.every(r => !!r._offEraLabel));
      ok('engine: a DIFFERENT SCALE is dropped outright (no HO while in O)',
         !s.offEra.some(r => r._offEra === 'mth_ho') && !s.inEra.some(r => r._tab === 'MTH HO'));
      ok('engine: scale compare survives the g/G casing split in ERA_SCALE',
         rrSameScale('g', 'G') === true);
      _currentEra = 'all';
      ok('engine: all-eras mode constrains nothing',
         rrActiveFilter() === null && rrSplitByFilter(rows).inEra.length === 5);
    })();

    // ── the AI / Lens question ──
    ok('the identify question states the maker and scale as a hard scope',
       /IMPORTANT — the collection being catalogued covers only/.test(aid) &&
       /opts\.mfrs/.test(aid) && /opts\.scale/.test(aid));
    ok('…and tells the model to declare out-of-scope rather than force a match',
       /do NOT substitute a similar item from another maker or another scale/.test(aid));

    // ── the hint builder no longer gives up without a per-photo tag ──
    (function () {
      // Bound the slice by the NEXT function, not by a character count — a
      // fixed-length slice silently stops covering the code it was written for
      // the moment the function grows (that cost four false failures in §36).
      const i0 = pin.indexOf('function _pinPreferOf');
      const pf = pin.slice(i0, pin.indexOf('async function _freeReadOne', i0));
      ok('the era hint falls back to the ACTIVE FILTER when the photo has no tag',
         /rrActiveFilter\(m\.era \|\| ''\)/.test(pf) && !/if \(!m\.era\) return null;/.test(pf));
      ok('…and a per-photo tag still wins, because it is what the resolver is asked with',
         /rrActiveFilter\(m\.era \|\| ''\)/.test(pf));
      // Behaviour, not wording: §130 drives this function for real.
    })();
    ok('the Lens/Google question is handed the maker and scale, not just the era',
       /rrIdentifyQuery\(\{ eraLabel: _lh\.eraLabel, eraYears: _lh\.eraYears,[\s\S]{0,80}mfrs: _lh\.mfrs, scale: _lh\.scale \}\)/.test(pin));
    ok('the wizard photo-identify passes era + maker + scale too',
       /mfrs: _qMfrs, scale: _qScale/.test(wp) && /eraLabel: _af \? _af\.label/.test(wp));
    ok('…with the user\'s own wizard picks winning over the filter',
       /mfrs\.length \? mfrs : \(\(_af && _af\.manufacturer\) \? \[_af\.manufacturer\] : \[\]\)/.test(wp));

    // ── the lookups ──
    ok('every master lookup passes its hits through the filter',
       (bc.match(/_rrFilterHits\(/g) || []).length >= 6);
    ok('…via the shared splitter, so one rule governs all of them',
       /function _rrFilterHits/.test(bc) && /rrSplitByFilter\(rows\)/.test(bc));
    ok('…ordering in-era first, so a caller taking hits[0] cannot get an off-era row',
       /return s\.inEra\.concat\(s\.offEra\)/.test(bc));

    // ── the picker must not present off-filter rows as normal choices ──
    ok('the candidate picker separates off-filter rows behind a divider',
       /Outside your filter/.test(bc));
    ok('…and says which era it is and that picking it switches era',
       /choosing this switches era/.test(bc));

    // ── the answer is checked against the filter, not silently accepted ──
    ok('a read whose maker contradicts the filter is flagged on the card',
       /but you are filtered to/.test(pin));
    ok('…and so is a read in the wrong scale',
       /Reads as ' \+ esc\(s\.gauge\) \+ ' scale/.test(pin));
    ok('…and the flag is actually rendered in both read-summary layouts',
       (pin.match(/_mismatch/g) || []).length >= 5);
  })();

  section('127. Barcode-read note + readable filter boxes (v0.9.1153)');
  (function () {
    const pG = require('path');
    const rd = f => fs.readFileSync(pG.join(__dirname, '..', f), 'utf8');
    const bc = rd('app/barcode.js'), css = rd('app/app.css');

    // ── Brad: "when you scan a barcode and it locks in, we need to have a note
    //    pop up that says 'bar code read, you can take picture now'" ──
    ok('there is a lock banner element on the viewfinder',
       /id="bi-lockbanner"/.test(bc) && /position:absolute/.test(
         bc.slice(bc.indexOf('id="bi-lockbanner"'), bc.indexOf('id="bi-lockbanner"') + 300)));
    ok('it says what Brad asked it to say',
       /Barcode read — you can take the picture now/.test(bc));
    ok('it is shown the moment the barcode locks, once',
       /if \(lockBanner && lockBanner\.style\.display === 'none'\)/.test(bc) &&
       /lockBanner\.style\.display = 'block'/.test(bc));
    ok('…with a single buzz, for eyes that are on the box and not the screen',
       /navigator\.vibrate\(60\)/.test(bc));
    ok('the banner element is actually looked up',
       /var lockBanner = d\.querySelector\('#bi-lockbanner'\)/.test(bc));

    // The reason no confirmation was ever visible: an unconditional overwrite.
    ok('the "Reading barcode…" line can no longer clobber the lock message',
       /if \(!heldBc\) stat\.textContent = 'Reading barcode…';/.test(bc) &&
       !/^\s+stat\.textContent = 'Reading barcode…';\s*$/m.test(bc));

    // ── Brad's screenshot: "the filter boxes can not be a dark color. they
    //    should be white background" ──
    (function () {
      // --bg-card must be a LITERAL in every scope, never an alias. An alias
      // (`--bg-card: var(--surface2)`) resolves where it is DECLARED, so :root's
      // dark value inherited into the light .main island and produced exactly
      // the unreadable dark boxes Brad photographed.
      ok('--bg-card is never declared as an alias of another variable',
         !/--bg-card:\s*var\(/.test(css));
      const scopeOf = (sel) => {
        const i = css.indexOf(sel);
        if (i < 0) return '';
        return css.slice(i, css.indexOf('\n  }', i));
      };
      const mainBlk = scopeOf('  .main {\n    --bg:');
      ok('.main (the content area in the screenshot) declares its own --bg-card',
         /--bg-card:\s*#fffdf6/.test(mainBlk));
      ok('…and it is white, not the cream surface2 or a dark value',
         !/--bg-card:\s*#f5eeda/.test(mainBlk) && !/--bg-card:\s*#1c2544/.test(mainBlk));
      ok('the light THEME scope declares it white too',
         /--bg-card:\s*#fffdf6/.test(scopeOf('html[data-theme="light"] {')));
      ok('both high-contrast scopes declare it black, so HC stays HC',
         /--bg-card:\s*#000000/.test(scopeOf('html[data-theme="high-contrast"] {')) &&
         /--bg-card:\s*#000000/.test(scopeOf('html[data-theme="high-contrast"] .main {')));
      ok('the dark :root keeps its dark card colour for overlays outside .main',
         /--bg-card:\s*#1c2544/.test(scopeOf('  :root {')));
      // Every scope that overrides --surface2 must now also set --bg-card, or
      // the alias trap comes straight back in whichever one was missed.
      // Comments stripped first — the note explaining this fix quotes
      // "--surface2: #f5eeda" and was itself counted as a declaration. That is
      // the fifth time a comment has broken one of these counts.
      const cssNoC = css.replace(/\/\*[\s\S]*?\*\//g, '');
      ok('every scope that redefines --surface2 also defines --bg-card',
         (cssNoC.match(/--surface2:/g) || []).length === (cssNoC.match(/--bg-card:/g) || []).length,
         (cssNoC.match(/--surface2:/g) || []).length + ' surface2 vs ' +
         (cssNoC.match(/--bg-card:/g) || []).length + ' bg-card');
    })();
  })();

  section('128. No new hardcoded colors — the ratchet (v0.9.1154)');
  (function () {
    // Brad: "no color should be hardcoded."
    //
    // The app has ~2,100 color literals today; converting them all at once,
    // days before beta, is exactly the kind of broad visual change that breaks
    // one screen's contrast silently. So the RULE lands now and the sweep runs
    // behind it: this ratchet records a per-file budget and fails the moment any
    // file's count goes UP. Nothing new can enter — including from me — and each
    // sweep pass lowers its file's budget permanently (update-color-budget.js
    // refuses to raise one).
    const pR = require('path');
    let counter, budget;
    try {
      counter = require('./color-count');
      budget  = require('./color-budget.json');
    } catch (e) {
      ok('the ratchet is wired up (counter + budget present)', false, String(e && e.message));
      return;
    }
    ok('the ratchet is wired up (counter + budget present)',
       !!(counter && counter.countAll && budget && budget.budgets));

    const now = counter.countAll(pR.join(__dirname, '..', 'app'));
    const over = [], missing = [];
    Object.keys(now).forEach(function (f) {
      if (!(f in budget.budgets)) { missing.push(f + ' (' + now[f] + ')'); return; }
      if (now[f] > budget.budgets[f]) over.push(f + ': ' + now[f] + ' > ' + budget.budgets[f]);
    });

    ok('no file exceeds its hardcoded-color budget',
       over.length === 0, over.join(' · '));
    ok('no file with colors is missing from the budget (a new file needs a decision)',
       missing.length === 0, missing.join(' · '));

    // The counter itself has to be trustworthy, or the ratchet is theatre.
    ok('the counter is deterministic',
       JSON.stringify(counter.countAll(pR.join(__dirname, '..', 'app'))) === JSON.stringify(now));
    ok('it ignores colors written inside comments',
       counter.stripComments('/* #ff0000 */ var a = 1; // #00ff00\n', false)
         .match(/#[0-9a-f]{3,8}/gi) === null);
    ok('…but does NOT eat code after a URL\'s double slash',
       /#abcdef/.test(counter.stripComments('var u = "https://x.y"; var c = "#abcdef";', false)));
    ok('it excludes app.css palette scopes — a palette MUST hold real values',
       now['app.css'] < 260);

    // Direction of travel: the total may only fall.
    const total = Object.keys(now).reduce(function (a, f) { return a + now[f]; }, 0);
    ok('the total is at or below the recorded budget total (' + total + ' vs ' + budget.total + ')',
       total <= budget.total);

    // The first conversion, from Brad's washed-out filter chips: text sitting on
    // an accent fill now reads the variable made for it, so a skinned accent can
    // carry a readable text colour instead of a hardcoded white.
    (function () {
      const files = ['app/browse.js', 'app/app-pages.js', 'app/wizard.js', 'app/vault.js'];
      const src = files.map(f => fs.readFileSync(pR.join(__dirname, '..', f), 'utf8')).join('\n');
      ok('white-on-accent is now var(--on-accent), not #fff',
         /background:var\(--accent\);color:var\(--on-accent\)/.test(src) &&
         !/background:var\(--accent\);color:#fff/.test(src));
      const css = fs.readFileSync(pR.join(__dirname, '..', 'app', 'app.css'), 'utf8');
      ok('…and --on-accent is a literal, so it cannot repeat the --bg-card alias trap',
         /--on-accent:\s*#[0-9a-f]{3,8}/i.test(css) && !/--on-accent:\s*var\(/.test(css));
    })();
  })();

  section('129. Prev / next through the list you came from (v0.9.1155)');
  (function () {
    const pN = require('path');
    const rd = f => fs.readFileSync(pN.join(__dirname, '..', f), 'utf8');
    const nav = rd('app/detail-nav.js');
    const coll = rd('app/app-collection.js');
    const idx = rd('app/index.html');
    const cfg = rd('app/config.js');

    ok('the module is registered, at the current ?v',
       new RegExp('detail-nav\\.js\\?v=' + (cfg.match(/APP_VERSION = 'v0\.9\.(\d+)'/) || [])[1]).test(idx));
    ok('BOTH detail pages render the nav row (items, and sets/catalogs/paper)',
       (coll.match(/id="rr-detail-nav"/g) || []).length === 2 &&
       (coll.match(/rrDetailNavHtml === 'function' \? rrDetailNavHtml\(\)/g) || []).length === 2);

    // Capture must happen in the CAPTURE phase — the inline onclick destroys
    // the list DOM, so a bubble-phase listener would find nothing left.
    ok('the list is captured in the capture phase, before the row\'s own handler',
       /addEventListener\('click', function \(e\) \{[\s\S]*?\}, true\)/.test(nav));
    ok('it stores onclick STRINGS, not DOM nodes (the list markup is about to die)',
       /call: call/.test(nav) && !/node:\s*(child|row)/.test(nav));
    ok('inner controls that stop propagation are never treated as rows',
       /stopPropagation/.test(nav) && /if \(\/stopPropagation\/\.test\(oc\)\) return false;/.test(nav));
    ok('a list of one, or a deep link, yields no arrows at all',
       /items\.length < 2/.test(nav));

    // Brad chose: stop at the ends, greyed — not wrap.
    ok('the arrows STOP at the ends rather than wrapping',
       /atStart = n\.pos <= 0/.test(nav) && /atEnd\s*= n\.pos >= n\.items\.length - 1/.test(nav) &&
       /if \(next < 0 \|\| next >= n\.items\.length\) return;/.test(nav));
    ok('…and the disabled end is visibly greyed, not just inert',
       /disabled \? 'opacity:0\.45;cursor:default;'/.test(nav.replace(/\s*\n\s*\+\s*/g, ' ')) ||
       /opacity:0\.45/.test(nav));
    ok('position is shown, so a stack of items has a sense of progress',
       /\(n\.pos \+ 1\) \+ ' of ' \+ n\.items\.length/.test(nav));
    ok('the tooltips name the actual neighbouring item',
       /'Previous: ' \+ n\.items\[n\.pos - 1\]\.label/.test(nav) &&
       /'Next: ' \+ n\.items\[n\.pos \+ 1\]\.label/.test(nav));

    // Re-running the row's own call is what preserves Want/Sale context and
    // the Back destination — nothing about origin is re-derived here.
    ok('navigation re-runs the row\'s own open call, keeping origin + wantMode intact',
       /new Function\(call\)\.call\(window\)/.test(nav));
    ok('position advances BEFORE the page redraws, so it shows its own place',
       nav.indexOf('n.pos = next;') < nav.indexOf('new Function(call)'));

    // Keyboard: helpful at a desk, must never fire under a dialog or in a field.
    ok('arrow keys work on desktop',
       /e\.key !== 'ArrowLeft' && e\.key !== 'ArrowRight'/.test(nav));
    ok('…but not while typing, not under a modal, and not off a detail page',
       /INPUT\|TEXTAREA\|SELECT/.test(nav) && /isContentEditable/.test(nav) &&
       /\[id\$="-modal"\], \[id\$="-overlay"\], #rrap/.test(nav) &&
       /getElementById\('rr-detail-nav'\)/.test(nav));

    // The rule from two versions ago still holds for the new file.
    (function () {
      const budget = require('./color-budget.json').budgets;
      const counter = require('./color-count');
      const n = counter.countFile(pN.join(__dirname, '..', 'app', 'detail-nav.js'));
      ok('the new file is inside the colour budget (no-hardcoded-colours rule)',
         n <= (budget['detail-nav.js'] || 0), n + ' vs budget ' + (budget['detail-nav.js'] || 0));
    })();

    // ── The part that actually matters: RUN it against a real DOM ──
    // Every assertion above proves the code SAYS the right thing. This drives
    // a live list through a click and both arrows and checks what it DOES.
    // jsdom is optional (installed with --no-save), so a fresh clone skips
    // this loudly rather than failing.
    (function () {
      let JSDOM;
      try { JSDOM = require('jsdom').JSDOM; }
      catch (e) {
        console.log('  SKIP  behavioural DOM run — jsdom not installed (npm i --no-save jsdom)');
        return;
      }
      const dom = new JSDOM('<!DOCTYPE html><body>'
        + '<div class="page active" id="page-upgrade"><table><tbody id="tb">'
        + '<tr><td onclick="_wantViewDetail(\'6464-475\',\'1\')"><span class="item-num">6464-475</span></td>'
        +     '<td><input type="checkbox" onclick="event.stopPropagation();toggleShareItem(\'x\')"></td></tr>'
        + '<tr><td onclick="_wantViewDetail(\'2343\',\'\')"><span class="item-num">2343</span></td></tr>'
        + '<tr><td onclick="_wantViewDetail(\'6017\',\'2\')"><span class="item-num">6017</span></td></tr>'
        + '<tr><td onclick="_wantViewDetail(\'726\',\'\')"><span class="item-num">726</span></td></tr>'
        + '</tbody></table></div><div id="rr-detail-nav"></div></body>', { runScripts: 'outside-only' });
      const w = dom.window;
      const ran = [];
      w.showToast = function () {};
      w.scrollTo = function () {};
      w._wantViewDetail = function (num, v) { ran.push(num); };
      w.eval(fs.readFileSync(pN.join(__dirname, '..', 'app', 'detail-nav.js'), 'utf8'));

      // Click the THIRD row.
      w.document.querySelectorAll('#tb tr')[2].querySelector('td[onclick]')
        .dispatchEvent(new w.Event('click', { bubbles: true }));

      const n = w._rrNav;
      ok('DOM run: the whole visible list is captured, in display order',
         !!n && n.items.length === 4 &&
         n.items.map(i => i.label).join(',') === '6464-475,2343,6017,726',
         n ? n.items.map(i => i.label).join(',') : 'nothing captured');
      ok('DOM run: the share checkbox inside a row is NOT a navigation step',
         !!n && !n.items.some(i => /stopPropagation/.test(i.call)));
      ok('DOM run: position is where the user actually clicked', !!n && n.pos === 2);
      ok('DOM run: origin is read from the active page', !!n && n.origin === 'Want / Upgrade');
      ok('DOM run: the control shows "3 of 4" and names the next item',
         /3 of 4/.test(w.rrDetailNavHtml()) && /Next: 726/.test(w.rrDetailNavHtml()));

      w.rrDetailNavGo(1);
      ok('DOM run: next opens the following item and advances position',
         w._rrNav.pos === 3 && ran.join(',') === '726');
      ok('DOM run: at the last item the next arrow is disabled',
         /disabled/.test(w.rrDetailNavHtml().split('of 4')[1] || ''));
      w.rrDetailNavGo(1);
      ok('DOM run: pressing next past the end does nothing at all',
         w._rrNav.pos === 3 && ran.length === 1);
      w.rrDetailNavGo(-1); w.rrDetailNavGo(-1); w.rrDetailNavGo(-1);
      ok('DOM run: prev walks all the way back to the first item',
         w._rrNav.pos === 0 && ran.join(',') === '726,6017,2343,6464-475');
      ok('DOM run: at the first item the prev arrow is disabled',
         /disabled/.test(w.rrDetailNavHtml().split('1 of 4')[0]));
      w.rrDetailNavGo(-1);
      ok('DOM run: pressing prev past the start does nothing at all',
         w._rrNav.pos === 0 && ran.length === 4);

      // ── Brad's For Sale bug, v0.9.1156 ──
      // "the for sale list always says 1 of 2, it wont move to the next item"
      // For Sale rows open via _openOwnedByInvId whenever the entry has an
      // inventoryId — most of them — and that opener was missing from the
      // recogniser. Only the two legacy rows were seen. This reproduces the
      // real markup: 6 with an inventoryId, 2 without.
      (function () {
        const card = (i, hasInv) => '<div onclick="' + (hasInv
              ? "window._detailReturn='forsale';_openOwnedByInvId('INV" + i + "')"
              : "window._detailReturn='forsale';showItemDetailPage(" + (100 + i) + ", '')")
            + '"><span class="item-num">ITEM-' + i + '</span>'
            + '<button onclick="event.stopPropagation();fsRemove(' + i + ')">Remove</button></div>';
        const html = [1, 2, 3, 4, 5, 6].map(i => card(i, true))
                     .concat([7, 8].map(i => card(i, false))).join('');
        const d = new JSDOM('<!DOCTYPE html><body><div class="page active" id="page-forsale">'
          + '<div id="fs-cards">' + html + '</div></div><div id="rr-detail-nav"></div></body>',
          { runScripts: 'outside-only' });
        const v = d.window;
        const opened = [];
        v.showToast = function () {}; v.scrollTo = function () {};
        v._openOwnedByInvId = function (id) { opened.push(id); };
        v.showItemDetailPage = function (i) { opened.push('idx' + i); };
        v.eval(fs.readFileSync(pN.join(__dirname, '..', 'app', 'detail-nav.js'), 'utf8'));
        const els = v.document.querySelectorAll('#fs-cards > div');

        els[2].dispatchEvent(new v.Event('click', { bubbles: true }));
        ok('For Sale: an inventoryId row is recognised (it used to give NO arrows)',
           !!v._rrNav, v._rrNav ? '' : 'still null');
        ok('For Sale: the count is the whole list, not just the legacy rows',
           !!v._rrNav && v._rrNav.items.length === 8 && v._rrNav.pos === 2,
           v._rrNav ? (v._rrNav.pos + 1) + ' of ' + v._rrNav.items.length : '-');
        v.rrDetailNavGo(1); v.rrDetailNavGo(1);
        ok('For Sale: next actually advances, in list order',
           v._rrNav.pos === 4 && opened.join(',') === 'INV4,INV5', opened.join(','));
        els[7].dispatchEvent(new v.Event('click', { bubbles: true }));
        ok('For Sale: the last row reports 8 of 8 with next disabled',
           v._rrNav.pos === 7 && /disabled/.test(v.rrDetailNavHtml().split('of 8')[1] || ''));
      })();

      // The guard that stops this class of bug being silent ever again: an
      // opener this module does not know must produce NO arrows and a warning,
      // never a confident wrong count.
      (function () {
        const d = new JSDOM('<!DOCTYPE html><body><div class="page active" id="page-forsale">'
          + '<div id="L">'
          + '<div onclick="showItemDetailPage(1)"><span class="item-num">A</span></div>'
          + '<div onclick="showItemDetailPage(2)"><span class="item-num">B</span></div>'
          + '<div onclick="_someBrandNewOpener(3)"><span class="item-num">C</span></div>'
          + '</div></div></body>', { runScripts: 'outside-only' });
        const v = d.window;
        const warns = [];
        v.console.warn = function () { warns.push(Array.prototype.join.call(arguments, ' ')); };
        v.eval(fs.readFileSync(pN.join(__dirname, '..', 'app', 'detail-nav.js'), 'utf8'));
        v.document.querySelectorAll('#L > div')[0]
          .dispatchEvent(new v.Event('click', { bubbles: true }));
        ok('an unrecognised opener yields NO arrows rather than a wrong count',
           v._rrNav === null);
        ok('…and says so in the console, so the gap is discoverable',
           warns.some(m => /recognised 2 of 3 clickable rows/.test(m)), warns.join(' | '));
      })();
    })();
  })();

  section('130. The filters actually filter (v0.9.1157)');
  // Brad: "why do the filters not work" — a screenshot of the Master Catalog
  // with Lionel / O Gauge / Modern chips set, showing Atlas rows badged LIONEL.
  // Two separate faults, both proven here by RUNNING the real functions:
  //   (a) _itemEraKey resolved an item's era by NUMBER, and catalog numbers are
  //       not unique across makers — Atlas 3300 found Lionel Pre-War 3300.
  //   (b) rrActiveFilter treated 'all' as "no constraint", but the chips run in
  //       'all' mode by design, so every reader ran unfiltered.
  (function () {
    const pH = require('path');
    const rd = f => fs.readFileSync(pH.join(__dirname, '..', f), 'utf8');
    const appS = rd('app/app.js'), cfgS = rd('app/config.js');
    const brwS = rd('app/browse.js'), pinS = rd('app/photo-inbox.js');
    const slice = (src, from, to) => {
      const a = src.indexOf(from);
      const b = src.indexOf(to, a + 1);
      if (a < 0 || b < 0) throw new Error('§130 marker moved: ' + from + ' .. ' + to);
      return src.slice(a, b);
    };
    const noExports = s => s.replace(/if \(typeof window !== 'undefined'\) window\.[\w.]+ = \w+;/g, '');

    // ── (a) an item's era, resolved from the real source ──────────────────
    (function () {
      const ERAS = {
        all:    { manufacturer: '', _isAll: true },
        prewar: { manufacturer: 'Lionel' }, pw: { manufacturer: 'Lionel' },
        mpc:    { manufacturer: 'Lionel' }, atlas: { manufacturer: 'Atlas' },
        mth_o:  { manufacturer: 'MTH' },
      };
      // The real collision from Brad's live app: two makers, one number.
      const findMaster = num => (String(num) === '3300'
        ? { itemNum: '3300', _era: 'prewar', description: 'Summer Trolley Trailer' } : null);
      const api = eval('(function(){var ERAS=arguments[0],findMaster=arguments[1];'
        + noExports(slice(appS, 'function _manufacturerOfEra', 'var _BRAND_LABELS'))
        + noExports(slice(appS, 'function _itemEraKey', 'function _pdEraEnabled'))
        + 'return {k:_itemEraKey,m:_manufacturerOfItem};})')(ERAS, findMaster);

      const atlas3300 = { itemNum: '3300', _tab: 'Atlas O', _era: 'atlas', gauge: 'O' };
      ok('a row that says it is Atlas resolves as Atlas, not as the Lionel row sharing its number',
         api.k(atlas3300) === 'atlas', String(api.k(atlas3300)));
      ok('…so the manufacturer is Atlas, which is what the badge AND the chip filter read',
         api.m(atlas3300) === 'atlas', String(api.m(atlas3300)));
      ok('the genuine Lionel Pre-War 3300 still resolves to Lionel',
         api.m({ itemNum: '3300', _era: 'prewar' }) === 'lionel');
      ok('a row with NO era stamp still falls back to the by-number lookup',
         api.k({ itemNum: '3300' }) === 'prewar', String(api.k({ itemNum: '3300' })));
      ok('an explicit manufacturer field still wins over everything',
         api.m({ itemNum: '3300', _era: 'atlas', manufacturer: 'MTH' }) === 'mth');
      ok('a row stamped with the META era \'all\' is not treated as a real era',
         api.k({ itemNum: '3300', _era: 'all' }) === 'prewar', String(api.k({ itemNum: '3300', _era: 'all' })));
      ok('an unrecognised stamp is ignored rather than trusted blindly',
         api.k({ itemNum: '3300', _era: 'not-an-era' }) === 'prewar');
      ok('a personal row\'s own `era` field is still honoured',
         api.k({ itemNum: '3300', era: 'mpc' }) === 'mpc');
      ok('and an item with no number and no stamp resolves to nothing, not to a guess',
         api.k({ description: 'mystery boxcar' }) === null);
    })();

    // ── (b) what the user is filtered to, when the filter is chips ─────────
    (function () {
      const ERAS = {
        all:    { id: 'all',    label: 'All Collection',    manufacturer: '', _isAll: true },
        prewar: { id: 'prewar', label: 'Lionel Pre-War',    years: '1901-1942',  manufacturer: 'Lionel' },
        pw:     { id: 'pw',     label: 'Lionel Postwar',    years: '1945-1969',  manufacturer: 'Lionel' },
        mpc:    { id: 'mpc',    label: 'Lionel MPC/Modern', years: '1970-Today', manufacturer: 'Lionel' },
        atlas:  { id: 'atlas',  label: 'Atlas O',           years: 'All',        manufacturer: 'Atlas' },
        mth_o:  { id: 'mth_o',  label: 'MTH O',             years: '2000-2020',  manufacturer: 'MTH' },
        mth_ho: { id: 'mth_ho', label: 'MTH HO',            years: '2006-2019',  manufacturer: 'MTH' },
      };
      const ERA_SCALE = { prewar: 'Standard', pw: 'O', mpc: 'O', atlas: 'O', mth_o: 'O', mth_ho: 'HO' };
      const ERA_TABS = { prewar: { items: 'Lionel Pre-War' }, pw: { items: 'Lionel PW - Items' },
                         mpc: { items: 'Lionel MPC-Modern' }, atlas: { items: 'Atlas O' },
                         mth_o: { items: 'MTH O' }, mth_ho: { items: 'MTH HO' } };
      const REAL_ERA_IDS = ['pw', 'mpc', 'prewar', 'atlas', 'mth_o', 'mth_ho'];
      const WIC = { MANUFACTURERS: { lionel: { label: 'Lionel' }, atlas: { label: 'Atlas' }, mth: { label: 'MTH' } } };
      // The REAL era→period map and the REAL _itemEraPeriod, lifted from
      // browse.js — so this test cannot drift from the row filter's own answer.
      const periodSrc = noExports(slice(brwS, 'var _ERA_KEY_TO_PERIOD', 'function _phState'));
      const cfgBody   = noExports(slice(cfgS, 'var _RR_CHIP_SCALE_LABEL', '// ── Keys that hold browseable'));
      const prefSrc   = noExports(slice(pinS, 'function _pinPreferOf', 'async function _freeReadOne'));
      const hintSrc   = noExports(slice(pinS, 'function _pinAiHints', '// v0.9.1092'));

      let chips = { manufacturer: 'any', scale: 'any', era: 'any', section: 'items' };
      let era   = 'all';
      const make = () => eval('(function(){'
        + 'var ERAS=arguments[0],ERA_SCALE=arguments[1],ERA_TABS=arguments[2],'
        + 'REAL_ERA_IDS=arguments[3],window=arguments[4],_currentEra=arguments[5],'
        + '_phState=arguments[6],_pinReadFile=function(g){return g.files[0];};'
        + periodSrc + cfgBody + prefSrc + hintSrc
        + 'return {f:rrActiveFilter,split:rrSplitByFilter,hits:rrErasMatchingChips,'
        + 'pref:_pinPreferOf,hints:_pinAiHints,period:_itemEraPeriod};})')(
          ERAS, ERA_SCALE, ERA_TABS, REAL_ERA_IDS, { WHAT_I_COLLECT: WIC }, era, () => chips);

      ok('sanity: the real era→period map is what this test is using',
         make().period({ _era: 'mpc' }) === 'modern' && make().period({ _era: 'pw' }) === 'postwar');

      chips = { manufacturer: 'any', scale: 'any', era: 'any', section: 'items' };
      ok('nothing selected really does mean no constraint', make().f() === null);

      // THE bug, stated as a test: era is 'all' AND the chips are set.
      chips = { manufacturer: 'lionel', scale: 'o', era: 'modern', section: 'items' };
      const f1 = make().f();
      ok('chips set + era \'all\' reports a constraint (v0.9.1152 reported none)', !!f1);
      ok('…Lionel + O + Modern names exactly one era, and it is MPC/Modern',
         !!f1 && f1.era === 'mpc', f1 ? f1.era : 'null');
      ok('…so the maker, the scale and the years are all stated to the readers',
         !!f1 && f1.manufacturer === 'Lionel' && f1.scale === 'O' && f1.years === '1970-Today',
         f1 ? [f1.manufacturer, f1.scale, f1.years].join('/') : '-');
      ok('…and it is marked as coming from the chips, not from an era switch',
         !!f1 && f1.fromChips === true && f1.period === 'modern');

      chips = { manufacturer: 'lionel', scale: 'o', era: 'postwar', section: 'items' };
      ok('Lionel + O + Postwar names Postwar, not Modern', make().f().era === 'pw');
      chips = { manufacturer: 'lionel', scale: 'standard', era: 'prewar', section: 'items' };
      ok('Lionel + Standard + Pre-War names Pre-War', make().f().era === 'prewar');
      chips = { manufacturer: 'mth', scale: 'ho', era: 'modern', section: 'items' };
      ok('MTH + HO + Modern names MTH HO', make().f().era === 'mth_ho');

      // Any Manufacturer spans several eras. The old code called that "no
      // filter"; the scale and the period are still perfectly good constraints.
      chips = { manufacturer: 'any', scale: 'o', era: 'modern', section: 'items' };
      const f2 = make().f();
      ok('Any Manufacturer + O + Modern still constrains scale and period',
         !!f2 && f2.era === '' && f2.scale === 'O' && f2.period === 'modern',
         f2 ? f2.era + '/' + f2.scale + '/' + f2.period : 'null');
      ok('…and claims no maker, because it genuinely does not know one',
         f2.manufacturer === '');
      ok('…and still reads as something a person can be shown',
         f2.label === 'O Modern', f2.label);

      chips = { manufacturer: 'lionel', scale: 'any', era: 'any', section: 'items' };
      const f3 = make().f();
      ok('Lionel alone constrains the maker and nothing else',
         f3.manufacturer === 'Lionel' && f3.era === '' && f3.scale === '' && f3.period === '',
         [f3.manufacturer, f3.era, f3.scale, f3.period].join('/'));

      // A real era selection must still win — chips are only the 'all'-mode route.
      era = 'atlas';
      chips = { manufacturer: 'lionel', scale: 'o', era: 'modern', section: 'items' };
      ok('an actual era selection outranks the chips',
         make().f().era === 'atlas', make().f().era);
      ok('a per-photo era tag outranks both',
         make().f('mth_ho').era === 'mth_ho');
      era = 'all';

      // ── the row splitter, which every master lookup goes through ─────────
      const rows = () => ([
        { itemNum: '8359', _tab: 'Lionel MPC-Modern' },   // Lionel, O, modern
        { itemNum: '8359', _tab: 'Atlas O' },             // Atlas,  O, modern
        { itemNum: '8359', _tab: 'Lionel PW - Items' },   // Lionel, O, postwar
        { itemNum: '8359', _tab: 'MTH HO' },              // MTH,    HO
        { itemNum: '8359' },                              // unknown
      ]);
      chips = { manufacturer: 'lionel', scale: 'o', era: 'modern', section: 'items' };
      const s1 = make().split(rows());
      ok('splitter: an HO row is dropped outright while filtered to O',
         !s1.inEra.concat(s1.offEra).some(r => r._tab === 'MTH HO'));
      ok('splitter: the Lionel Modern row is in-scope',
         s1.inEra.some(r => r._tab === 'Lionel MPC-Modern'));
      ok('splitter: the Atlas row is offered SEPARATELY, labelled, not as a plain answer',
         s1.offEra.some(r => r._tab === 'Atlas O' && !!r._offEraLabel) &&
         !s1.inEra.some(r => r._tab === 'Atlas O'));
      ok('splitter: an untagged row is never hidden on a guess',
         s1.inEra.some(r => !r._tab));

      chips = { manufacturer: 'any', scale: 'o', era: 'modern', section: 'items' };
      const s2 = make().split(rows());
      ok('splitter: with no maker chosen, both O modern rows are in-scope',
         s2.inEra.some(r => r._tab === 'Atlas O') && s2.inEra.some(r => r._tab === 'Lionel MPC-Modern'));
      ok('splitter: …the postwar row is set aside as off-period',
         s2.offEra.some(r => r._tab === 'Lionel PW - Items'));
      ok('splitter: …and HO is still dropped',
         !s2.inEra.concat(s2.offEra).some(r => r._tab === 'MTH HO'));

      chips = { manufacturer: 'any', scale: 'any', era: 'any', section: 'items' };
      ok('splitter: genuinely unfiltered keeps every row', make().split(rows()).inEra.length === 5);

      // ── what the photo readers are actually told ─────────────────────────
      const group = { files: [{ id: 'F1', _meta: {} }] };
      chips = { manufacturer: 'lionel', scale: 'o', era: 'modern', section: 'items' };
      const p1 = make().pref(group);
      ok('an untagged photo inherits the chip filter (this returned null before)',
         !!p1 && p1.era === 'mpc' && p1.manufacturer === 'Lionel' && p1.scale === 'O',
         p1 ? [p1.era, p1.manufacturer, p1.scale].join('/') : 'null');
      ok('…and is marked as coming from the filter rather than the photo',
         p1._fromFilter === true);
      const tagged = { files: [{ id: 'F2', _meta: { era: 'atlas' } }] };
      ok('a photo carrying its own era tag keeps it, chips or no chips',
         make().pref(tagged).era === 'atlas' && make().pref(tagged)._fromFilter === false);

      const h1 = make().hints(group);
      ok('the paid reader is told the maker, the scale and the period',
         h1.mfrs && h1.mfrs[0] === 'Lionel' && h1.scale === 'O' && /1970-Today/.test(h1.note || ''),
         JSON.stringify(h1));

      // The case the old gate threw away completely: no single era, but a
      // perfectly usable scale + period constraint.
      chips = { manufacturer: 'any', scale: 'o', era: 'modern', section: 'items' };
      const h2 = make().hints(group);
      ok('a multi-era filter still reaches the reader instead of being discarded',
         h2.scale === 'O' && /Modern/.test(h2.eraLabel || '') && !!h2.note,
         JSON.stringify(h2));
      ok('…and claims no maker it cannot know', !h2.mfrs);

      chips = { manufacturer: 'any', scale: 'any', era: 'any', section: 'items' };
      ok('an unfiltered, untagged photo is still asked with no constraint at all',
         make().pref(group) === null && Object.keys(make().hints(group)).length === 0);
    })();

    // ── the era→period map, completed (v0.9.1158) ─────────────────────────
    // An era missing from the map gets period null, and a null period is
    // excluded from EVERY period chip — so those rows were reachable only under
    // "Any Era". Measured live before the fix: 4,709 rows, of which 4,551 were
    // makers that only ever produced in one period.
    (function () {
      const cfgAll = rd('app/config.js');
      const eraIds = /const REAL_ERA_IDS = \[([^\]]+)\]/.exec(cfgAll)[1]
        .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
      const api = eval('(function(){var ERA_TABS={};'
        + noExports(slice(brwS, 'var _ERA_KEY_TO_PERIOD', 'function _phState'))
        // the derived inverse lives further down the file, next to its only caller
        + noExports(slice(brwS, 'var _PERIOD_TO_INTERNAL_ERAS', 'function _phSectionsFor'))
        + 'return {map:_ERA_KEY_TO_PERIOD,inv:_PERIOD_TO_INTERNAL_ERAS,p:_itemEraPeriod};})')();

      // The ONLY eras allowed to have no period are the ones that genuinely
      // span more than one. If a new era is added without a period, this fails.
      const SPANS = ['marx', 'other_o'];
      const unmapped = eraIds.filter(k => !api.map[k]);
      ok('every era whose production window sits in ONE period has a period',
         unmapped.length === SPANS.length && unmapped.every(k => SPANS.indexOf(k) >= 0),
         'unmapped: ' + unmapped.join(','));
      ok('…and the two that genuinely span periods are still left to yearProd',
         SPANS.every(k => !api.map[k]));

      // The makers that were silently invisible, named individually so a
      // regression says WHICH one came back.
      ['usatrains', 'lgb', 'menards', 'rmt', 'atlas_ho', 'atlas_n', 'atlas_z',
       'kline', 'williams', 'thirdrail'].forEach(k => {
        ok('a ' + k + ' row with no year now lands in Modern instead of nowhere',
           api.p({ _era: k }) === 'modern', String(api.p({ _era: k })));
      });
      ok('a real production year still outranks the era map',
         api.p({ _era: 'menards', yearProd: '1955' }) === 'postwar');
      ok('a genuinely mixed era with no year is still honestly unknown',
         api.p({ _era: 'other_o' }) === null && api.p({ _era: 'marx' }) === null);

      // The second copy of this relationship, which had already drifted.
      ok('the period→eras map is DERIVED from the era→period map, not a second copy',
         !/_PERIOD_TO_INTERNAL_ERAS = \{\s*\n\s*prewar:/.test(brwS) &&
         /_PERIOD_TO_INTERNAL_ERAS = \(function/.test(brwS));
      ok('…so the two can no longer disagree about any era',
         Object.keys(api.map).every(k => (api.inv[api.map[k]] || []).indexOf(k) >= 0) &&
         Object.keys(api.inv).every(p => api.inv[p].every(k => api.map[k] === p)));
      ok('…and the derived map now knows the makers the hand-written one missed',
         ['menards', 'usatrains', 'lgb', 'atlas_ho', 'kline'].every(k => api.inv.modern.indexOf(k) >= 0));
      ok('…while keeping MPC first, so the section chips keep their order',
         api.inv.modern[0] === 'mpc' && api.inv.postwar[0] === 'pw' && api.inv.prewar[0] === 'prewar');
    })();

    // ── one cause, both symptoms ──────────────────────────────────────────
    ok('the MFR badge and the chip filter read the SAME helper, which is why one fix cured both',
       /_mfrBadge/.test(brwS) &&
       (brwS.match(/_manufacturerOfItem\(item\)/g) || []).length >= 2);
    // Bounded by the block's real edges, not by a character budget — a comment
    // added inside it must not be able to break this.
    ok('the row filter still asks _itemEraPeriod for the period, not a second copy of the map',
       (function () {
         const blk = slice(brwS, 'Step 3b: chip-state-aware filter', 'if (road && item.roadName');
         return /_itemEraPeriod\(item\)/.test(blk) && /_stp3b\.era/.test(blk);
       })());
  })();

  section('131. A new option defaults to ON, and the option sets are complete (v0.9.1159)');
  // Brad: "yes" — fill in the makers that had eras and master tabs but could not
  // be picked. Measuring first showed the fill alone would have done nothing: his
  // saved lv_collect_mfrs held the nine makers that existed when he saved, the
  // preference is an allow-list, and a brand-new id is in nobody's list. So the
  // mechanism is what changed; the three names are just the first beneficiaries.
  (function () {
    const pJ = require('path');
    const rd = f => fs.readFileSync(pJ.join(__dirname, '..', f), 'utf8');
    const appS = rd('app/app.js'), cfgS = rd('app/config.js');
    const slice = (src, from, to) => {
      const a = src.indexOf(from), b = src.indexOf(to, a + 1);
      if (a < 0 || b < 0) throw new Error('§131 marker moved: ' + from + ' .. ' + to);
      return src.slice(a, b);
    };
    // The REAL config object, evaluated from its own file.
    const WIC = new Function('window', rd('app/onboarding-config.js') + '\n; return WHAT_I_COLLECT;')({});

    const store = {};
    const LS = { getItem: k => (k in store ? store[k] : null),
                 setItem: (k, v) => { store[k] = String(v); },
                 removeItem: k => { delete store[k]; } };
    const ERAS_STUB = { all: {}, pw: {}, mpc: {}, prewar: {} };
    const api = new Function('localStorage', 'WHAT_I_COLLECT', 'ERAS',
        slice(appS, 'function _prefEnabled', '// ── Era preferences')
      + slice(appS, 'function _getEnabledEras', '// v0.9.934 ─ Time-period helpers')
      + slice(appS, 'function _allScaleIds', 'function _scaleOfEra')
      + slice(appS, 'function _allManufacturerIds', 'function _manufacturerOfEra')
      + 'return { pref:_prefEnabled, mfrs:_getEnabledManufacturers,'
      + ' setMfrs:_setEnabledManufacturers, mfrOn:_isManufacturerEnabled,'
      + ' scales:_getEnabledScales, setScales:_setEnabledScales, scaleOn:_isScaleEnabled,'
      + ' eras:_getEnabledEras, setEras:_setEnabledEras };')(LS, WIC, ERAS_STUB);

    const ALL_M = Object.keys(WIC.MANUFACTURERS);
    const NEW_M = ['k-line', 'williams', 'marx'];

    // ── the mechanism ──
    Object.keys(store).forEach(k => delete store[k]);
    ok('a user who never chose has every manufacturer enabled',
       api.mfrs().length === ALL_M.length);

    // Brad's ACTUAL saved value, copied out of his browser.
    store['lv_collect_mfrs'] = JSON.stringify(
      ['lgb', '3rd rail', 'lionel', 'mth', 'usa trains', 'atlas', 'weaver', 'rmt', 'menards']);
    NEW_M.forEach(m => {
      ok('with Brad\'s real saved list, ' + m + ' is enabled (it was hidden before)',
         api.mfrOn(m) === true);
    });
    ok('…and his nine existing choices are untouched',
       ['lionel', 'mth', 'atlas', 'weaver', 'rmt', 'menards', '3rd rail', 'usa trains', 'lgb']
         .every(m => api.mfrOn(m)));

    // The half of this that matters most: a real opt-out must SURVIVE.
    store['lv_collect_mfrs'] = JSON.stringify(['lionel']);
    ok('a deliberate opt-out is still respected — MTH stays off',
       api.mfrOn('mth') === false && api.mfrOn('atlas') === false);
    ok('…while the genuinely new makers are still switched on',
       NEW_M.every(m => api.mfrOn(m)));

    // Once a roster exists it is used in preference to the historical baseline.
    store['lv_collect_mfrs'] = JSON.stringify(['lionel']);
    store['lv_collect_mfrs_roster'] = JSON.stringify(ALL_M);   // saw everything, chose one
    ok('a user who saw the new makers and left them off keeps them off',
       NEW_M.every(m => api.mfrOn(m) === false));
    ok('…which is the whole point: the roster distinguishes "off" from "did not exist"',
       api.mfrOn('lionel') === true);

    // Saving records what the user was shown, so the NEXT addition works too.
    Object.keys(store).forEach(k => delete store[k]);
    api.setMfrs(['lionel', 'mth']);
    ok('saving writes the roster alongside the choice',
       JSON.parse(store['lv_collect_mfrs_roster']).length === ALL_M.length &&
       JSON.parse(store['lv_collect_mfrs']).join() === 'lionel,mth');
    api.setScales(['o']);
    ok('…and the same for scales',
       JSON.parse(store['lv_collect_scales_roster']).join() === Object.keys(WIC.SCALES).join());
    api.setEras(['pw']);
    ok('…and for eras',
       JSON.parse(store['lv_collect_eras_roster']).join() === Object.keys(ERAS_STUB).join());

    // Degenerate stored values must not lock a user out of their own collection.
    Object.keys(store).forEach(k => delete store[k]);
    store['lv_collect_mfrs'] = '[]';
    ok('an empty saved list means "not chosen", not "nothing enabled"',
       api.mfrs().length === ALL_M.length);
    store['lv_collect_mfrs'] = '{not json';
    ok('unparseable preference data falls back to everything on, never to nothing',
       api.mfrs().length === ALL_M.length);

    // No baseline for eras => nothing counts as new => behaviour unchanged.
    Object.keys(store).forEach(k => delete store[k]);
    store['lv_collect_eras'] = JSON.stringify(['pw']);
    ok('with no baseline recorded, nothing is treated as new (the safe direction)',
       api.eras().join() === 'pw');

    // ── the option sets themselves ──
    const eraIds = /const REAL_ERA_IDS = \[([^\]]+)\]/.exec(cfgS)[1]
      .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    const eraMfr = {};
    eraIds.forEach(k => {
      const m = new RegExp("\\b" + k + ":\\s*\\{[^}]*manufacturer:\\s*'([^']*)'").exec(cfgS);
      if (m) eraMfr[k] = m[1].toLowerCase();
    });
    const missing = eraIds.filter(k => eraMfr[k] && ALL_M.indexOf(eraMfr[k]) < 0);
    ok('every maker that has an era can also be PICKED as a manufacturer',
       missing.length === 0, 'unpickable: ' + missing.map(k => eraMfr[k] + '(' + k + ')').join(','));
    const orphans = ALL_M.filter(m => !Object.keys(eraMfr).some(k => eraMfr[k] === m));
    ok('…and no manufacturer option exists that no era uses (catches a key typo)',
       orphans.length === 0, 'orphans: ' + orphans.join(','));

    // The trap that would hide 17,596 Atlas N/Z rows completely: naming a scale
    // in ERA_TO_SCALE that has no matching option in SCALES.
    const badScale = Object.keys(WIC.ERA_TO_SCALE)
      .filter(k => WIC.ERA_TO_SCALE[k] && !WIC.SCALES[WIC.ERA_TO_SCALE[k]]);
    ok('every scale an era claims is a real, selectable scale option',
       badScale.length === 0,
       badScale.map(k => k + '->' + WIC.ERA_TO_SCALE[k]).join(','));
    const noScale = eraIds.filter(k => !(k in WIC.ERA_TO_SCALE));
    ok('EVERY era now has a scale — no era is missing from the table',
       noScale.length === 0, 'no scale: ' + noScale.join(','));
    ok('Pre-War is explicitly null (mixed scale), not merely absent',
       ('prewar' in WIC.ERA_TO_SCALE) && WIC.ERA_TO_SCALE.prewar === null);

    // PREF_BASELINE is history. If someone "helpfully" updates it, the next new
    // option stops defaulting on — so assert it stays a snapshot.
    ok('PREF_BASELINE does NOT list the makers added in this version',
       NEW_M.every(m => WIC.PREF_BASELINE.manufacturers.indexOf(m) < 0));
    ok('…and everything it does list is still a real option',
       WIC.PREF_BASELINE.manufacturers.every(m => ALL_M.indexOf(m) >= 0) &&
       WIC.PREF_BASELINE.scales.every(s => !!WIC.SCALES[s]));
    ok('the new makers carry no dead colour literal (nothing reads that field)',
       NEW_M.every(m => !('color' in WIC.MANUFACTURERS[m])));

    // ── N and Z scale (v0.9.1160, Brad approved) ──────────────────────────
    // 17,554 Atlas N + 42 Atlas Z rows had no scale option, so they were
    // reachable only under "Any Scale". This could ONLY be added safely after
    // v0.9.1159 made a new option default to on — before that it would have
    // hidden all 17,596 from anyone holding a saved scale list.
    ok('N and Z are selectable scales with real labels',
       !!WIC.SCALES.n && !!WIC.SCALES.z &&
       WIC.SCALES.n.label === 'N Scale' && WIC.SCALES.z.label === 'Z Scale');
    ok('…and the Atlas N / Z eras now claim them',
       WIC.ERA_TO_SCALE.atlas_n === 'n' && WIC.ERA_TO_SCALE.atlas_z === 'z');

    // The interaction that makes this safe, driven for real: a user holding the
    // pre-v1160 five-scale list must come out with N and Z ON, not hidden.
    Object.keys(store).forEach(k => delete store[k]);
    store['lv_collect_scales'] = JSON.stringify(['o', 'ho', 's', 'g', 'standard']);
    ok('a saved five-scale list gets N and Z switched on, not hidden',
       api.scaleOn('n') === true && api.scaleOn('z') === true);
    ok('…and a user who had turned HO off still has it off',
       (function () {
         store['lv_collect_scales'] = JSON.stringify(['o', 's', 'g', 'standard']);
         return api.scaleOn('ho') === false && api.scaleOn('n') === true;
       })());
    ok('PREF_BASELINE.scales stays the historical five — that is what makes N/Z new',
       WIC.PREF_BASELINE.scales.length === 5 &&
       WIC.PREF_BASELINE.scales.indexOf('n') < 0 && WIC.PREF_BASELINE.scales.indexOf('z') < 0);

    // The gauge-column parse, for rows in a mixed era that name N or Z themselves.
    (function () {
      const sc = new Function('WHAT_I_COLLECT', '_itemEraKey',
          slice(appS, 'function _scaleOfEra', '// ── Session 137')
        + 'return _scaleOfItem;')(WIC, () => null);
      ok('a bare "N" in the Gauge column reads as N scale (the real Atlas value)',
         sc({ gauge: 'N' }) === 'n' && sc({ gauge: 'Z' }) === 'z');
      ok('…as does the stray "N Scale" spelling found in one live row',
         sc({ gauge: 'N Scale' }) === 'n');
      ok('…and O-gauge variants are untouched by the new branches',
         sc({ gauge: 'O' }) === 'o' && sc({ gauge: 'O-27' }) === 'o' &&
         sc({ gauge: 'HO Scale' }) === 'ho' && sc({ gauge: '' }) === null);
    })();
  })();

  section('132. An unknown period shows everywhere, not nowhere (v0.9.1161)');
  // Brad chose "show under every period". Marx (1930-1975) and Other O Brands
  // genuinely span periods, so a row of theirs with no printed production year has
  // no period — and `null !== 'modern'` was excluding it from ALL THREE period
  // chips. An item he owns could be missing from a list with nothing to explain it.
  (function () {
    const pK = require('path');
    const rd = f => fs.readFileSync(pK.join(__dirname, '..', f), 'utf8');
    const cfgS = rd('app/config.js');
    // Take a NARROW slice of each filter and strip only line comments inside it.
    // A whole-file comment strip is what broke the first draft of this section:
    // app-pages.js contains a "/*" inside other code, so the block-comment regex
    // swallowed everything up to the next "*/" — including the line under test.
    // Sixth time this class has bitten. Small slices, no global stripping.
    const codeOf = (file, from, to) => {
      const src = rd(file), a = src.indexOf(from), b = src.indexOf(to, a + 1);
      if (a < 0 || b < 0) throw new Error('§132 marker moved in ' + file);
      return src.slice(a, b).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    };
    const brwBlk = codeOf('app/browse.js', 'Step 3b: chip-state-aware filter',
                                           'if (road && item.roadName');
    const wantBlk = codeOf('app/app-pages.js', 'Session 155: user-selected era period filter',
                                               '// Priority filter');

    ok('the browse chip filter hides a row only on a KNOWN period mismatch',
       /if \(_itmPeriod && _itmPeriod !== _stp3b\.era\) return false;/.test(brwBlk));
    ok('…and the old form that hid every unknown period is gone',
       !/if \(_itmPeriod !== _stp3b\.era\) return false;/.test(brwBlk));
    ok('the Want list uses the SAME rule, so one item cannot behave two ways',
       /if \(_wPeriod && _wPeriod !== _we\) return false;/.test(wantBlk));
    ok('…and a hand-typed want with no catalog match is no longer dropped outright',
       !/if \(!_wMaster\) return false;/.test(wantBlk));
    ok('each of the two period filters asks the shared helper exactly once',
       (brwBlk.match(/_itemEraPeriod\(item\)/g) || []).length === 1 &&
       (wantBlk.match(/_itemEraPeriod\(_wMaster\)/g) || []).length === 1);

    // Behaviour: the lookup splitter, run for real, must agree with the lists.
    (function () {
      // Enough modern O eras that "Any Manufacturer + O + Modern" does NOT resolve
      // to a single era — otherwise the splitter takes its era-identity branch and
      // this stops testing the period logic at all. (First draft had three eras,
      // 'any' resolved uniquely to mpc, and the test failed for the wrong reason.)
      const ERAS = { mpc:   { label: 'Lionel MPC/Modern', manufacturer: 'Lionel' },
                     pw:    { label: 'Lionel Postwar',    manufacturer: 'Lionel' },
                     atlas: { label: 'Atlas O',           manufacturer: 'Atlas' },
                     mth_o: { label: 'MTH O',             manufacturer: 'MTH' },
                     marx:  { label: 'Marx O',            manufacturer: 'Marx' } };
      const ERA_SCALE = { mpc: 'O', pw: 'O', atlas: 'O', mth_o: 'O', marx: 'O' };
      const ERA_TABS = { mpc: { items: 'Lionel MPC-Modern' }, pw: { items: 'Lionel PW - Items' },
                         atlas: { items: 'Atlas O' }, mth_o: { items: 'MTH O' },
                         marx: { items: 'Marx O' } };
      const REAL_ERA_IDS = ['pw', 'mpc', 'atlas', 'mth_o', 'marx'];
      const noExports = s => s.replace(/if \(typeof window !== 'undefined'\) window\.[\w.]+ = \w+;/g, '');
      const a = cfgS.indexOf('var _RR_CHIP_SCALE_LABEL'), b = cfgS.indexOf('// ── Keys that hold browseable');
      const chips = { manufacturer: 'any', scale: 'o', era: 'modern', section: 'items' };
      // The REAL _itemEraPeriod out of browse.js, not an imitation. Marx has no
      // entry in the real era→period map by design, so a Marx row with no year
      // has no period — exactly the row this decision is about. A hand-written
      // stand-in got this wrong (it ignored the _tab fallback and reported EVERY
      // tab-only row as unknown), which is why it is loaded from source instead.
      const brwRaw = rd('app/browse.js');
      const pa = brwRaw.indexOf('var _ERA_KEY_TO_PERIOD'), pb = brwRaw.indexOf('function _phState');
      const period = new Function('ERA_TABS',
        noExports(brwRaw.slice(pa, pb)) + 'return _itemEraPeriod;')(ERA_TABS);
      ok('sanity: the real period helper reads the _tab fallback and has no Marx entry',
         period({ _tab: 'Lionel PW - Items' }) === 'postwar' &&
         period({ _tab: 'Lionel MPC-Modern' }) === 'modern' &&
         period({ _tab: 'Marx O' }) === null);
      const api = new Function('ERAS', 'ERA_SCALE', 'ERA_TABS', 'REAL_ERA_IDS', 'window',
          '_currentEra', '_phState', '_itemEraPeriod',
          noExports(cfgS.slice(a, b)) + 'return rrSplitByFilter;')(
          ERAS, ERA_SCALE, ERA_TABS, REAL_ERA_IDS, { WHAT_I_COLLECT: {} },
          'all', () => chips, period);
      const s = api([
        { itemNum: '1', _tab: 'Lionel MPC-Modern' },   // modern  → in
        { itemNum: '2', _tab: 'Lionel PW - Items' },   // postwar → set aside
        { itemNum: '3', _tab: 'Marx O' },              // unknown → in
      ]);
      ok('splitter: a Marx row with no year counts as in-scope under Modern',
         s.inEra.some(r => r._tab === 'Marx O'), 'off-era: ' + s.offEra.map(r => r._tab).join(','));
      ok('splitter: a row with a KNOWN different period is still set aside',
         s.offEra.some(r => r._tab === 'Lionel PW - Items'));
      ok('splitter: and the matching row is untouched',
         s.inEra.some(r => r._tab === 'Lionel MPC-Modern'));
    })();
  })();

  section('133. Reference links are named for the site they go to (v0.9.1162)');
  // Brad: "why doesn't the prewar items not reference the cott website". They do —
  // 2,088 of 2,837 Pre-War rows carry a COTT link. The app just called all of them
  // "External", because it tested the URL for 'centerlineoftrains' or 'cott' and
  // COTT is Cornucopia Of Toy Trains: cornucopiaoftoytrains.com contains neither.
  (function () {
    const pL = require('path');
    const brwS = fs.readFileSync(pL.join(__dirname, '..', 'app', 'browse.js'), 'utf8');
    const a = brwS.indexOf('var _SITE_LABELS'), b = brwS.indexOf('if (typeof window', a);
    if (a < 0 || b < 0) throw new Error('§133 marker moved');
    const label = new Function(brwS.slice(a, b) + 'return _externalSiteLabel;')();

    // Every reference domain actually present in the live catalog, with the row
    // count measured 2026-07-30. A domain the app cannot name is a link the user
    // is asked to trust blind.
    [['https://cornucopiaoftoytrains.com/prewar-no-254-engines/#21', 'COTT', 5811],
     ['https://archive.atlasrr.com/product/3300', 'Atlas', 46527],
     ['https://www.mthtrains.com/products/30-1234', 'MTH', 37318],
     ['https://www.lionel.com/search?query=6-8359', 'Lionel', 14531],
     ['https://www.trainz.com/products/usa-trains-10627-g-boxcar', 'Trainz', 3768],
     ['http://www.readymadetoys.com/rn.html', 'RMT', 416],
     ['https://www.tandem-associates.com/lionel/lionel_trains_025_acc.htm', 'Tandem Associates', 154],
     ['https://web.archive.org/web/20170406/http://3rdrail.com/x.html#ACE3001', 'Web Archive', 180],
    ].forEach(function (t) {
      ok(t[1] + ' links say "' + t[1] + '" (' + t[2].toLocaleString() + ' rows)',
         label(t[0]) === t[1], label(t[0]));
    });

    // The bug, stated so it cannot come back.
    ok('a COTT link is no longer called "External"',
       label('https://cornucopiaoftoytrains.com/anything') !== 'External');

    // Matching on the hostname, not the whole URL. Both of these were real
    // mislabels: the app's own Google fallback for a Lionel row IS a google.com
    // URL with 'Lionel' in the query, and 'cott' is a substring of other hosts.
    ok('the Google fallback is called Google, not Lionel, despite the query text',
       label('https://www.google.com/search?q=Lionel%20021%20Switches') === 'Google');
    ok('a host that merely CONTAINS the letters c-o-t-t is not called COTT',
       label('https://scottsdale-trains.example.com/item/70') === 'External');
    ok('a path that mentions a site does not decide the label',
       label('https://example.com/redirect?to=cornucopiaoftoytrains.com') === 'External');

    ok('no link at all stays "External" rather than throwing',
       label('') === 'External' && label(null) === 'External');
    ok('a malformed URL falls back to the old whole-string match rather than crashing',
       label('cornucopiaoftoytrains.com/no-scheme') === 'COTT');
  })();

  section('134. A declined read is not reported as a broken one (v0.9.1163)');
  // Brad: "our read this photo doesn't work". It worked. His "use my daily photo
  // ID reads" switch was off, so aiIdentifyImage2 returned {ok:false,
  // reason:'optout'} without contacting the reader — nothing sent, nothing spent.
  // The Photo Inbox knew only 'quota' and 'noconsent', so it said "Could not read
  // that photo — try Google Search": a fault that did not exist, and no mention of
  // the switch that did. The switch also lived ONLY in the crop modal.
  (function () {
    const pM = require('path');
    const rd = f => fs.readFileSync(pM.join(__dirname, '..', f), 'utf8');
    const aid = rd('app/ai-id.js'), pin = rd('app/photo-inbox.js'), pf = rd('app/prefs.js');
    const sliceTo = (src, from, to) => {
      const a = src.indexOf(from), b = src.indexOf(to, a + 1);
      if (a < 0 || b < 0) throw new Error('§134 marker moved: ' + from);
      return src.slice(a, b);
    };

    // ── the one message source, run for real ──
    const msg = new Function(
      sliceTo(aid, 'var _RR_READ_FAIL', 'if (typeof window') + 'return rrReadFailMessage;')();
    ok('a switched-off read says it is switched off, and where to change it',
       /switched off/.test(msg('optout')) && /Preferences/.test(msg('optout')), msg('optout'));
    ok('…and does NOT tell the user the photo could not be read',
       !/could not read/i.test(msg('optout')));
    ok('an exhausted allowance still says so',
       /No photo reads left today/.test(msg('quota')));
    ok('a busy reader and a dead connection are told apart',
       /busy/.test(msg('busy')) && /connection/.test(msg('offline')) &&
       msg('busy') !== msg('offline'));
    ok('a reason that already showed its own dialog stays silent',
       msg('noconsent') === '');
    ok('a genuine unreadable photo keeps the original wording',
       /Could not read that photo/.test(msg('error')) &&
       /Could not read that photo/.test(msg(undefined)));
    ok('…and a caller can supply its own wording for that case only',
       msg('error', 'type the number instead') === 'type the number instead' &&
       msg('optout', 'type the number instead') !== 'type the number instead');

    // ── every Photo Inbox read button uses it ──
    // Three read paths: the screenshot reader, "Read this photo", and the batch.
    ok('all three Photo Inbox read paths go through the shared resolver',
       (pin.match(/rrReadFailMessage\(/g) || []).length === 3,
       'found ' + (pin.match(/rrReadFailMessage\(/g) || []).length + ', want 3');
    ok('…each guarded, so an old cached ai-id.js cannot break the Inbox',
       (pin.match(/typeof rrReadFailMessage === 'function'/g) || []).length === 3);
    ok('none of them still carries its own two-reason list',
       !/if \(why === 'quota'\)/.test(pin) && !/var why = ai && ai\.reason;/.test(pin));

    // The batch: a reason that will fail identically for every remaining group
    // must STOP the run. With reads off it used to grind through all 59 photos.
    (function () {
      const blk = sliceTo(pin, 'the batch used to break on', 'if (ai.ok && ai.text)');
      ok('the batch stops on a reason that cannot change mid-run, not just on quota',
         /'quota'/.test(blk) && /'optout'/.test(blk) && /'offline'/.test(blk) && /break;/.test(blk));
    })();

    // ── the button must not quote a price it will not charge ──
    // v0.9.1168 supersedes the count. The re-enable path no longer re-states the
    // label: _pinBtnBusy returns a restore function that puts back whatever was
    // there, so the wording lives in exactly ONE place — the render. Two copies of
    // a label is how they drift; one is the point.
    ok('the read button says reads are off instead of "(1 token)"',
       (pin.match(/Read this photo \(reads are off\)/g) || []).length === 1,
       'found ' + (pin.match(/Read this photo \(reads are off\)/g) || []).length + ', want 1 (render only)');
    ok('...and the button is restored by the busy helper, not by re-typing the label',
       /if \(typeof _idBusy === 'function'\) _idBusy\(\);/.test(pin));
    ok('the token line says what is true when reads are off',
       /Photo reads are switched off — Preferences/.test(pin));
    ok('…and it uses a theme variable, no new colour literal',
       /color:var\(--warn\)/.test(pin) && !/var\(--warn,#/.test(pin));

    // ── the switch is findable ──
    ok('the switch now has a home in Preferences, not only the crop modal',
       /Photo ID<\/div>/.test(pf) && /pref-ai-opt/.test(pf) &&
       /_togglePrefPhotoReads/.test(pf));
    ok('…and writes through the SAME setter the crop modal uses (one stored flag)',
       /rrAiSetOptOut\(!on\)/.test(pf) &&
       /rrAiSetOptOut/.test(rd('app/barcode.js')));
    ok('…with the checkbox reflecting the CURRENT setting rather than defaulting on',
       /rrAiOptedOut\(\)\) \? '' : 'checked'/.test(pf));
  })();

  section('135. The reader\'s WORDS rescue a wrong number (v0.9.1164)');
  // Brad's M-K-T Legacy 0-8-0, with Google's answer beside it. The paid read
  // named the item exactly — "M-K-T LEGACY 0-8-0 #43" is the catalog description
  // of Lionel 2631200, near-verbatim — then attached 20-3151-1, which is an MTH
  // Union Pacific 0-8-0. Brad confirmed: "it is a lionel".
  //
  // _pinReconcileAiNum only ever searched for NUMBERS, and no number in that
  // answer leads to 2631200, so the rescue could not have worked. Meanwhile
  // _pinDescMatch — which scores rows by rarity-weighted word overlap — was
  // wired into the FREE OCR path only. The read that costs a token could not use
  // the app's best tool.
  (function () {
    // A catalog with the real word-frequency profile, measured live against
    // Brad's 23,236 Lionel-modern rows:
    //   M-K-T 1 row · MISSOURI-KANSAS-TEXAS 77 · LEGACY 735 · SWITCHER 298 · 0-8-0 81
    // The frequencies are what decide this, so the filler is not padding — a word
    // carried by 60+ rows scores ZERO, which is why only M-K-T can win.
    const ROWS = [
      { itemNum:'2631200', _era:'mpc', _tab:'Lionel MPC-Modern', description:'M-K-T LEGACY 0-8-0 #43', roadName:'' },
      { itemNum:'11274', _era:'mpc', _tab:'Lionel MPC-Modern', description:'MKT USRA 0-8-0 Steam Switcher "46," CC', roadName:'Missouri-Kansas-Texas' },
      { itemNum:'11275', _era:'mpc', _tab:'Lionel MPC-Modern', description:'MKT 0-8-0 Steam Switcher "51," CC', roadName:'Missouri-Kansas-Texas' },
    ];
    for (let i = 0; i < 80; i++) {
      ROWS.push({ itemNum: 'F' + i, _era:'mpc', _tab:'Lionel MPC-Modern',
                  description:'LEGACY 0-8-0 Steam Switcher filler ' + i,
                  roadName:'Missouri-Kansas-Texas' });
    }
    const M = new Map();
    ROWS.forEach(r => { M.set(r.itemNum, [r]); });
    global.state = { masterByItem: M, personalData: {} };
    global.window.state = global.state;

    const READ = 'Lionel Missouri-Kansas-Texas Railroad M-K-T LEGACY 0-8-0 #43 '
               + 'steam switcher locomotive and tender (2023)';

    // Sanity: the frequencies really do zero out every word except M-K-T, so this
    // case genuinely rests on one short, unique road abbreviation.
    const dm = window.__DescMatch(READ, { era: 'mpc' });
    ok('the words identify Lionel 2631200 — the item Google named and Brad confirmed',
       !!dm && dm.row && dm.row.itemNum === '2631200',
       dm ? JSON.stringify(dm.row.itemNum) : 'null — no match at all');
    ok('…on the strength of M-K-T, which names exactly one row in the era',
       !!dm && (dm.words || []).indexOf('M-K-T') >= 0, dm ? (dm.words || []).join(',') : '-');

    // A short road abbreviation is an identity; a short ordinary word is not.
    ok('a generic short word still identifies nothing',
       !window.__DescMatch('STEAM SWITCHER LOCOMOTIVE', { era: 'mpc' }));
    ok('…and neither does a lone short word that is NOT near-unique',
       !window.__DescMatch('LEGACY', { era: 'mpc' }));

    // The reconciler: the reader's number is real but belongs to another maker.
    global.findMaster = (n) => {
      const k = String(n);
      if (k === '2631200') return { itemNum:'2631200', _era:'mpc' };
      if (k === '20-3151-1') return { itemNum:'20-3151-1', _era:'mth_o' };   // MTH, wrong era
      return null;
    };
    const rc = window.__Reconcile(
      { itemNum: '20-3151-1', description: READ }, READ, { era: 'mpc', manufacturer: 'Lionel' });
    ok('the paid read is reconciled to the Lionel row instead of keeping the MTH number',
       rc && rc.num === '2631200', rc ? rc.num : 'null');
    ok('…and remembers what it replaced, so the card can show the swap',
       rc && rc.swappedFrom === '20-3151-1', rc ? String(rc.swappedFrom) : '-');
    ok('…flagged as matched on the WORDS, so it is offered rather than asserted',
       rc && !!rc.viaDesc && /M-K-T/.test(String(rc.viaDesc)), rc ? String(rc.viaDesc) : '-');
    ok('…naming the row it landed on, so a glance can confirm it',
       rc && /M-K-T LEGACY 0-8-0/.test(String(rc.descOf || '')), rc ? String(rc.descOf) : '-');

    // A number that is already right must never be second-guessed by words.
    const rcOk = window.__Reconcile(
      { itemNum: '2631200', description: READ }, READ, { era: 'mpc', manufacturer: 'Lionel' });
    ok('a number already correct is left alone — no word search, no swap',
       rcOk && rcOk.num === '2631200' && !rcOk.swappedFrom && !rcOk.viaDesc,
       JSON.stringify(rcOk));

    // And with no catalog to search it must decline rather than invent.
    ok('with no era to search, the word rescue does not fire',
       (function () { const r = window.__Reconcile({ itemNum:'20-3151-1' }, READ, null);
                      return r && r.num === '20-3151-1' && !r.viaDesc; })());

    // ── OFFERED, NEVER ASSERTED ──────────────────────────────────────────
    // A word match overrides a number the reader said out loud. Swapping it
    // silently, or marking it settled, would be worse than not swapping at all.
    // All three consumers of the reconciler must treat it as a best guess and
    // pass the evidence to the card.
    (function () {
      const pN2 = require('path');
      const src = fs.readFileSync(pN2.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
      const consumers = src.match(/if \(_rc0\.viaDesc\)|if \(_rcB\.viaDesc\)|if \(rc\.viaDesc\)/g) || [];
      ok('all three reconciler consumers branch on a word match',
         consumers.length === 3, 'found ' + consumers.length + ': ' + consumers.join(' '));
      ok('…and none of them still marks every swap as settled',
         !/meta\.itemNum = _rc0\.num;\s*\n\s*meta\._hedge = 0;/.test(src) &&
         !/e\.num = rc\.num;\s*\n\s*e\.guess = 0;/.test(src));
      // The evidence has to reach the SAME fields the free path's disclosure
      // reads, or the swap is silent even though the data exists.
      ok('the words and the matched row are stored for the card to show',
         (src.match(/viaDesc: !!\(meta && meta\._viaDesc\)|viaDesc: !!meta\._viaDesc|e\.viaDesc = true/g) || []).length === 3,
         'stores: ' + (src.match(/viaDesc: !!\(meta && meta\._viaDesc\)|viaDesc: !!meta\._viaDesc|e\.viaDesc = true/g) || []).length);
      ok('…and the existing "Matched on the words" disclosure reads those fields',
         /s\.viaDesc && s\.descOf/.test(src) && /dbg\.viaDesc \?/.test(src));
    })();
  })();

  section('136. The rescue runs under "Any Era" too (v0.9.1165)');
  // Measured in Brad's live app: his chips were Lionel › O Gauge › ANY ERA, which
  // spans two internal eras (pw + mpc), so rrActiveFilter reports era:'' — "not
  // one era". Every consumer read that as "no catalog to search" and returned on
  // the first line, so the number rescue, the quote rescue and the word rescue
  // were ALL inert. His M-K-T read kept an MTH number while 2631200 sat in its
  // own saved text. The unfinished half of v0.9.1157.
  (function () {
    const pO = require('path');
    const rd = f => fs.readFileSync(pO.join(__dirname, '..', f), 'utf8');
    const cfgS = rd('app/config.js');

    // ── the resolver names the eras it covers ──
    (function () {
      const ERAS = {
        all:   { label:'All', manufacturer:'', _isAll:true },
        pw:    { label:'Lionel Postwar',    years:'1945-1969',  manufacturer:'Lionel' },
        mpc:   { label:'Lionel MPC/Modern', years:'1970-Today', manufacturer:'Lionel' },
        prewar:{ label:'Lionel Pre-War',    years:'1901-1942',  manufacturer:'Lionel' },
        mth_o: { label:'MTH O',             years:'2000-2020',  manufacturer:'MTH' },
      };
      const ERA_SCALE = { pw:'O', mpc:'O', prewar:'Standard', mth_o:'O' };
      const ERA_TABS  = { pw:{items:'Lionel PW - Items'}, mpc:{items:'Lionel MPC-Modern'},
                          prewar:{items:'Lionel Pre-War'}, mth_o:{items:'MTH O'} };
      const REAL_ERA_IDS = ['pw','mpc','prewar','mth_o'];
      const period = it => ({ pw:'postwar', mpc:'modern', prewar:'prewar', mth_o:'modern' })[it._era] || null;
      let chips = { manufacturer:'lionel', scale:'o', era:'any', section:'items' };
      const noExports = s => s.replace(/if \(typeof window !== 'undefined'\) window\.[\w.]+ = \w+;/g, '');
      const a = cfgS.indexOf('var _RR_CHIP_SCALE_LABEL'), b = cfgS.indexOf('// ── Keys that hold browseable');
      const af = new Function('ERAS','ERA_SCALE','ERA_TABS','REAL_ERA_IDS','window',
          '_currentEra','_phState','_itemEraPeriod',
          noExports(cfgS.slice(a,b)) + 'return rrActiveFilter;')(
          ERAS, ERA_SCALE, ERA_TABS, REAL_ERA_IDS, { WHAT_I_COLLECT:{} }, 'all', () => chips, period);

      const f = af();
      ok('Brad\'s real filter — Lionel / O / Any Era — names BOTH eras it covers',
         !!f && f.era === '' && (f.eras || []).slice().sort().join(',') === 'mpc,pw',
         f ? f.era + ' / [' + (f.eras || []).join(',') + ']' : 'null');
      ok('…and still excludes the Standard-gauge Pre-War era and every other maker',
         (f.eras || []).indexOf('prewar') < 0 && (f.eras || []).indexOf('mth_o') < 0);
      chips = { manufacturer:'lionel', scale:'o', era:'modern', section:'items' };
      ok('a single-era filter still reports exactly that one, in both fields',
         af().era === 'mpc' && (af().eras || []).join(',') === 'mpc');
    })();

    // ── and the consumers actually USE the list ──
    // Same catalog and text as §135, but the filter is "Any Era" this time.
    const ROWS = [
      { itemNum:'2631200', _era:'mpc', _tab:'Lionel MPC-Modern', description:'M-K-T LEGACY 0-8-0 #43', roadName:'' },
      { itemNum:'6464-500', _era:'pw', _tab:'Lionel PW - Items', description:'Timken Boxcar', roadName:'Timken' },
    ];
    for (let i = 0; i < 80; i++) {
      ROWS.push({ itemNum:'F'+i, _era:'mpc', _tab:'Lionel MPC-Modern',
                  description:'LEGACY 0-8-0 Steam Switcher filler '+i, roadName:'Missouri-Kansas-Texas' });
    }
    const M = new Map();
    ROWS.forEach(r => { M.set(r.itemNum, [r]); });
    global.state = { masterByItem: M, personalData: {} };
    global.window.state = global.state;
    global.findMaster = (n) => {
      const k = String(n);
      if (k === '2631200')  return { itemNum:'2631200',  _era:'mpc' };
      if (k === '6464-500') return { itemNum:'6464-500', _era:'pw' };
      if (k === '20-3151-1') return { itemNum:'20-3151-1', _era:'mth_o' };
      return null;
    };
    const READ = 'Lionel Missouri-Kansas-Texas Railroad M-K-T LEGACY 0-8-0 #43 '
               + 'steam switcher locomotive and tender (2023)';
    const ANY = { era: '', eras: ['pw','mpc'], manufacturer: 'Lionel', scale: 'O' };

    ok('the word matcher searches every era the filter covers',
       (function () { const d = window.__DescMatch(READ, ANY);
                      return !!d && d.row.itemNum === '2631200'; })(),
       JSON.stringify((window.__DescMatch(READ, ANY) || {}).row || null));
    ok('the reconciler rescues under "Any Era" — the case that was inert',
       (function () { const r = window.__Reconcile({ itemNum:'20-3151-1', description:READ }, READ, ANY);
                      return r && r.num === '2631200' && !!r.viaDesc; })());
    ok('a number valid in EITHER covered era is accepted, not just the first',
       (function () { const r = window.__Reconcile({ itemNum:'999999' }, 'saw 6464-500 on the box', ANY);
                      return r && r.num === '6464-500'; })());
    ok('a number from an era the filter does NOT cover is still rejected',
       (function () { const r = window.__Reconcile({ itemNum:'20-3151-1' }, 'only 20-3151-1 here',
                        { era:'', eras:['pw'], manufacturer:'Lionel' });
                      return r && r.num === '20-3151-1' && !r.viaDesc; })());
    ok('an empty era list still declines rather than searching everything',
       (function () { const r = window.__Reconcile({ itemNum:'20-3151-1' }, READ,
                        { era:'', eras:[], manufacturer:'Lionel' });
                      return r && r.num === '20-3151-1' && !r.viaDesc; })() &&
       !window.__DescMatch(READ, { era:'', eras:[] }));
    ok('the old single-era shape keeps working untouched',
       (function () { const r = window.__Reconcile({ itemNum:'20-3151-1', description:READ }, READ,
                        { era:'mpc', manufacturer:'Lionel' });
                      return r && r.num === '2631200'; })());

    // The index is keyed on the era SET, or two different filters share one.
    ok('the description index is cached per era-set, not per single era',
       /_descIdxKey === eraKey/.test(rd('app/photo-inbox.js')) &&
       /var eraKey = eras\.join\('\|'\)/.test(rd('app/photo-inbox.js')));
    ok('and the stored-read repair no longer skips a multi-era filter',
       /if \(!_prefEras\(prefer\)\.length\) return;/.test(rd('app/photo-inbox.js')));
  })();

  section('137. The two gaps found while verifying v0.9.1165 (v0.9.1166)');
  // Brad: "fix the 2 things you found".
  //   (1) a read stored under a NON-LEAD photo was never repaired
  //   (2) "2900 - Lockon" offered confidently for a photo of a steam locomotive
  (function () {
    const pP = require('path');
    const src = fs.readFileSync(pP.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

    // ---- (1) the repair pass walks EVERY photo ----
    ok('the stored-read repair walks every photo in every group, not just the lead',
       /\(g\.files \|\| \[\]\)\.forEach\(function \(f\) \{ if \(f && f\.id\) _files\.push/.test(src));
    ok('...so it no longer keys off _pinReadFid alone',
       !/var fid = _pinReadFid\(g\);\s*\n\s*var e = fid && ids\[fid\];/.test(src));

    (function () {
      // 'mod' because that is a real era in this harness's ERAS stub — the photos
      // are TAGGED with it, so _pinPreferOf resolves without needing chip state.
      const ROWS = [{ itemNum:'2631200', _era:'mod', _tab:'Lionel MPC-Modern',
                      description:'M-K-T LEGACY 0-8-0 #43', roadName:'' }];
      for (let i = 0; i < 80; i++) ROWS.push({ itemNum:'F'+i, _era:'mod', _tab:'Lionel MPC-Modern',
        description:'LEGACY 0-8-0 Steam Switcher filler '+i, roadName:'Missouri-Kansas-Texas' });
      const M = new Map(); ROWS.forEach(r => M.set(r.itemNum, [r]));
      global.state = { masterByItem: M, personalData: {} };
      global.window.state = global.state;
      global.findMaster = (n) => (String(n) === '2631200' ? { itemNum:'2631200', _era:'mod' }
                                : String(n) === '20-3151-1' ? { itemNum:'20-3151-1', _era:'mth_ho' } : null);
      // Photo A carries no read; photo B holds the stale one. The old pass looked
      // only at the group's readable photo and never reached B.
      window.__T.groups = [{ key:'g1', files: [{ id:'A', _meta:{ era:'mod' } },
                                              { id:'B', _meta:{ era:'mod' } }] }];
      localStorage.setItem('rr_inbox_ids', JSON.stringify({ B: {
        num:'20-3151-1', aiRaw:'Lionel M-K-T LEGACY 0-8-0 #43 tender 2023',
        desc:'M-K-T LEGACY 0-8-0 #43' } }));
      window.__ReconcileStored();
      const after = JSON.parse(localStorage.getItem('rr_inbox_ids')).B;
      ok('a read stored on the SECOND photo of a group is repaired now',
         after && after.num === '2631200', after ? String(after.num) : 'gone');
      ok('...and remembers what it was read as',
         after && after.aiSku === '20-3151-1', after ? String(after.aiSku) : '-');
    })();

    // ---- (2) a fingerprint word contradicts a confirmed number ----
    ok('a near-unique word is reported as such, so arbitration can weigh it',
       /nearUnique: _nearUnique/.test(src) && /rs\.length <= 2\) _nearUnique = true/.test(src));
    ok('arbitration has a branch for it, independent of the number digit count',
       /\} else if \(dm\.nearUnique\) \{/.test(src));
    ok('the disagreement is disclosed, not resolved silently',
       /The lettering and the number disagree/.test(src));
    ok('...and a kind-of-item clash is spelled out - the Lockon-vs-locomotive case',
       /They are not even the same kind of item/.test(src));

    (function () {
      const ROWS = [
        { itemNum:'2900', _era:'mpc', _tab:'Lionel MPC-Modern', description:'Lockon', itemType:'Track' },
        { itemNum:'2631200', _era:'mpc', _tab:'Lionel MPC-Modern', description:'M-K-T LEGACY 0-8-0 #43',
          itemType:'Steam Locomotive', roadName:'' },
      ];
      for (let i = 0; i < 80; i++) ROWS.push({ itemNum:'G'+i, _era:'mpc', _tab:'Lionel MPC-Modern',
        description:'LEGACY 0-8-0 Steam Switcher filler '+i, itemType:'Steam Locomotive' });
      const M = new Map(); ROWS.forEach(r => M.set(r.itemNum, [r]));
      global.state = { masterByItem: M, personalData: {} };
      global.window.state = global.state;
      global.findMaster = (n) => ROWS.find(x => String(x.itemNum) === String(n)) || null;
      const arb = window.__DescArbitrate({ num:'2900', matched:true, dbg:{} },
        'LIONEL M-K-T 43 STEAM', { era:'mpc' });
      ok('the Lockon is no longer the confident answer for a locomotive photo',
         arb && arb.num === '2631200' && arb.matched === false,
         JSON.stringify(arb && { num: arb.num, matched: arb.matched }));
      ok('...the lockon number is kept beside it rather than thrown away',
         arb && arb.disagreed === '2900');
      ok('...and the card is told they are different KINDS of item',
         arb && arb.dbg && /2900 is a Track, but the lettering points to a Steam Locomotive/
           .test(String(arb.dbg.typeClash || '')),
         arb && arb.dbg ? String(arb.dbg.typeClash) : '-');
    })();
  })();

  section('138. A Lionel filter never answers Atlas (v0.9.1167)');
  // Brad, two screenshots, same evening:
  //   "if i once again tell you its a lionel, don't suggest to me atlas"
  //   "this was labeled lionel postwar o guage, and i come on to my screen today
  //    its atlas n. what the hell."
  // His MKT steam locomotive read "2500 - Atlas O Undecorated (Low Nose)"; his
  // A.T.&S.F. gondola read "40200 - Atlas N UNDECORATED (ADM/MCP)". ONE cause:
  // the free reader's own era gate was the FIFTH copy of the single-era check,
  // and a filter covering more than one era leaves prefer.era === '' - so it
  // accepted rows from ANY catalog and a number assembled from OCR noise went
  // shopping until some maker's list took it. The disclosure said so outright:
  // "Photo is stamped: nothing - no era filter applied".
  (function () {
    // A catalog holding the two Atlas rows that won, plus the Lionel rows the
    // filter should be confined to.
    const ROWS = [
      { itemNum:'2500',  _era:'atlas',   _tab:'Atlas O', description:'Undecorated (Low Nose)' },
      // 40200 exists as BOTH a postwar Lionel number and an Atlas N one. The
      // postwar row is listed first so an unfiltered lookup lands on it, which is
      // what makes the candidate-era cap testable on its own.
      { itemNum:'40200', _era:'pw',      _tab:'Lionel PW - Items', description:'Weight-stamp collision' },
      { itemNum:'40200', _era:'atlas_n', _tab:'Atlas N', description:'UNDECORATED (ADM/MCP)' },
      { itemNum:'6462',  _era:'pw',      _tab:'Lionel PW - Items', description:'New York Central Gondola' },
      { itemNum:'2400',  _era:'mod',     _tab:'Lionel MPC-Modern', description:'Maplewood Pullman' },
    ];
    const M = new Map();
    ROWS.forEach(r => { const k = String(r.itemNum); M.set(k, (M.get(k) || []).concat([r])); });
    global.state = { masterByItem: M, personalData: {} };
    global.window.state = global.state;
    // The real findMaster honours `prefer`; a stub that ignores it is a second
    // implementation and would test the wrong thing (rule 11, learned twice today).
    global.findMaster = (n, v, prefer) => {
      const rows = M.get(String(n)) || [];
      if (!rows.length) return null;
      const eras = prefer ? ((prefer.eras && prefer.eras.length) ? prefer.eras
                            : (prefer.era ? [prefer.era] : [])) : [];
      if (eras.length) {
        const hit = rows.find(r => eras.indexOf(r._era) >= 0);
        if (hit) return hit;
      }
      if (prefer && prefer.manufacturer) {
        const want = String(prefer.manufacturer).toLowerCase();
        const hit = rows.find(r => (r._tab || '').toLowerCase().indexOf(want) === 0);
        if (hit) return hit;
      }
      return rows[0];
    };
    // _pinBestMaster reads window._mbAllGet first — an earlier section leaves one
    // behind, and it was answering from a different catalog entirely. Point it at
    // THIS section's rows so the test measures the code and not the leftovers.
    global.window._mbAllGet = (n) => M.get(String(n).trim()) || null;
    // The harness's shared ERAS stub has no Atlas entries, so the maker guard saw a
    // BLANK maker for the Atlas row and — correctly, by its own rule — declined to
    // contradict it. That is the stub differing from the real app, not the app being
    // wrong: ERAS.atlas.manufacturer is 'Atlas' in config.js. Additive, so later
    // sections are unaffected.
    global.ERAS.atlas   = { label:'Atlas O', manufacturer:'Atlas' };
    global.ERAS.atlas_n = { label:'Atlas N', manufacturer:'Atlas' };
    // _manufacturerOfEra lives in app.js; the maker guard reads it when present.
    global._manufacturerOfEra = (era) => ({ pw:'lionel', prewar:'lionel', mod:'lionel',
      atlas:'atlas', atlas_n:'atlas' })[era] || '';

    // Brad's REAL OCR text, copied from the disclosure in his screenshot.
    const MKT_OCR = '- -- -- 3 43 -- - - 9 7 - - - 4 - - - - - 3 10 --- - 5 - 4 - - - - - - 2 - - -- - 2 2500 -- - - - - - - - - 5 - -';

    // Unfiltered, the old answer still stands — nothing here narrows it.
    let r = window.__NumFromText(MKT_OCR, null);
    ok('with NO filter at all, an Atlas number can still be the answer',
       r && String(r.num) === '2500', JSON.stringify(r && r.num));

    // Filtered to Lionel across TWO eras — the exact state that broke.
    const LIONEL_ANY = { era: '', eras: ['pw', 'mod'], manufacturer: 'Lionel', scale: 'O' };

    // The reader may still OFFER a bare catalog-shaped token; that is a deliberate
    // hedge and Brad is fine with it ("i don't expect it to get it right"). What he
    // objects to is the CARD then presenting it as an Atlas product. So the
    // assertion belongs where the card gets its maker and description.
    ok('a number found only in another maker\'s catalog gets NO maker on the card',
       window.__BestMaster('2500', '', LIONEL_ANY) === null,
       JSON.stringify(window.__BestMaster('2500', '', LIONEL_ANY)));
    ok('...and the 40200 weight stamp likewise resolves to the Lionel row, never Atlas N',
       (function () { const m = window.__BestMaster('40200', '', LIONEL_ANY);
                      return m && m._era === 'pw'; })(),
       JSON.stringify(window.__BestMaster('40200', '', LIONEL_ANY)));
    ok('with no filter at all the old behaviour stands — some maker is better than none',
       (function () { const m = window.__BestMaster('2500', '', null);
                      return m && m._era === 'atlas'; })());

    // The five-digit weight stamp must not become the READ answer either, and the
    // rule has to come from the candidate's own row because OCR shredded "LT WT".
    const GON_OCR = 'A. T. &. S. F. 356 250 - 4 - - - 1 0 0 0 0 0 - - 1 2 0 0 0 0 - - 40200 - - BUILT BY LIONEL NEW 5-54';
    r = window.__NumFromText(GON_OCR, LIONEL_ANY);
    ok('a five-digit weight stamp is never CONFIRMED against a postwar row',
       !r || !r.matched || String(r.num) !== '40200',
       JSON.stringify(r && { num: r.num, matched: r.matched }));

    // The narrowing must not become a blanket refusal.
    r = window.__NumFromText('BUILT BY LIONEL 6462 NEW YORK CENTRAL', LIONEL_ANY);
    ok('a genuine Lionel number in a covered era is still found',
       r && String(r.num) === '6462', JSON.stringify(r && r.num));

    // And the disclosure has to name what it filtered to, since "no era filter
    // applied" while the user sat on Lionel / O / Modern is what hid this for days.
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
    ok('the read carries every era it filtered to, for the disclosure to name',
       /eras: _prefEras\(prefer\), cand: \[\]/.test(src));
    ok('...and the card lists them rather than claiming no filter was applied',
       /dbg\.eras && dbg\.eras\.length/.test(src) && /\.join\(' or '\)/.test(src));
    ok('the free reader gate uses the era SET, like the other four',
       /if \(!_inEraSet\.length\) return true;/.test(src) &&
       /_inEraSet\.indexOf\(row\._era\) >= 0/.test(src));
  })();

  section('139. Re-scan, rejections, and noise (v0.9.1168)');
  // Three of Brad's five inbox requests, plus the thing his screenshots exposed.
  (function () {
    const pQ = require('path');
    const src = fs.readFileSync(pQ.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
    const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

    // ── (11) a number GLUED out of fragments, in text with no letters ──
    // "I know there is not text on here to read and don't expect it to get it
    // right." His MKT 0-8-0's OCR was 18 characters and not one was a letter; a
    // later pass welded scattered digits into 2233810, a real Lionel row and the
    // wrong item entirely. Right maker, so v1167 cannot catch it.
    (function () {
      const M = new Map();
      // 2233810 exists (an AT&SF F7 set); so does 6464-475, the number Brad's
      // OTHER photo legitimately recovers from letterless text.
      [{ itemNum:'2233810', _era:'mod', _tab:'Lionel MPC-Modern', description:'AT&SF EMD F7 A-A Set' },
       { itemNum:'6464-475', _era:'pw', _tab:'Lionel PW - Items', description:'Bangor & Aroostook Boxcar' },
       { itemNum:'6447', _era:'pw', _tab:'Lionel PW - Items', description:'Pennsylvania Caboose' },
      ].forEach(r => M.set(String(r.itemNum), [r]));
      global.state = { masterByItem: M, personalData: {} };
      global.window.state = global.state;
      global.window._mbAllGet = (n) => M.get(String(n).trim()) || null;
      global.findMaster = (n) => (M.get(String(n).trim()) || [null])[0];

      // Brad's real OCR, letterless, digits scattered in ones and twos.
      const NOISE = '- -- -- 3 43 -- - - 9 7 - - - 4 - - - - - 3 10 --- - 5 - 4 - - - - - - 2 2 3 3 8 1 0 -- - 5 - -';
      const r1 = window.__NumFromText(NOISE, { era:'mod', manufacturer:'Lionel' });
      ok('a number welded out of scattered digits, with no letters read, is NOT an answer',
         !r1 || !r1.num, JSON.stringify(r1 && r1.num));

      // A GLUED reconstruction in letterless text, where the row is a normal item
      // (not a set), is the case the gate is written for.
      const M2 = new Map();
      M2.set('4412340', [{ itemNum:'4412340', _era:'mod', _tab:'Lionel MPC-Modern',
                           description:'Reading T-1 Northern' }]);
      global.state = { masterByItem: M2, personalData: {} };
      global.window.state = global.state;
      global.window._mbAllGet = (n) => M2.get(String(n).trim()) || null;
      global.findMaster = (n) => (M2.get(String(n).trim()) || [null])[0];
      const g1 = window.__NumFromText('- - 4 4 1 2 3 4 0 - - - 5 - -', { era:'mod', manufacturer:'Lionel' });
      ok('the glued-reconstruction gate fires, and says why for the disclosure',
         !!(g1 && !g1.num && g1.dbg && g1.dbg.noLetters),
         JSON.stringify(g1 && { num: g1.num, why: g1.dbg && g1.dbg.noLetters }));

      // restore the first catalog for the run below
      global.state = { masterByItem: M, personalData: {} };
      global.window.state = global.state;
      global.window._mbAllGet = (n) => M.get(String(n).trim()) || null;
      global.findMaster = (n) => (M.get(String(n).trim()) || [null])[0];

      // THE LIMIT THAT MATTERS: Brad's own 6464-475 photo is ALSO letterless, and
      // the right answer IS recoverable there — from an unbroken run with one digit
      // misread. A blanket "no letters, no answer" rule broke that fix; the real
      // distinction is solid-run versus glued-together.
      const REAL = '3 -5464475 0 20 - 748200 8- -';
      const r2 = window.__NumFromText(REAL, { era:'pw', manufacturer:'Lionel' });
      ok('an unbroken run with one misread digit is still repaired — letters or not',
         r2 && r2.num === '6464-475', JSON.stringify(r2 && r2.num));
    })();

    // ── (1) re-scan clears the screen ──
    ok('re-scan blanks the number box, the info panel and the read line',
       /_n0\.value = ''/.test(code) && /_i0\.innerHTML = ''/.test(code) &&
       /Scanning this photo again/.test(code));
    ok('...in place, NOT by re-opening the card (which resets to photo 1)',
       (function () {
         const a = code.indexOf('_reBusy = _pinBtnBusy');
         const b = code.indexOf('_pinReview(key)', a);
         return a > 0 && b > a && !/window\._pinReview\(key\)/.test(code.slice(a, code.indexOf('_freeReadBlob(blob, 2400', a)));
       })());
    ok('...and the stored record is still snapshotted, not destroyed (v0.9.1150 holds)',
       /_prevRead = JSON\.parse\(JSON\.stringify\(_pm0\[fid\]\)\)/.test(code) &&
       /if \(_hadPaid\) \{ m\[fid\] = _prevRead;/.test(code));

    // ── (2) a rejected answer never comes back ──
    ok('pressing "this is wrong" records the number as rejected',
       /_rejected\.indexOf\(_rn\) < 0\) _rejected\.push\(_rn\)/.test(code));
    ok('...the list rides on the entry, so it accumulates across re-scans',
       /rejected: _rejected/.test(code) &&
       /Array\.isArray\(_prevRead\.rejected\)/.test(code));
    ok('...and survives a re-scan that found nothing',
       /if \(_rejected\.length\) \{ m\[fid\] = Object\.assign/.test(code));
    ok('the filter happens at the CANDIDATE stage — one rule, every path',
       /if \(_isRejected\(c\)\) return false;/.test(code));

    (function () {
      const M = new Map();
      [{ itemNum:'2412', _era:'pw', _tab:'Lionel PW - Items', description:'Santa Fe Vista Dome' },
       { itemNum:'2434', _era:'pw', _tab:'Lionel PW - Items', description:'Newark Pullman' },
      ].forEach(r => M.set(String(r.itemNum), [r]));
      global.state = { masterByItem: M, personalData: {} };
      global.window.state = global.state;
      global.window._mbAllGet = (n) => M.get(String(n).trim()) || null;
      global.findMaster = (n) => (M.get(String(n).trim()) || [null])[0];
      const TXT = 'BUILT BY LIONEL 2412 SANTA FE 2434 PULLMAN';
      const base = window.__NumFromText(TXT, { era:'pw', manufacturer:'Lionel' });
      ok('sanity: without a rejection the reader answers 2412',
         base && base.num === '2412', JSON.stringify(base && base.num));
      const after = window.__NumFromText(TXT, { era:'pw', manufacturer:'Lionel', reject:['2412'] });
      ok('once rejected, 2412 is never offered again — the next candidate gets its turn',
         after && after.num === '2434', JSON.stringify(after && after.num));
      const both = window.__NumFromText(TXT, { era:'pw', manufacturer:'Lionel', reject:['2412','2434'] });
      ok('reject them all and it comes back empty rather than repeating itself',
         !both || !both.num, JSON.stringify(both && both.num));
      ok('a rejection is matched loosely, so 6464-475 and 6464475 are the same refusal',
         (function () {
           const r = window.__NumFromText('LIONEL 2412 SANTA FE',
             { era:'pw', manufacturer:'Lionel', reject:['2-412'] });
           return !r || r.num !== '2412';
         })());
    })();

    // ── (3) the spinner ──
    ok('there is ONE busy helper, so a scan button cannot be wired without a spinner',
       /function _pinBtnBusy\(btn, label\)/.test(code) &&
       /animation:spin 0\.8s linear infinite/.test(code));
    ok('...used by re-scan, Read this photo and the screenshot read',
       /_reBusy = _pinBtnBusy/.test(code) && /_idBusy = _pinBtnBusy/.test(code) &&
       /_shotBusy = _pinBtnBusy/.test(code));
    ok('...and it restores the previous label rather than re-typing one',
       /var was = btn\.innerHTML/.test(code) && /btn\.innerHTML = was/.test(code));
    ok('no new colour literal — the spinner line uses a theme variable',
       /color:var\(--info\)/.test(code) && !/color:#2980b9;font-weight:700;font-size:0\.85rem/.test(code));
  })();

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
