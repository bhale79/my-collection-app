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
     + '\n;window.__DescArbitrate=_pinDescArbitrate;window.__IsSetRow=_pinIsSetRow;';
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
     /fields=files\(id,name,createdTime,appProperties\)/.test(srcTxt));
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
  ok('re-read cropped body extracted', reread.length > 200 && reread.length < 4000,
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
  const rsBody = rs.slice(rs.indexOf('window._pinRescan'), rs.indexOf('window._pinRescan') + 2200);
  ok('it forgets the stored read', /delete mm\[fid\]/.test(rsBody));
  ok('it forgets the "already tried" marker', /delete ff\[fid\]/.test(rsBody));
  ok('it clears the visual-check cache', /delete _vfCache\[k\]/.test(rsBody));
  ok('it re-reads with the full multi-pass reader', /_freeReadBlob\(blob, 2400, _preferForFid\(fid\)\)/.test(rsBody));
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
  ok('the stale inline copy is gone',
     (w1.match(/Where did this come from\?/g) || []).length === 1,
     'copies: ' + (w1.match(/Where did this come from\?/g) || []).length);
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
  // a long confirmed number is NOT overruled by words
  arb = window.__DescArbitrate({ num:'6464', matched:true, dbg:{} }, BRAD_BT, { era:'pw' });
  ok('a four-digit confirmed number stands', arb && arb.num === '6464' && arb.matched === true,
     JSON.stringify(arb));
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
     (sd.match(/disagreed: r\.disagreed \|\| ''/g) || []).length === 3);
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
  ok('the master parser reads Body Color from its schema slot', /bodyColor:\s+r\[21\]/.test(adata));

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
  ok('the group hands each member number its own photo id',
     /memberPhotos\[n0\] = f\.id/.test(pv) && /_setMemberPhotos: memberPhotos/.test(pv));
  const wsv = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');
  ok('the walk threads the photo map through every member',
     /_setMemberPhotos = d\._setMemberPhotos/.test(wsv) && /_addPhotoDriveId = _setMemberPhotos\[/.test(wsv));
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

  section('96. The whole-set add clears its photo group after the save');
  const pv6 = require('fs').readFileSync(SRC, 'utf8');
  ok('the set add writes one pending note per member',
     /pend0\[n1\] = \{ link: '', fromFid: '', toFid: ''/.test(pv6) &&
     /never clobber a single-add note/.test(pv6));
  ok('the notes carry every photo that read that number, first one as RSV',
     /numFiles\[n0\] = numFiles\[n0\] \|\| \[\]/.test(pv6) && /rsvFid: fl\[0\]\.id, files: fl/.test(pv6));
  ok('the flush resolves Drive folders at move time, not at click time',
     /if \(!rec\.fromFid\) rec\.fromFid = await _folder\(\)/.test(pv6) &&
     /if \(!rec\.toFid\) rec\.toFid = await driveEnsureItemFolder\(num\)/.test(pv6));
  ok('a folder failure retries next build instead of dropping the note',
     /will retry:', eF\); continue;/.test(pv6));
  ok('the flush matches saved members through the number normalizer',
     /normalizeItemNum\(String\(p\.itemNum\)\) === normalizeItemNum\(num\)/.test(pv6));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
