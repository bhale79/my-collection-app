#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// PASTE A COPIED PICTURE — 2026-11-01 (PLAN_2026-11-01_PASTE_PICTURE.md)
//
// [stated] Brad 2026-11-01 20:58 CT: "is there a way we can paste directly into
// a photo slot when adding a picture instead of downloading it from the pc or
// desktop? so like i would screen shot a picture, then right click the photo
// link and hit paste?" → 21:00 "can you do the plan for the paste now so we
// just have one build to push" → 21:02 "build both now".
//
//   ONE clipboard reader (config.js rrPastePicture), ONE way a Ctrl+V picture
//   is taken out (rrPicFromEvent), ONE button (rrPasteBtn / rrPasteInto) that
//   puts the picture into the chooser's OWN file box — so it takes exactly the
//   road an uploaded picture takes.
//
//   N  the helper in Node, the real config.js block: a picture → pasted-….png;
//      text only / refused / no reader → plain words + ONE diary line.
//   S  the scan — EVERY picture file box in app/ is accounted for (a 📋 Paste,
//      or named camera-only / unused here with the reason); a new picture box
//      anywhere turns S1 red until it is given one. The clipboard is read in
//      ONE place and a pasted picture taken out in ONE place.
//   B  the real app in Chromium (the clipboard reader stood in with a real PNG):
//      every chooser that can be opened from a clean start — the photo slot,
//      Photo ID, Research, Photo Inbox, Report a problem, a part, a contact
//      (card + person), a loose part, a logo card, picture-first — gets the
//      picture through its own file box; Ctrl+V reaches the chooser on top and
//      never a typing box; nothing copied → the words, nothing filed.
//   P  planted offenders turn their own check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  paste_picture_tests needs playwright: ' + e.message); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };

// ── N: the helper, from the real config.js ────────────────────────────────
const CFG = read('config.js');
const n0 = CFG.indexOf('const RR_PASTE = {');
const n1 = CFG.indexOf("if (typeof window !== 'undefined') {\n  window.RR_PASTE = RR_PASTE;");
ok('N0 the paste block is in config.js (RR_PASTE … rrPasteBtn)', n0 > 0 && n1 > n0);
function pasteWorld(ua, clipboard) {
  const log = [];
  const ctx = { window: { rrSyncLog: (e, i) => log.push([e, i]) }, navigator: { userAgent: ua, maxTouchPoints: 0, clipboard }, Promise, String, File, Blob, Date };
  vm.createContext(ctx);
  vm.runInContext(CFG.slice(n0, n1) + '\nthis.RR_PASTE = RR_PASTE; this.rrPastePicture = rrPastePicture; this.rrPicFromEvent = rrPicFromEvent; this.rrPasteBtn = rrPasteBtn;', ctx);
  return { ctx, log };
}
const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const WORDS = pasteWorld(UA_CHROME, null).ctx.RR_PASTE.words;
const item = (types, blobs) => ({ types, getType: t => Promise.resolve(blobs[t]) });

