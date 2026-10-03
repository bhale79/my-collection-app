#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DIM TEXT ON THE DARK CHROME — v0.9.1868   (real Chromium, the REAL app)
//
// Brad, 2026-10-03, the Maintenance card: "the text here and in other places
// that use this style of text is hard to see … how can we make this easier to
// see but still not be overpowering." That text is --text-dim — the quiet
// voice: helper sentences, placeholders, small panel headings, ~1,100 places.
// The cream area got its deep brown in v1852 (readable_text_tests); the navy
// panels were still wearing #6a5e48, which read 2.1–2.8:1 there.
//
// THE DESIGN he said "yes" to: one value for the dark chrome that reads at the
// same floor the cream words meet (RR_READABLE_MIN) on every dark panel and
// stays under --text-mid and --text, so the three voices keep their order; and
// the skin recipe aims for a contrast score instead of a fixed blend, with a
// live correction (rrSyncDimText) so ANY look — Santa Fe's red panels, a saved
// look from the old recipe — gets a quiet voice that still reads.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  dim_text_dark_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

async function open(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: /\.css$/.test(name) ? 'text/css' : 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    localStorage.clear();
    state.masterData = []; _rebuildMasterIndex(); state.personalData = {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

// the four built-in looks, as appearance.js ships them (eleven colours each)
const PRESETS = (() => {
  const src = rd('appearance.js');
  const blk = src.slice(src.indexOf('var BUILTIN_PRESETS = {'), src.indexOf('var USER_PRESETS_KEY'));
  const out = {};
  blk.replace(/'([^']+)':\s*(\{[^}]+\})/g, (m, name, obj) => { out[name] = JSON.parse(obj.replace(/'/g, '"')); return m; });
  return out;
})();

