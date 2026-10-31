#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// A 📅 BUTTON OPENS ITS CALENDAR ON OLDER IPHONES TOO — v0.9.2073
// (known-problems sweep, release 8, type A8)
//
// Seven 📅 buttons beside date boxes called input.showPicker(), which iPhones
// before iOS 16.4 (and older desktop browsers) do not have: the call threw and
// the button did nothing. Now every one calls config.js rrOpenDatePicker(id):
// showPicker where it exists; otherwise (missing, or refused) the date box is
// focused and clicked — how an older iPhone opens its date wheel.
//   S  source: no app file calls showPicker except the one helper; every
//      "Open calendar" control calls the helper — each proven on planted
//      offenders.
//   B  the real page in Chromium: the real helper with showPicker present
//      (used, once), missing (an older iPhone: the date box takes focus, no
//      error) and refusing (falls back); then EACH of the 7 real buttons — its
//      on-click text lifted from the app's own source — pressed in "older
//      iPhone" mode opens its own date box.
//   P  the old helper served (showPicker only) — the older-iPhone checks go red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const FILES = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/vendor|\.min\./.test(f));
const CFG = read('config.js');

// ── S ──
function helperBody(src) {
  const i = src.indexOf('function rrOpenDatePicker(');
  if (i < 0) return '';
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j + 2);
}
function showPickerCalls(name, src) {
  if (name === 'config.js') src = src.replace(helperBody(src), '');
  const out = [];
  src.split('\n').forEach((ln, i) => { if (!/^\s*\/\//.test(ln) && /\.showPicker\s*\(|\[\s*['"]showPicker['"]\s*\]\s*\(/.test(ln)) out.push(name + ':' + (i + 1)); });
  return out;
}
let raw = []; for (const f of FILES) raw = raw.concat(showPickerCalls(f, read(f)));
ok('S0 the helper exists once, in config.js', FILES.filter(f => /function rrOpenDatePicker\(/.test(read(f))).join(',') === 'config.js');
ok('S1 no app file calls showPicker except the one helper', !raw.length, raw.join(' | '));
ok('S1-P1 the old 📅 line — caught', showPickerCalls('p.js', `onclick="event.preventDefault();document.getElementById(&quot;pvDate&quot;).showPicker();"`).length === 1);
ok('S1-P2 a bracket spelling — caught', showPickerCalls('p.js', `el['showPicker']();`).length === 1);
ok('S1-G a comment that names it — not counted', !showPickerCalls('g.js', `// the old code called .showPicker() here`).length);
// every "Open calendar" control (by its words) calls the helper
function calendarControls(src) {
  const out = [];
  const re = /<(button|span|div)\b([^<>]{0,900}?)>/g; let m;
  while ((m = re.exec(src))) {
    const a = m[2];
    if (!/(aria-label|title)\s*=\s*\\?["']Open calendar/.test(a)) continue;
    out.push({ ok: /rrOpenDatePicker\(/.test(a), at: src.slice(0, m.index).split('\n').length });
  }
  return out;
}
let cal = []; for (const f of FILES) cal = cal.concat(calendarControls(read(f)).map(c => Object.assign({ f }, c)));
ok('S2 all 7 "Open calendar" controls call rrOpenDatePicker', cal.length === 7 && cal.every(c => c.ok), JSON.stringify(cal.filter(c => !c.ok)) + ' n=' + cal.length);
ok('S2-P a calendar control that does something else — caught', calendarControls(`'<button aria-label="Open calendar" onclick="openIt()">x</button>'`).some(c => !c.ok));

// the 7 real on-click texts, lifted from the source, for B
const REAL = [];
for (const f of ['wizard.js', 'wizard-handlers.js']) {
  const s = read(f);
  const re = /onclick=(["'])((?:(?!\1).)*?rrOpenDatePicker\((?:&quot;|\\?')([^&'\\]*?)(?:' \+ key \+ ')?([^&'\\]*?)(?:&quot;|\\?')\)[^"']*)\1/g; let m;
  while ((m = re.exec(s))) {
    let code = m[2].replace(/&quot;/g, '"').replace(/\\'/g, "'").replace(/' \+ key \+ '/g, 'datePurchased');
    const id = (code.match(/rrOpenDatePicker\(["']([^"']+)["']\)/) || [])[1];
    REAL.push({ f, line: s.slice(0, m.index).split('\n').length, code, id });
  }
}
ok('S3 the 7 real buttons were lifted from the source for the browser check', REAL.length === 7 && REAL.every(r => r.id), JSON.stringify(REAL.map(r => r.f + ':' + r.line + ' ' + r.id)));

// ── B ──
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  date_button_2073_tests needs playwright for its browser half and it is not installed.'); process.exit(1); }

async function run(browser, cfgSrc) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await pg.setContent('<!doctype html><body></body>');
  // the REAL helper, lifted from config.js (or a planted copy)
  await pg.addScriptTag({ content: helperBody(cfgSrc) + '\nwindow.rrOpenDatePicker = rrOpenDatePicker;' });
  const R = await pg.evaluate(async (REAL) => {
    const out = {};
    const mk = (id) => { const i = document.createElement('input'); i.type = 'date'; i.id = id; document.body.appendChild(i); return i; };
    const proto = HTMLInputElement.prototype, orig = proto.showPicker;
    // 1. showPicker present: used, once, no focus fallback
    let calls = 0; proto.showPicker = function () { calls++; };
    const a = mk('a'); document.body.focus();
    out.present = { r: rrOpenDatePicker('a'), calls, focused: document.activeElement === a };
    // 2. an older iPhone: no showPicker at all
    delete proto.showPicker; Object.defineProperty(proto, 'showPicker', { value: undefined, configurable: true, writable: true });
    const b = mk('b'); let threw = null;
    try { out.missingR = rrOpenDatePicker('b'); } catch (e) { threw = e.message; }
    out.missing = { threw, focused: document.activeElement === b };
    // 3. showPicker refuses (NotAllowedError): falls back
    proto.showPicker = function () { throw new DOMException('not allowed', 'NotAllowedError'); };
    const c = mk('c'); threw = null;
    try { rrOpenDatePicker(c); } catch (e) { threw = e.message; }
    out.refused = { threw, focused: document.activeElement === c };
    // 4. each REAL button's on-click, pressed on an older iPhone
    proto.showPicker = undefined;
    out.real = [];
    for (const r of REAL) {
      document.body.innerHTML = '';
      const inp = mk(r.id);
      const btn = document.createElement('button'); btn.setAttribute('onclick', r.code); btn.textContent = '📅'; document.body.appendChild(btn);
      document.body.focus(); let err = null;
      window.onerror = (m) => { err = String(m); };
      btn.click();
      await new Promise(res => setTimeout(res, 30));
      out.real.push({ at: r.f + ':' + r.line, id: r.id, focused: document.activeElement === inp, err });
    }
    if (orig) proto.showPicker = orig;
    return out;
  }, REAL);
  R.errs = errs;
  await ctx.close();
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  const R = await run(browser, CFG);
  ok('B1 showPicker present: it is used, once, with no extra focus', R.present.r === true && R.present.calls === 1 && !R.present.focused, JSON.stringify(R.present));
  ok('B2 an older iPhone (no showPicker): no error, the date box takes the tap', R.missing.threw === null && R.missing.focused === true, JSON.stringify(R.missing));
  ok('B3 showPicker refuses: no error, falls back to the date box', R.refused.threw === null && R.refused.focused === true, JSON.stringify(R.refused));
  for (const x of R.real) ok('B4 ' + x.at + ' — its 📅 opens "' + x.id + '" on an older iPhone', x.focused && !x.err, JSON.stringify(x));
  ok('B5 no page errors', !R.errs.length, R.errs.join(' | '));

  // ── P — the old behaviour served ──
  const OLD = plant(CFG, "  try { if (typeof el.showPicker === 'function') { el.showPicker(); return true; } } catch (e) {}\n  try { el.focus(); } catch (e) {}\n  try { el.click(); } catch (e) {}\n  return false;",
    "  el.showPicker(); return true;", 'P1');
  const P = await run(browser, OLD);
  ok('P1 the old call (showPicker only) — an older iPhone turns red', !(P.missing.threw === null && P.missing.focused) && P.real.every(x => !x.focused), JSON.stringify([P.missing, P.real.map(x => x.focused)]));
  const NOFALL = plant(CFG, "  try { el.focus(); } catch (e) {}\n  try { el.click(); } catch (e) {}\n", '', 'P2');
  const P2 = await run(browser, NOFALL);
  ok('P2 no fallback (the refusal swallowed) — the refused case turns red', !P2.refused.focused && !P2.missing.focused, JSON.stringify([P2.refused, P2.missing]));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