(async () => {
  {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const w = pasteWorld(UA_CHROME, { read: () => Promise.resolve([item(['text/plain'], {}), item(['text/html', 'image/png'], { 'image/png': png })]) });
    let f = null; await w.ctx.rrPastePicture().then(x => { f = x; });
    ok('N1 a copied picture → a file named pasted-<time>.png, image/png, and NO diary line', f && /^pasted-\d+\.png$/.test(f.name) && f.type === 'image/png' && f.size === 4 && !w.log.length, JSON.stringify({ name: f && f.name, log: w.log }));
  }
  {
    const jpg = new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' });
    const w = pasteWorld(UA_CHROME, { read: () => Promise.resolve([item(['image/jpeg'], { 'image/jpeg': jpg })]) });
    let f = null; await w.ctx.rrPastePicture().then(x => { f = x; });
    ok('N2 a copied JPEG → pasted-<time>.jpg', f && /^pasted-\d+\.jpg$/.test(f.name), f && f.name);
  }
  const fails = [
    ['N3 only text copied → the "no picture" words', UA_CHROME, { read: () => Promise.resolve([item(['text/plain'], {})]) }, 'none', WORDS.none],
    ['N4 Chrome refused → the allow-it words', UA_CHROME, { read: () => Promise.reject({ name: 'NotAllowedError' }) }, 'denied', WORDS.denied],
    ['N5 iPad, the Paste bubble not tapped → the tap-the-bubble words', UA_IPAD, { read: () => Promise.reject({ name: 'NotAllowedError' }) }, 'denied', WORDS.deniedApple],
    ['N6 no clipboard reader in this browser → the Ctrl+V words', UA_CHROME, { writeText: () => {} }, 'unsupported', WORDS.unsupported],
    ['N7 no clipboard at all → the Ctrl+V words', UA_CHROME, undefined, 'unsupported', WORDS.unsupported],
    ['N8 a reader that throws → the general words', UA_CHROME, { read: () => { throw { name: 'TypeError' }; } }, 'other', WORDS.other],
    ['N9 the picture can\'t be fetched from the item → the general words', UA_CHROME, { read: () => Promise.resolve([{ types: ['image/png'], getType: () => Promise.reject({ name: 'TypeError' }) }]) }, 'other', WORDS.other],
  ];
  for (const [n, ua, cb, reason, words] of fails) {
    const w = pasteWorld(ua, cb);
    let why = null; await w.ctx.rrPastePicture().then(() => {}, r => { why = r; });
    ok(n + ' + ONE diary line', why && why.reason === reason && why.words === words && w.log.length === 1 && w.log[0][0] === 'paste' && w.log[0][1].indexOf(reason) === 0, JSON.stringify({ why, log: w.log }));
  }
  {
    const w = pasteWorld(UA_CHROME, null);
    const f = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' });
    const ev = { clipboardData: { items: [{ kind: 'string', type: 'text/plain' }, { kind: 'file', type: 'image/png', getAsFile: () => f }] } };
    const got = w.ctx.rrPicFromEvent(ev);
    ok('N10 Ctrl+V: the picture is taken out of the paste and renamed pasted-….png (a browser calls every snip image.png)', got && /^pasted-\d+\.png$/.test(got.name), got && got.name);
    ok('N11 Ctrl+V with only text → nothing', w.ctx.rrPicFromEvent({ clipboardData: { items: [{ kind: 'string', type: 'text/plain' }] } }) === null);
    ok('N12 Ctrl+V: a named file is kept as it is', w.ctx.rrPicFromEvent({ clipboardData: { items: [], files: [{ name: 'shot.png', type: 'image/png' }] } }).name === 'shot.png');
  }
  const allWords = Object.values(WORDS).join(' ') + ' ' + pasteWorld(UA_CHROME, null).ctx.RR_PASTE.label;
  ok('N13 the paste words never say "AI" and never "maker\'s"', !/\bAI\b/.test(allWords) && !/maker/i.test(allWords));

  // ── S: every picture file box accounted for ───────────────────────────────
  const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).sort();
  const SRC = {}; for (const f of files) SRC[f] = read(f);
  function pictureBoxes(src) {
    const out = [];
    src.split('\n').forEach((l, i) => {
      const code = l.replace(/^\s*\/\/.*$/, '');
      const re = /accept\s*=\s*\\?["']image\/\*\\?["']|\.accept\s*=\s*['"]image\/\*['"]/g;
      let m; while ((m = re.exec(code))) out.push(i + 1);
    });
    return out;
  }
  // [file, a text on the box's own line (or the line before), how the picture is pasted]
  const BOXES = [
    ['app-pages.js', 'id="_part-photo-input"', "rrPasteBtn('_part-photo-input')"],
    ['app-pages.js', "inp.id = 'eph-photo-inp'", 'if (paste) rrPasteInto(inp); else inp.click();'],
    ['app-collection.js', 'var fi = document.createElement', 'pb.onclick = function () { rrPasteInto(fi); };'],
    ['app-collection.js', 'inp.multiple = true;', 'if (paste) rrPasteInto(inp); else inp.click();'],
    ['appearance.js', 'id="rrap-lfile"', "rrPasteBtn('rrap-lfile')"],
    ['barcode.js', 'id="bi-file"', "rrPasteInto(d.querySelector('#bi-file'))"],
    ['contacts.js', 'id="ct-card-file"', 'CAMERA ONLY — its sibling ct-card-gallery has the 📋 Paste'],
    ['contacts.js', 'id="ct-card-gallery"', "rrPasteBtn('ct-card-gallery'"],
    ['contacts.js', 'id="ct-person-file"', "rrPasteBtn('ct-person-file'"],
    ['error-report.js', 'id="err-shots"', "rrPasteBtn('err-shots')"],
    ['logo-cards.js', 'id="rrlc-file"', "rrPasteBtn('rrlc-file')"],
    ['maintenance.js', 'id="binf-photo"', "rrPasteBtn('binf-photo')"],
    ['photo-inbox-identify.js', "inp.id = 'qc-file'", 'CAMERA ONLY — Quick Capture is a shooting session; the Inbox\'s "Add photos from…" has the 📋 Paste'],
    ['photo-inbox-tools.js', "inp.id = 'pin-shot-input'", 'UNUSED — _pinReadShot has no button (checked below); the review card reads a Ctrl+V snip'],
    ['photo-inbox.js', 'id="pin-file-input"', "rrPasteInto('pin-file-input')"],
    ['service-manual.js', 'inp.type = \'file\'; inp.accept', "if (t.classList.contains('sm-photo-paste')) rrPasteInto(inp); else inp.click();"],
    ['wizard-photos.js', 'id="wiz-tray-file"', "rrPasteBtn('wiz-tray-file'"],
    ['wizard.js', "inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');", 'CAMERA ONLY — the slot chooser\'s #picker-btn-paste covers this slot'],
    ['wizard.js', "inp.type = 'file'; inp.id = 'picker-input-lib';", "_pickerEl.querySelector('#picker-btn-paste')"],
    ['wizard.js', 'id="id-file-camera"', 'CAMERA ONLY — its sibling id-file-gallery has the 📋 Paste'],
    ['wizard.js', 'id="id-file-gallery"', "rrPasteBtn('id-file-gallery'"],
    ['wizard.js', 'id="id-shot-file"', 'UNUSED — a screenshot of Google\'s results; Photo ID\'s own 📋 Paste Lens Result already pastes the copied answer (wizard-photos.js _identifyReadClipboard)'],
    ['wizard.js', 'id="bcd-photo-file"', "rrPasteBtn('bcd-photo-file'"],
    ['wizard.js', 'function _wizPicFirstPick', "rrPasteInto(null, _wizPicFirstTake)"],
  ];
  function audit(SRC) {
    const found = [], bad = [];
    for (const f of files) {
      const lines = SRC[f].split('\n');
      for (const ln of pictureBoxes(SRC[f])) {
        const here = lines[ln - 1] + '\n' + (lines[ln] || '') + '\n' + (lines[ln - 2] || '') + '\n' + (lines[ln - 3] || '') + '\n' + (lines[ln - 4] || '');
        // the most specific entry wins; one entry per box
        const hit = BOXES.filter(b => b[0] === f && here.indexOf(b[1]) >= 0 && !found.some(x => x.b === b)).sort((a, b) => (lines[ln - 1].indexOf(b[1]) >= 0) - (lines[ln - 1].indexOf(a[1]) >= 0));
        if (!hit.length) { bad.push(f + ':' + ln + ' (no entry)'); continue; }
        const b = hit[0]; found.push({ b, ln });
        if (/^(CAMERA ONLY|UNUSED)/.test(b[2])) continue;
        if (!files.some(g => SRC[g].indexOf(b[2]) >= 0)) bad.push(f + ':' + ln + ' has no 📋 Paste (' + b[2] + ')');
      }
    }
    return { found, bad };
  }
  const A = audit(SRC);
  ok('S1 every picture file box in app/ has a 📋 Paste (or is named camera-only / unused, with the reason)', !A.bad.length, A.bad.join(' | '));
  ok('S1b the count matches — ' + BOXES.length + ' picture boxes known, ' + A.found.length + ' found (a new one must be given a Paste)', A.found.length === BOXES.length, A.found.map(x => x.b[0] + ':' + x.ln).join(', '));
  ok('S2 _pinReadShot (the unused box above) still has no button calling it', !files.some(f => /_pinReadShot\s*\(\s*\)/.test(SRC[f].replace(/window\._pinReadShot\s*=\s*function\s*\(\s*\)/g, ''))));
  ok('S3 the slot chooser has its 📋 button', /id=\\"picker-btn-paste\\"/.test(SRC['wizard.js']));
  ok('S4 the Photo Inbox "Add photos from…" has it on a phone AND a computer', (SRC['photo-inbox-offline.js'].match(/rrPasteInto\('pin-file-input'\)/g) || []).length === 2);
  ok('S5 Research has it on a phone AND a computer', (SRC['barcode.js'].match(/act: 'paste'/g) || []).length === 2);
  ok('S6 every RR_PASTE.inputs box (Ctrl+V reaches it) has a 📋 Paste', (() => { const W = pasteWorld(UA_CHROME, null).ctx.RR_PASTE; return W.inputs.every(id => files.some(f => SRC[f].indexOf("rrPasteBtn('" + id + "'") >= 0 || SRC[f].indexOf("rrPasteInto('" + id + "')") >= 0 || SRC[f].indexOf("rrPasteInto(d.querySelector('#" + id + "'))") >= 0)); })());
  function readers(SRC, re) { const out = []; for (const f of files) SRC[f].split('\n').forEach((l, i) => { if (re.test(l.replace(/\/\/.*$/, ''))) out.push(f + ':' + (i + 1)); }); return out; }
  const R1 = readers(SRC, /navigator\.clipboard\.read\s*\(|\bcb\.read\s*\(/);
  ok('S7 the clipboard is read for a picture in ONE place (config.js rrPastePicture)', R1.length === 1 && /^config\.js:/.test(R1[0]), R1.join(', '));
  const R2 = readers(SRC, /\.getAsFile\s*\(/);
  ok('S8 a Ctrl+V picture is taken out in ONE place (config.js rrPicFromEvent)', R2.length === 1 && /^config\.js:/.test(R2[0]), R2.join(', '));
  // planted
  {
    const P = Object.assign({}, SRC, { 'maintenance.js': plant(SRC['maintenance.js'], "rrPasteBtn('binf-photo')", "''", 'S1-P1') });
    ok('S1 P the loose-part Paste removed → S1 red', audit(P).bad.length > 0);
    const P2 = Object.assign({}, SRC, { 'reports.js': SRC['reports.js'] + "\nvar _x = document.createElement('input'); _x.accept = 'image/*';\n" });
    const a2 = audit(P2);
    ok('S1 P a NEW picture box with no Paste → S1 red', a2.bad.length > 0, a2.bad.join(' | '));
    const P3 = Object.assign({}, SRC, { 'barcode.js': SRC['barcode.js'] + '\nnavigator.clipboard.read().then(function(){});\n' });
    ok('S7 P a second clipboard reader → S7 red', readers(P3, /navigator\.clipboard\.read\s*\(|\bcb\.read\s*\(/).length > 1);
    const P4 = Object.assign({}, SRC, { 'appearance.js': SRC['appearance.js'] + '\nvar _y = e.clipboardData.items[0].getAsFile();\n' });
    ok('S8 P a second picture taker → S8 red', readers(P4, /\.getAsFile\s*\(/).length > 1);
  }

  // ── B: the real app in Chromium ───────────────────────────────────────────
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  // the clipboard reader stood in: a real 40x30 PNG (window.__clip = 'png' | 'text' | 'deny')
  const STANDIN = () => {
    window.__clip = 'png'; window.__fed = []; window.__toasts = [];
    const png = () => new Promise(res => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 30); c.toBlob(res, 'image/png'); });
    const read = () => window.__clip === 'deny' ? Promise.reject(new DOMException('no', 'NotAllowedError'))
      : window.__clip === 'text' ? Promise.resolve([new ClipboardItem({ 'text/plain': new Blob(['6464-1'], { type: 'text/plain' }) })])
      : png().then(b => [new ClipboardItem({ 'image/png': b })]);
    try { Object.defineProperty(navigator.clipboard, 'read', { value: read, configurable: true }); } catch (e) { navigator.clipboard.read = read; }
    // every file box that gets a picture — seen BEFORE its own handler runs
    document.addEventListener('change', e => { const t = e.target; if (t && t.type === 'file') window.__fed.push({ id: t.id || '(no id)', n: t.files ? t.files.length : 0, name: t.files && t.files[0] ? t.files[0].name : '' }); }, true);
  };
  async function boot(S, served) {
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, isMobile: !!S.mobile, hasTouch: !!S.mobile, userAgent: S.ua });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    await ctx.addInitScript(STANDIN);
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    await ctx.route('**', r => {
      const u = r.request().url();
      if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:')) return r.abort();
      const name = u.split('?')[0].split('/').pop();
      if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForTimeout(2200);
    await pg.evaluate(SEED); await pg.waitForTimeout(300);
    // the one-time explainer card (not part of any chooser) stays away for the whole run
    await pg.evaluate(() => { window.showAiUsageCard = function () {}; const c = document.getElementById('rr-ai-usage-card'); if (c) c.remove(); });
    await pg.evaluate(() => { const t0 = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { return t0 && t0.apply(this, arguments); } catch (e) {} }; window._cropFirst = function (f, apply) { apply(f); }; });
    return { ctx, pg, errs };
  }
  const reset = pg => pg.evaluate(() => { window.__fed = []; window.__toasts = []; window.__clip = 'png'; });
  const fed = pg => pg.evaluate(() => window.__fed.slice());
  // click the visible Paste button matching sel (a real mouse click at its centre — it must be on top)
  const noCard = pg => pg.evaluate(() => { const c = document.getElementById('rr-ai-usage-card'); if (c) c.remove(); });   // the one-time explainer card, not part of any chooser
  async function press(pg, sel) {
    await noCard(pg);
    const r = await pg.evaluate(sel => {
      const all = Array.from(document.querySelectorAll(sel)).filter(b => b.getClientRects().length);
      const b = all[all.length - 1]; if (!b) return null;
      b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect();
      const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      let by = ''; for (let a = top; a && a !== document.body && by.length < 160; a = a.parentElement) by += (a.id || a.tagName) + ' < ';
      return { x: q.left + q.width / 2, y: q.top + q.height / 2, onTop: !!(top && (top === b || b.contains(top))), txt: b.textContent.trim(), by };
    }, sel);
    if (r && r.onTop) { await pg.mouse.click(r.x, r.y); await pg.waitForTimeout(700); }
    return r;
  }
  const DESK = { w: 1280, h: 860, ua: UA_CHROME };
  const ROADS = [
    // [name, open, button selector, expect: input id or function that checks]
    ['Photo ID (the Add screen\'s picture reader)', "openWizard('collection'); setTimeout(function(){ openIdentify(); }, 300)", '[data-paste="id-file-gallery"]', 'id-file-gallery'],
    ['Research an Item (computer)', "window.openResearch()", '[data-bi="paste"]', 'bi-file'],
    ['Report a problem', "errReportOpen()", '[data-paste="err-shots"]', 'err-shots'],
    ['a part\'s photo', "showAddPartModal()", '[data-paste="_part-photo-input"]', '_part-photo-input'],
    ['a contact\'s card', "_ctOpenEdit(null)", '[data-paste="ct-card-gallery"]', 'ct-card-gallery'],
    ['a contact\'s own photo', "_ctOpenEdit(null)", '[data-paste="ct-person-file"]', 'ct-person-file'],
    ['a loose part (Bench bin)', "_maintBinForm()", '[data-paste="binf-photo"]', 'binf-photo'],
    ['a logo card', "_rrlcOpen(); setTimeout(function(){ _rrlcNew('small'); }, 200)", '[data-paste="rrlc-file"]', 'rrlc-file'],
    ['the Photo Inbox "Add photos from…"', "window._pinGo(document.getElementById('nav-photo-inbox')); setTimeout(function(){ window._pinAddSource(); setTimeout(function(){ var k = Array.prototype.find.call(document.querySelectorAll('#pin-ctx-sheet button'), function (x) { return /Skip/.test(x.textContent); }); if (k) k.click(); }, 300); }, 400)", '#pin-src-ov .rr-paste-btn, #pin-src-ov button', 'pin-file-input'],
  ];
  {
    const b = await boot(DESK);
    for (const [name, open, sel, want] of ROADS) {
      await reset(b.pg);
      await b.pg.evaluate(new Function('try{' + open + '}catch(e){window.__e=e.message}'));
      await b.pg.waitForTimeout(1200);
      const sel2 = name.indexOf('Photo Inbox') >= 0 ? '#pin-src-ov button' : sel;
      let r;
      if (name.indexOf('Photo Inbox') >= 0) {
        // the paste row is the one carrying the paste words
        r = await b.pg.evaluate(() => { const bt = Array.from(document.querySelectorAll('#pin-src-ov button')).find(x => x.textContent.indexOf(RR_PASTE.label) >= 0); if (!bt) return null; bt.setAttribute('data-test-paste', '1'); return 1; });
        r = r ? await press(b.pg, '[data-test-paste="1"]') : null;
      } else r = await press(b.pg, sel2);
      const f = await fed(b.pg);
      const e = await b.pg.evaluate(() => { const x = window.__e; window.__e = null; return x; });
      ok('B1 ' + name + ' — the 📋 Paste is there and on top', r && r.onTop, JSON.stringify(r) + (e ? ' open error: ' + e : ''));
      ok('B1 ' + name + ' — the picture goes into its own file box (' + want + ')', f.length === 1 && f[0].id === want && f[0].n === 1 && /^pasted-\d+\.png$/.test(f[0].name), JSON.stringify(f));
      await b.pg.evaluate(() => { document.querySelectorAll('#bi-overlay,#_part-modal,#ct-modal,#ct-edit,#rrlc-pop,#pin-src-ov,#pin-ctx-sheet,#bin-form,[id^=err-],.rr-cropper,#cropper-overlay').forEach(x => { try { x.remove(); } catch (e) {} }); try { closeIdentify(); } catch (e) {} try { closeWizard(); } catch (e) {} try { errReportClose(); } catch (e) {} try { if (window.BackStack) while (BackStack.depth && BackStack.depth()) BackStack.pop(); } catch (e) {} });
      await b.pg.keyboard.press('Escape'); await b.pg.waitForTimeout(400);
    }
    // the photo slot: Paste → THAT slot, through the same upload as a picked file
    await reset(b.pg);
    await b.pg.evaluate(() => { window.__up = []; try { openWizard('collection'); } catch (e) {} });
    await b.pg.waitForTimeout(900);
    await b.pg.evaluate(() => { window.uploadWizardPhoto = function (f, s, v) { window.__up.push([f && f.name, s, v]); }; showPhotoSourcePicker('s-test', 'RSV'); });
    await b.pg.waitForTimeout(400);
    const rs = await press(b.pg, '#picker-btn-paste');
    const up = await b.pg.evaluate(() => ({ up: window.__up, open: document.getElementById('photo-picker-sheet').classList.contains('open') }));
    ok('B2 photo slot — the 📋 Paste is in the chooser and on top', rs && rs.onTop, JSON.stringify(rs));
    ok('B2 photo slot — the picture goes to THAT slot through the upload, and the chooser closes', up.up.length === 1 && /^pasted-\d+\.png$/.test(up.up[0][0]) && up.up[0][1] === 's-test' && up.up[0][2] === 'RSV' && !up.open, JSON.stringify(up));
    // nothing copied → the words, nothing filed, the chooser stays
    await reset(b.pg);
    await b.pg.evaluate(() => { window.__up = []; window.__clip = 'text'; showPhotoSourcePicker('s-test', 'RSV'); });
    await b.pg.waitForTimeout(300);
    await press(b.pg, '#picker-btn-paste');
    const none = await b.pg.evaluate(() => ({ up: window.__up, t: window.__toasts, open: document.getElementById('photo-picker-sheet').classList.contains('open'), diary: JSON.parse(localStorage.getItem('rr_sync_log') || '[]').filter(x => x.e === 'paste').map(x => x.i) }));
    ok('B3 nothing but text copied → the "no picture" words, nothing filed, the chooser stays open, one diary line', !none.up.length && none.t.indexOf(WORDS.none) >= 0 && none.open && none.diary.length === 1 && /^none/.test(none.diary[0]), JSON.stringify(none));
    await b.pg.evaluate(() => { try { closePhotoPicker(); closeWizard(); } catch (e) {} });
    await b.pg.waitForTimeout(400);
    // picture-first: Paste starts the add like a picked picture
    await reset(b.pg);
    await b.pg.evaluate(() => { window.__pf = []; window._wizPicFirstTake = function (f) { window.__pf.push(f && f.name); }; _wizPicFirstChoose(); });
    await b.pg.waitForTimeout(300);
    const rp = await press(b.pg, '#wiz-picfirst-choose [data-pfc="paste"]');
    const pf = await b.pg.evaluate(() => window.__pf);
    ok('B4 picture-first — Paste hands the picture to the same start as a picked one', rp && rp.onTop && pf.length === 1 && /^pasted-\d+\.png$/.test(pf[0]), JSON.stringify({ rp, pf }));

    // ── Ctrl+V reaches the chooser on top, never a typing box ──
    const ctrlV = async (pg, target) => { await noCard(pg); return pg.evaluate(target => new Promise(res => {
      const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.toBlob(b => {
        const dt = new DataTransfer(); dt.items.add(new File([b], 'image.png', { type: 'image/png' }));
        const el = target ? document.querySelector(target) : document.body;
        if (el && el.focus) el.focus();
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        setTimeout(() => res(window.__fed.slice()), 400);
      }, 'image/png');
    }), target); };
    const clear = pg => pg.evaluate(() => { document.querySelectorAll('#bi-overlay,#_part-modal,#pin-src-ov').forEach(x => x.remove()); try { closeIdentify(); } catch (e) {} try { closeWizard(); } catch (e) {} try { errReportClose(); } catch (e) {} });
    await reset(b.pg); await b.pg.evaluate(() => errReportOpen()); await b.pg.waitForTimeout(700);
    let k = await ctrlV(b.pg);
    ok('K1 Report a problem open → Ctrl+V adds the picture to its screenshots', k.length === 1 && k[0].id === 'err-shots' && /^pasted-/.test(k[0].name), JSON.stringify(k));
    await reset(b.pg); k = await ctrlV(b.pg);
    ok('K1b a second Ctrl+V ADDS (2 pictures, not a swap)', k.length === 1 && k[0].id === 'err-shots' && k[0].n === 2, JSON.stringify(k));
    await clear(b.pg); await b.pg.waitForTimeout(400);
    await reset(b.pg); await b.pg.evaluate(() => window.openResearch()); await b.pg.waitForTimeout(1200);
    k = await ctrlV(b.pg);
    ok('K2 Research open → Ctrl+V goes to its picture box', k.length === 1 && k[0].id === 'bi-file', JSON.stringify(k));
    await clear(b.pg); await b.pg.waitForTimeout(400);
    await reset(b.pg); await b.pg.evaluate(() => window.openResearch()); await b.pg.waitForTimeout(1200);
    k = await ctrlV(b.pg, '#bi-quick');
    ok('K3 Research, the Item # box has the cursor → Ctrl+V is left to the typing box', k.length === 0, JSON.stringify(k));
    await clear(b.pg); await b.pg.waitForTimeout(400);
    await reset(b.pg); await b.pg.evaluate(() => { openWizard('collection'); setTimeout(function () { openIdentify(); }, 300); }); await b.pg.waitForTimeout(1200);
    k = await ctrlV(b.pg);
    ok('K4 Photo ID open over the Add screen → Ctrl+V goes to Photo ID\'s picture', k.length === 1 && k[0].id === 'id-file-gallery', JSON.stringify(k));
    await clear(b.pg); await b.pg.waitForTimeout(500);
    await reset(b.pg); await b.pg.evaluate(() => openWizard('collection')); await b.pg.waitForTimeout(900);
    k = await ctrlV(b.pg);
    ok('K5 the Add screen\'s first step (no picture box on it) → Ctrl+V files nothing anywhere', k.length === 0, JSON.stringify(k));
    await clear(b.pg); await b.pg.waitForTimeout(500);
    await reset(b.pg); await b.pg.evaluate(() => window._pinGo(document.getElementById('nav-photo-inbox'))); await b.pg.waitForTimeout(900);
    k = await ctrlV(b.pg);
    ok('K6 the Photo Inbox page → Ctrl+V adds the picture to the inbox', k.length === 1 && k[0].id === 'pin-file-input', JSON.stringify(k));
    await reset(b.pg); await b.pg.evaluate(() => { showPhotoSourcePicker && 0; showAddPartModal(); }); await b.pg.waitForTimeout(600);
    k = await ctrlV(b.pg);
    ok('K7 a part pop-up open over the Photo Inbox → Ctrl+V goes to the pop-up, not the inbox behind it', k.length === 1 && k[0].id === '_part-photo-input', JSON.stringify(k));
    ok('B5 no page errors on the computer roads', !b.errs.length, [...new Set(b.errs)].slice(0, 3).join(' | '));
    await b.ctx.close();
  }
  // phone and tablet: the slot chooser's Paste is on screen and can be tapped; Research's Paste too
  for (const S of [{ n: 'iPhone 390x844', w: 390, h: 844, ua: UA_IPAD.replace('iPad; CPU OS', 'iPhone; CPU iPhone OS'), mobile: true }, { n: 'iPad 1180x740', w: 1180, h: 740, ua: UA_IPAD, mobile: true }]) {
    const b = await boot(S);
    await b.pg.evaluate(() => { window.__up = []; openWizard('collection'); });
    await b.pg.waitForTimeout(900);
    await b.pg.evaluate(() => { window.uploadWizardPhoto = function (f, s, v) { window.__up.push([f && f.name, s, v]); }; showPhotoSourcePicker('s-test', 'LSV'); });
    await b.pg.waitForTimeout(500);
    const r = await press(b.pg, '#picker-btn-paste');
    const up = await b.pg.evaluate(() => window.__up);
    ok('B6 ' + S.n + ' — the slot chooser\'s 📋 Paste can be tapped and fills the slot', r && r.onTop && up.length === 1 && up[0][2] === 'LSV', JSON.stringify({ r, up }));
    await b.pg.evaluate(() => { try { closePhotoPicker(); closeWizard(); } catch (e) {} });
    await b.pg.waitForTimeout(500);
    await reset(b.pg);
    await b.pg.evaluate(() => window.openResearch()); await b.pg.waitForTimeout(1500);
    const r2 = await press(b.pg, '[data-bi="paste"]');
    const f2 = await fed(b.pg);
    ok('B7 ' + S.n + ' — Research\'s 📋 Paste beside Gallery can be tapped and fills its picture box', r2 && r2.onTop && f2.length === 1 && f2[0].id === 'bi-file', JSON.stringify({ r2, f2 }));
    await b.ctx.close();
  }

  // ── P: planted (browser) ──────────────────────────────────────────────────
  {
    // the Ctrl+V listener taking a typing box's paste
    const cfg = plant(CFG, "if (t && ((t.tagName === 'INPUT' && t.type !== 'file') || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;", '', 'P1');
    const b = await boot(DESK, { 'config.js': cfg });
    await b.pg.evaluate(() => window.openResearch()); await b.pg.waitForTimeout(1200);
    await reset(b.pg);
    const k = await b.pg.evaluate(() => new Promise(res => { const c = document.createElement('canvas'); c.width = 9; c.height = 9; c.toBlob(bl => { const dt = new DataTransfer(); dt.items.add(new File([bl], 'image.png', { type: 'image/png' })); const el = document.querySelector('#bi-quick'); el.focus(); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); setTimeout(() => res(window.__fed.slice()), 400); }, 'image/png'); }));
    ok('P1 the typing-box guard removed → K3 goes red (the picture is taken from the Item # box)', k.length === 1, JSON.stringify(k));
    await b.ctx.close();
  }
  {
    // the "on top" check removed → the inbox behind a pop-up takes the paste
    const cfg = plant(CFG, "  if (scope.contains(top)) return true;", '  return true;', 'P2');
    const b = await boot(DESK, { 'config.js': cfg });
    await b.pg.evaluate(() => window._pinGo(document.getElementById('nav-photo-inbox'))); await b.pg.waitForTimeout(900);
    await b.pg.evaluate(() => { document.getElementById('page-photo-inbox') && 0; });
    // a pop-up with NO picture box of its own over the inbox
    await b.pg.evaluate(() => { const d = document.createElement('div'); d.id = 'p2-pop'; d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000'; document.body.appendChild(d); });
    await reset(b.pg);
    const k = await b.pg.evaluate(() => new Promise(res => { const c = document.createElement('canvas'); c.width = 9; c.height = 9; c.toBlob(bl => { const dt = new DataTransfer(); dt.items.add(new File([bl], 'image.png', { type: 'image/png' })); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); setTimeout(() => res(window.__fed.slice()), 400); }, 'image/png'); }));
    ok('P2 the on-top check removed → a pop-up over the inbox no longer stops the inbox taking the paste (red)', k.length === 1 && k[0].id === 'pin-file-input', JSON.stringify(k));
    await b.ctx.close();
  }
  {
    // the slot chooser's Paste sending the picture nowhere
    const wiz = plant(read('wizard.js'), "        uploadWizardPhoto(f, sid, vk);\n      });\n    });", "      });\n    });", 'P3');
    const b = await boot(DESK, { 'wizard.js': wiz });
    await b.pg.evaluate(() => { window.__up = []; openWizard('collection'); }); await b.pg.waitForTimeout(900);
    await b.pg.evaluate(() => { window.uploadWizardPhoto = function (f, s, v) { window.__up.push([f && f.name, s, v]); }; showPhotoSourcePicker('s-test', 'RSV'); });
    await b.pg.waitForTimeout(300);
    await press(b.pg, '#picker-btn-paste');
    const up = await b.pg.evaluate(() => window.__up);
    ok('P3 the slot Paste not uploading → B2 goes red', up.length === 0, JSON.stringify(up));
    await b.ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