// What the page is wearing right now: the root's shade vs its darkest-to-lightest panels.
const SNAP = () => {
  const cs = getComputedStyle(document.documentElement);
  const g = v => cs.getPropertyValue(v).trim();
  const panels = ['--bg', '--surface', '--surface2', '--surface3'].map(g).filter(v => rrLuminance(v) != null);
  const lightest = panels.slice().sort((a, b) => rrLuminance(b) - rrLuminance(a))[0];
  const r2 = x => Math.round(x * 100) / 100;
  return {
    dim: g('--text-dim'), mid: g('--text-mid'), text: g('--text'), lightest,
    dimOnLightest: r2(rrContrast(g('--text-dim'), lightest)), midOnLightest: r2(rrContrast(g('--text-mid'), lightest)), textOnLightest: r2(rrContrast(g('--text'), lightest)),
    dimMinOverPanels: r2(Math.min.apply(null, panels.map(p => rrContrast(g('--text-dim'), p)))),
    rule: (document.getElementById('rr-dim-text') || {}).textContent || '',
    mainDim: getComputedStyle(document.querySelector('.main') || document.body).getPropertyValue('--text-dim').trim(),
  };
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: the stylesheet's own value, with the live correction switched off ──
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((SNAP) => {
      const snap = eval('(' + SNAP + ')');
      const out = {};
      const el = document.getElementById('rr-dim-text');
      out.hasSync = !!el;
      if (el) el.disabled = true;
      out.dark = snap();
      out.floor = RR_READABLE_MIN;
      // a REAL element on a REAL dark panel: the Extra Columns sentence (color:var(--text-dim))
      _openUserFieldsModal();
      const help = document.querySelector('#uf-modal-overlay .uf-help');
      let box = help; while (box && getComputedStyle(box).backgroundColor === 'rgba(0, 0, 0, 0)') box = box.parentElement;
      out.real = { color: getComputedStyle(help).color, bg: getComputedStyle(box).backgroundColor, contrast: Math.round(rrContrast(getComputedStyle(help).color, getComputedStyle(box).backgroundColor) * 100) / 100 };
      document.getElementById('uf-modal-overlay').remove();
      // the cream area and the other themes keep their own
      out.main = snap().mainDim;
      document.documentElement.dataset.theme = 'light'; out.light = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim();
      document.documentElement.dataset.theme = 'high-contrast'; out.hc = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim();
      document.documentElement.dataset.theme = 'dark';
      if (el) el.disabled = false;
      return out;
    }, SNAP.toString());
    T('A: no page errors', errs.join(' | '), '');
    T('A: the live correction exists on the page', r.hasSync, true);
    T('A: the dark chrome\'s dim shade reads at the floor on EVERY panel without any correction (lightest panel ' + r.dark.lightest + ')', [r.dark.dim, r.dark.dimMinOverPanels >= r.floor, r.floor], ['#aca084', true, 5]);
    T('A: …and the three voices keep their order: dim < mid < text', r.dark.dimOnLightest < r.dark.midOnLightest && r.dark.midOnLightest < r.dark.textOnLightest, true);
    T('A: a real helper sentence on a real dark panel reads ≥ 5', [r.real.contrast >= 5, r.real.color], [true, 'rgb(172, 160, 132)']);
    T('A: the cream area keeps its deep brown; the light and high-contrast themes keep their own', [r.main, r.light, r.hc], ['#6b5f4a', '#6b5f4a', '#c0c0c0']);
    await pg.close();
  }
  // ── PLANTED A: the stylesheet value as it was until v1867 ─────────────────
  {
    const css = rd('app.css');
    const anchor = '    --text-dim:  #aca084;';
    T('PLANTED A: the dark chrome\'s dim shade is declared once in app.css', css.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'app.css': css.replace(anchor, '    --text-dim:  #6a5e48;') });
    const r = await pg.evaluate((SNAP) => { const snap = eval('(' + SNAP + ')'); const el = document.getElementById('rr-dim-text'); if (el) el.disabled = true; const s = snap(); if (el) el.disabled = false; return s.dimMinOverPanels; }, SNAP.toString());
    T('PLANTED A: the old brown reads under 3 on the navy — caught', r < 3, true);
    await pg.close();
  }

  // ── B: every built-in look, worn as a custom skin, keeps a readable quiet voice ──
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async ([SNAP, PRESETS]) => {
      const snap = eval('(' + SNAP + ')');
      const out = {};
      for (const name of Object.keys(PRESETS)) {
        localStorage.setItem('lv_theme', 'custom'); localStorage.setItem('lv_skin_custom', JSON.stringify(PRESETS[name]));
        applyTheme(); await new Promise(r => setTimeout(r, 60));   // the <html> observer runs as a microtask
        out[name] = snap();
      }
      // back to the light theme: the correction must leave no trace
      localStorage.setItem('lv_theme', 'light'); applyTheme(); await new Promise(r => setTimeout(r, 60));
      out.light = { dim: getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim(), rule: (document.getElementById('rr-dim-text') || {}).textContent || '' };
      // high contrast is a CSS block the theme menu does not offer (only dark/light are registered); set it the way A did
      document.documentElement.dataset.theme = 'high-contrast'; await new Promise(r => setTimeout(r, 60));
      out.hc = { dim: getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim(), rule: (document.getElementById('rr-dim-text') || {}).textContent || '' };
      document.documentElement.dataset.theme = 'light';
      return out;
    }, [SNAP.toString(), PRESETS]);
    T('B: no page errors', errs.join(' | '), '');
    for (const name of Object.keys(PRESETS)) {
      const s = r[name];
      T('B: ' + name + ' — dim ≥ 5 and mid ≥ 6.5 on its lightest panel (' + s.lightest + '), in order under the text',
        [s.dimOnLightest >= 5, s.midOnLightest >= 6.5, s.dimOnLightest < s.midOnLightest && s.midOnLightest < s.textOnLightest], [true, true, true]);
    }
    T('B: the official look and Alaska need NO correction (the stylesheet value already reads); Santa Fe\'s red panels get one', [r['Rail Roster (official)'].rule, r['Alaska'].rule, /--text-dim:#[0-9a-f]{6} !important/.test(r['Santa Fe'].rule)], ['', '', true]);
    T('B: the light and high-contrast themes are left alone (no rule, their own values)', [r.light, r.hc], [{ dim: '#6b5f4a', rule: '' }, { dim: '#c0c0c0', rule: '' }]);
    await pg.close();
  }

  // ── C: a saved look carrying the OLD recipe's shades ──────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async ([SNAP, PRESETS]) => {
      const snap = eval('(' + SNAP + ')');
      const old = Object.assign({}, PRESETS['Alaska'], { '--text-dim': '#8d773e', '--text-mid': '#cfb676' });   // what the editor derived before v1868
      localStorage.setItem('lv_theme', 'custom'); localStorage.setItem('lv_skin_custom', JSON.stringify(old));
      applyTheme(); await new Promise(r => setTimeout(r, 60));
      const s = snap();
      return { inline: document.documentElement.style.getPropertyValue('--text-dim').trim(), computed: s.dim, dimOnLightest: s.dimOnLightest, midOnLightest: s.midOnLightest, ruled: /--text-dim:/.test(s.rule) };
    }, [SNAP.toString(), PRESETS]);
    T('C: no page errors', errs.join(' | '), '');
    T('C: the saved shade is still painted inline, but what the page WEARS is the lifted one (the rule beats the inline value) — dim ≥ 5, mid ≥ 6.5',
      [r.inline, r.computed !== '#8d773e', r.dimOnLightest >= 5, r.midOnLightest >= 6.5, r.ruled], ['#8d773e', true, true, true, true]);
    await pg.close();
  }
  // ── PLANTED C: a correction that only looks ───────────────────────────────
  {
    const src = rd('config.js');
    const anchor = "        css += p[0] + ':' + rrLiftFor(cur, text, lightest, p[1]) + ' !important;';\n";
    T('PLANTED C: the lift is written once in rrSyncDimText', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'config.js': src.replace(anchor, '        return;\n') });
    const r = await pg.evaluate(async ([SNAP, PRESETS]) => { const snap = eval('(' + SNAP + ')'); localStorage.setItem('lv_theme', 'custom'); localStorage.setItem('lv_skin_custom', JSON.stringify(PRESETS['Santa Fe'])); applyTheme(); await new Promise(r => setTimeout(r, 60)); return snap().dimOnLightest; }, [SNAP.toString(), PRESETS]);
    T('PLANTED C: on Santa Fe the quiet voice stays under 4 — caught', r < 4, true);
    await pg.close();
  }

  // ── D: the recipe the Appearance editor uses ──────────────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(async (PRESETS) => {
      const out = {};
      const r2 = x => Math.round(x * 100) / 100;
      for (const name of Object.keys(PRESETS)) {
        const p = PRESETS[name];
        const d = rrDeriveTextShades(p['--text'], p['--bg'], [p['--surface'], p['--surface2']]);
        const hardest = [p['--bg'], p['--surface'], p['--surface2']].sort((a, b) => rrLuminance(b) - rrLuminance(a))[0];
        out[name] = { dim: r2(rrContrast(d['--text-dim'], hardest)), mid: r2(rrContrast(d['--text-mid'], hardest)), text: r2(rrContrast(p['--text'], hardest)), keys: Object.keys(d).sort() };
      }
      // a light skin: the shades darken instead, measured on the darkest cream
      const l = rrDeriveTextShades('#2a2015', '#f8e8c0', ['#fffdf6', '#f5eeda', '#ede2cc']);
      out.light = { dim: r2(rrContrast(l['--text-dim'], '#ede2cc')), mid: r2(rrContrast(l['--text-mid'], '#ede2cc')), dimLighterThanMid: rrLuminance(l['--text-dim']) > rrLuminance(l['--text-mid']) };
      // the editor for real: Preview a look built on Santa Fe's red — what the page wears must read
      window._subState = { sub: 'beta' };
      window.openAppearance(); await new Promise(r => setTimeout(r, 300));
      window._rrapRoleColor('--bg', '#1c0908'); window._rrapRoleColor('--surface', '#8c1c13');
      window._rrapPreview(); await new Promise(r => setTimeout(r, 120));
      const cs = getComputedStyle(document.documentElement), g = v => cs.getPropertyValue(v).trim();
      const panels = ['--bg', '--surface', '--surface2', '--surface3'].map(g).filter(v => rrLuminance(v) != null);
      const lightest = panels.sort((a, b) => rrLuminance(b) - rrLuminance(a))[0];
      out.preview = { lightest, dim: r2(rrContrast(g('--text-dim'), lightest)), mid: r2(rrContrast(g('--text-mid'), lightest)) };
      window._rrapCancel(); await new Promise(r => setTimeout(r, 120));
      out.afterCancel = { rule: (document.getElementById('rr-dim-text') || {}).textContent || '', dim: getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() };
      return out;
    }, PRESETS);
    T('D: no page errors', errs.join(' | '), '');
    for (const name of Object.keys(PRESETS)) {
      T('D: the recipe for ' + name + ' — dim ≥ 5, mid ≥ 6.5 on its lightest panel, both under the text, both shades returned',
        [r[name].dim >= 5, r[name].mid >= 6.5, r[name].dim < r[name].mid && r[name].mid < r[name].text, r[name].keys], [true, true, true, ['--text-dim', '--text-mid']]);
    }
    T('D: a light skin darkens instead — dim ≥ 5, mid ≥ 6.5 on the darkest cream, dim the lighter (quieter) of the two', [r.light.dim >= 5, r.light.mid >= 6.5, r.light.dimLighterThanMid], [true, true, true]);
    T('D: the real editor, previewing a red look — the page wears a dim ≥ 5 and a mid ≥ 6.5 on the lightest panel', [r.preview.dim >= 5, r.preview.mid >= 6.5], [true, true]);
    T('D: Cancel takes the previewed look OFF the page — the stylesheet value is back and no rule is left behind (a Cancel from the Preview bar used to leave every previewed colour painted; fixed v1868)', r.afterCancel, { rule: '', dim: '#aca084' });
    await pg.close();
  }
  // ── PLANTED D: the recipe without its lift (the fixed blend of old) ───────
  {
    const src = rd('config.js');
    const anchor = "  if (dark) { mid = rrLiftFor(mid, text, hardest, RR_READABLE_MIN + RR_MID_MARGIN); dim = rrLiftFor(dim, text, hardest, RR_READABLE_MIN); }\n";
    T('PLANTED D: the dark-panel lift is written once in rrDeriveTextShades', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'config.js': src.replace(anchor, '  if (dark) { }\n') });
    const r = await pg.evaluate((PRESETS) => { const p = PRESETS['Santa Fe']; const d = rrDeriveTextShades(p['--text'], p['--bg'], [p['--surface'], p['--surface2']]); return Math.round(rrContrast(d['--text-dim'], p['--surface']) * 100) / 100; }, PRESETS);
    T('PLANTED D: the fixed blend leaves Santa Fe\'s quiet voice under 4 — caught', r < 4, true);
    await pg.close();
  }

  // ── SRC: one recipe, wired to the one door ────────────────────────────────
  {
    const cfg = code(rd('config.js')), ap = code(rd('appearance.js')), wiz = code(rd('wizard.js'));
    T('SRC: the live correction is part of the one sync the <html> observer runs', /function rrSyncInk\(\) \{ rrSyncInkOnAccent\(\); rrSyncReadableText\(\); rrSyncDimText\(\); \}/.test(cfg), true);
    T('SRC: the editor\'s shade recipe is the shared one, fed the skin\'s own panels', /rrDeriveTextShades\(textHex, bgHex, panels\)/.test(ap) && /\[_cur\('--surface'\), _cur\('--surface2'\), _cur\('--surface3'\)\]/.test(ap), true);
    T('SRC: setting a background derives the panels first and --bg last, so the shades see the panels they sit on', /\.sort\(function \(a, b\) \{ return \(a === '--bg'\) - \(b === '--bg'\); \}\)\.forEach/.test(ap), true);
    T('SRC: the wizard\'s "A Dummy" box-condition number uses the dim voice, not its old brown', (wiz.match(/'A Dummy Box Condition', 'var\(--text-dim\)'/g) || []).length === 2 && !/6a5e48/.test(wiz), true);
    const files = fs.readdirSync(APP).filter(f => /\.(js|css|html)$/.test(f) && f !== 'tests-onboarding.js');
    T('SRC: the old brown is gone from the app (comments aside)', files.filter(f => /6a5e48/i.test(code(rd(f)).replace(/\/\*[\s\S]*?\*\//g, ''))), []);
  }

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
