// ══════════════════════════════════════════════════════════════════
// variation-picker.js — "Help me pick my variation" guided question funnel
//
// Generates questions LIVE by diffing an item's COTT variation descriptions
// (the WITH / WITHOUT feature checklists). One question at a time, big tap
// options, "Not sure" narrows to finalists, ends on a confirm screen.
// Confidence-gated: only emits a question it can phrase cleanly; if an item
// yields none, the button never shows and the normal variation list stands.
//
// Public:  _vpGenerate(rows) -> [questions]   (also used to gate the button)
//          openVariationPicker()              (reads window._vpRows/_vpItemNum)
// Selection reuses the wizard's own wizardChooseVariation(id).
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ---- plain-language glossary (Brad-reviewed; COTT deep-links added later) ----
  var VP_GLOSSARY = {
    'bar end trucks': 'Metal trucks with a solid bar across each end — common from about 1945 to 1960.',
    'bar-end trucks': 'Metal trucks with a solid bar across each end — common from about 1945 to 1960.',
    'aar trucks': 'Plastic "AAR"-style trucks used from the late 1950s onward.',
    'arch bar trucks': 'Early trucks with open, arched metal side frames.',
    'staple end trucks': 'Metal trucks whose coupler is held on by a staple-shaped pin (early postwar).',
    'flying shoe': 'An early sliding-shoe pickup/coupler activator under the truck.',
    'magnetic couplers': 'Couplers that pop open over a magnet built into special track sections.',
    'coil couplers': 'Earlier couplers opened by an electromagnetic coil inside the truck.',
    'magnetraction': 'Magnets in the wheels/axles for better grip on the rails — introduced in 1950.',
    'traction tire': 'A small rubber tire on a drive wheel for extra pulling grip.',
    'traction tires': 'Small rubber tires on the drive wheels for extra pulling grip.',
    'e unit': 'The reversing unit that cycles the engine forward, neutral, reverse.',
    'e-unit': 'The reversing unit that cycles the engine forward, neutral, reverse.',
    'heat stamped': 'Lettering pressed in with a heated die — crisp and slightly recessed.',
    'rubber stamped': 'Lettering applied with an inked rubber stamp — can look lighter or uneven.',
    'roof nick': 'A small notch in the roof mold near one corner.',
    'spreader bar': 'A bar across the inside of a gondola/hopper; some molds have holes for it.',
    'sheave': 'The grooved pulley wheel on a crane boom.',
    'bulkhead': 'An end wall on a flatcar or tender.',
    'reinforcements': 'Extra molded ribs added to a frame for strength.',
    'hyphens in the weight data': 'The little dashes in the small "weight / dimensional" data stamped on the side.'
  };

  function _vpEsc(x) {
    return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function _vpCap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---- clause parsing ----
  var VP_JUNK = /box flap|classic box|picture box|\bcarton\b|\bbox\b|came in|courtesy|blowup|art deco|this is lionel|need pictures?|shown (below|above|for)|for comparison|var\./i;
  var VP_STRIP = /\(no\.[^)]*\)|\bb0\d+\b|\bk0\d+\b|\bss\d+\b|\bse\d+\b|\bkw\s*\d+\b|top view.*|side view.*|front view.*|the reverse.*|#\s*[\w-]+|mid classic.*|hagerstown.*/gi;
  var VP_STOP = { 'with': 1, 'without': 1, 'painted': 1, 'the': 1, 'a': 1, 'of': 1, 'in': 1, 'on': 1, 'and': 1, 'has': 1, 'have': 1, 'to': 1, 'for': 1, 'at': 1, 'is': 1 };
  var VP_COLORS = { black: 1, white: 1, red: 1, blue: 1, green: 1, orange: 1, brown: 1, gray: 1, grey: 1, yellow: 1, tan: 1, silver: 1, gold: 1, maroon: 1, clear: 1, translucent: 1, olive: 1, jade: 1, copper: 1, pink: 1, cream: 1, teal: 1 };
  var VP_KEYS = ['doors', 'door', 'lettering', 'shell', 'trucks', 'truck', 'couplers', 'coupler', 'stack', 'railing', 'railings', 'frame', 'roof', 'rivet', 'rivets', 'magnetraction', 'magnetic', 'traction', 'tabs', 'bulkhead', 'whistle', 'horn', 'number', 'stripe', 'toolboxes', 'steps', 'ladder', 'catwalk', 'hatch', 'dome', 'platform', 'handrail', 'stanchions', 'date', 'built', 'reinforcements', 'hyphen', 'hyphens', 'spreader', 'generator', 'sheave'];
  var VP_STEM = {
    doors: 'The loading doors are…', door: 'The doors are…', lettering: 'The lettering is…',
    shell: 'The shell / body is…', trucks: 'The trucks are…', truck: 'The trucks are…',
    couplers: 'The couplers are…', roof: 'Does it have a roof nick?', rivets: 'The rivets…',
    magnetraction: 'Does it have Magnetraction?', whistle: 'Does it have a whistle?',
    horn: 'Does it have a horn?', reinforcements: 'Does the frame have reinforcements?',
    hyphens: 'Hyphens in the weight-data line?', hatch: 'The hatch covers are…',
    number: 'The number is…', stripe: 'Does it have a stripe?', spreader: 'Does it have spreader-bar holes?',
    date: 'The date stamp is…', built: 'The built date is…', traction: 'Does it have traction tires?',
    bulkhead: 'The bulkhead is…', stack: 'The stack is…'
  };
  var VP_CLEAN = /^[a-z0-9][a-z0-9 \-"/]{0,28}$/;
  var VP_BAREKEY = { shell: 1, doors: 1, door: 1, lettering: 1, trucks: 1, truck: 1, roof: 1, frame: 1, stack: 1, hatch: 1, number: 1, couplers: 1, coupler: 1, rivets: 1, sheave: 1 };
  var VP_OPT_SUFFIX = { doors: 'block', door: 'block' };
  var VP_DOOR_IMG = { single: 'https://cornucopiaoftoytrains.com/wp-content/uploads/2023/01/IMG_1831-2.jpg', multi: 'https://cornucopiaoftoytrains.com/wp-content/uploads/2023/02/IMG_1900.jpg' };
  var VP_GI_BASE = 'https://cornucopiaoftoytrains.com/';
  var VP_GI_BYTYPE = {
    'Boxcar': ['boxcars-general-information-a', '6464 boxcar general info'],
    'Flatcar': ['flatcars-general-information-a', 'flatcar general info'],
    'Tender': ['postwar-tenders-general', 'tender general info'],
    'Passenger Car': ['passenger-general-type-passenger-cars', 'passenger-car general info'],
    'Steam Locomotive': ['steam-general-type-locomotives', 'steam locomotive general info'],
    'Caboose': ['general-information-about-sp-type-cabooses', 'SP-type caboose general info']
  };
  function _vpGiLink(slug, label) {
    return '<a href="' + VP_GI_BASE + slug + '/" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--accent2);text-decoration:none">' + label + ' \u2197</a>';
  }
  function _vpGiFooter() {
    var e = (VP && VP.itemType) ? VP_GI_BYTYPE[VP.itemType] : null;
    if (!e) return '';
    return '<div style="text-align:center;margin-top:10px;border-top:1px solid var(--border);padding-top:9px;font-size:0.78rem">' + _vpGiLink(e[0], e[1]) + '</div>';
  }

  function _vpClauses(t) {
    t = String(t || '').replace(/\s+/g, ' ').replace(/[”“]/g, '"').replace(VP_STRIP, ' ');
    var out = [];
    t.split(/·|;|•|\n/).forEach(function (seg) {
      seg.split(/(?=(?:^|\s)with(?:out)?\s)/i).forEach(function (m) {
        var s = m.replace(/\s+/g, ' ').trim().replace(/^[,.\s]+|[,.\s]+$/g, '').toLowerCase();
        if (s.length >= 4 && !VP_JUNK.test(s)) out.push(s);
      });
    });
    return out;
  }
  function _vpWordsArr(s) { return (String(s).match(/[a-z0-9\-']+/g) || []).filter(function (w) { return !VP_STOP[w]; }); }
  function _vpFkey(cl) {
    var w = String(cl).match(/[a-z0-9\-']+/g) || [];
    for (var i = 0; i < VP_KEYS.length; i++) { if (w.indexOf(VP_KEYS[i]) >= 0) return VP_KEYS[i]; }
    var c = w.filter(function (x) { return !VP_STOP[x]; });
    return c.length ? c[c.length - 1] : String(cl).slice(0, 8);
  }
  function _vpNorm(s) { return String(s).replace(/\s+/g, ' ').trim().replace(/(\w)s\b/g, '$1'); }

  // ---- generator: rows -> array of clean question objects ----
  // each question: { stem, type:'yn'|'cat', opts:{ variationId -> value }, key }
  function _vpGenerate(rows) {
    rows = (rows || []).filter(function (v) { return v && v.variation; });
    if (rows.length < 2) return [];
    var sets = rows.map(function (v) { return _vpClauses(v.varDesc || v.description || ''); });
    var common = {};
    if (sets.length) {
      sets[0].forEach(function (c) {
        if (sets.every(function (s) { return s.indexOf(c) >= 0; })) common[c] = 1;
      });
    }
    var groups = {};
    sets.forEach(function (s, i) {
      var seen = {};
      s.forEach(function (cl) {
        if (common[cl] || seen[cl]) return; seen[cl] = 1;
        var k = _vpFkey(cl);
        (groups[k] = groups[k] || {});
        (groups[k][cl] = groups[k][cl] || []).push(i);
      });
    });
    var nV = rows.length, out = [];
    Object.keys(groups).forEach(function (k) {
      var clmap = groups[k], cls = Object.keys(clmap);
      var present = {};
      cls.forEach(function (cl) { clmap[cl].forEach(function (i) { present[i] = 1; }); });
      var memberWordSets = cls.map(function (cl) { var o = {}; _vpWordsArr(cl).forEach(function (w) { o[w] = 1; }); return o; });
      var gcommon = {};
      if (memberWordSets.length) {
        Object.keys(memberWordSets[0]).forEach(function (w) {
          if (memberWordSets.every(function (ms) { return ms[w]; })) gcommon[w] = 1;
        });
      }
      var labels = {};
      cls.forEach(function (cl) {
        var diff = _vpWordsArr(cl).filter(function (w) { return !gcommon[w]; });
        var col = diff.filter(function (w) { return VP_COLORS[w]; });
        var lab = (col.length ? col.join(' ') : diff.join(' ')).trim();
        clmap[cl].forEach(function (i) { labels[i] = lab; });
      });
      var absent = []; for (var i = 0; i < nV; i++) { if (!present[i]) absent.push(i); }
      var presNorm = {}; Object.keys(present).forEach(function (i) { presNorm[_vpNorm(labels[i] || '')] = 1; });
      var isYN = absent.length > 0 && Object.keys(presNorm).length <= 1 && VP_STEM[k] && /\?$/.test(VP_STEM[k]);
      if (isYN) {
        var o1 = {}; for (var a = 0; a < nV; a++) { o1[rows[a].variation] = present[a] ? 'yes' : 'no'; }
        out.push({ stem: VP_STEM[k], type: 'yn', opts: o1, key: k });
        return;
      }
      if (absent.length) return; // categorical needs a value for every variation
      var lab2 = []; for (var b = 0; b < nV; b++) { lab2.push(labels[b] || ''); }
      var allclean = lab2.every(function (l) { return l && VP_CLEAN.test(l) && !VP_BAREKEY[l]; });
      var distinct = {}; lab2.forEach(function (l) { if (l) distinct[_vpNorm(l)] = 1; });
      if (Object.keys(distinct).length >= 2 && allclean) {
        var o2 = {}, _suf = VP_OPT_SUFFIX[k];
        for (var d = 0; d < nV; d++) { var _lv = lab2[d]; if (_suf && _lv && _lv.indexOf(_suf) < 0) _lv = _lv + ' ' + _suf; o2[rows[d].variation] = _lv; }
        out.push({ stem: VP_STEM[k] || ('The ' + k + ' is…'), type: 'cat', opts: o2, key: k });
      }
    });
    out.sort(function (x, y) { return _vpDistinct(y) - _vpDistinct(x); });
    return out;
  }
  function _vpDistinct(q, cands) {
    var d = {}, keys = cands || Object.keys(q.opts);
    keys.forEach(function (v) { if (q.opts[v] != null) d[q.opts[v]] = 1; });
    return Object.keys(d).length;
  }
  window._vpGenerate = _vpGenerate;

  // ---- funnel state + rendering ----
  var VP = null;

  function openVariationPicker() {
    var rows = (window._vpRows || []).filter(function (v) { return v && v.variation; });
    var qs = _vpGenerate(rows);
    if (!rows.length) return;
    VP = {
      rows: rows,
      byId: rows.reduce(function (m, r) { m[r.variation] = r; return m; }, {}),
      questions: qs,
      used: {},
      cands: rows.map(function (r) { return r.variation; }),
      itemNum: window._vpItemNum || '',
      itemType: window._vpItemType || (rows[0] || {}).itemType || ''
    };
    _vpEnsureModal();
    var _vpm = document.getElementById('vp-modal'); _vpm.classList.add('open'); _vpm.style.display = 'flex';
    if (window.BackStack) window.BackStack.push('variation-picker', closeVariationPicker);
    _vpRender();
  }
  window.openVariationPicker = openVariationPicker;

  function closeVariationPicker() {
    var m = document.getElementById('vp-modal');
    if (m) { m.classList.remove('open'); m.style.display = 'none'; }
    if (window.BackStack) window.BackStack.pop('variation-picker');
    VP = null;
  }
  window.closeVariationPicker = closeVariationPicker;

  function _vpEnsureModal() {
    if (document.getElementById('vp-modal')) return;
    var d = document.createElement('div');
    d.id = 'vp-modal';
    d.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.55)';
    d.innerHTML = '<div id="vp-sheet" style="width:100%;max-width:520px;background:var(--bg,#14162e);border:1px solid var(--border);border-radius:18px 18px 0 0;max-height:90vh;overflow:auto;padding:0"></div>';
    d.addEventListener('click', function (e) { if (e.target === d) closeVariationPicker(); });
    document.body.appendChild(d);
    var st = document.createElement('style');
    st.textContent = '#vp-modal.open{display:flex}#vp-modal .vpbtn{display:block;width:100%;text-align:left;margin:8px 0;padding:13px 15px;font-size:0.95rem;border-radius:11px;cursor:pointer;border:2px solid var(--border);background:var(--surface2,#1d2040);color:var(--text);font-family:var(--font-body)}#vp-modal .vpbtn:hover{border-color:var(--accent)}#vp-modal .vpacc{border-color:var(--accent);background:rgba(232,64,28,0.10)}';
    document.head.appendChild(st);
  }

  function _vpHeader(sub) {
    return '<div style="position:sticky;top:0;background:var(--surface,#1a1d3a);border-bottom:1px solid var(--border);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-radius:18px 18px 0 0">'
      + '<div><div style="font-size:1rem;font-weight:600;color:var(--text)">Help me pick my variation</div>'
      + '<div style="font-size:0.78rem;color:var(--text-dim)">' + _vpEsc(VP.itemNum) + (sub ? ' · ' + sub : '') + '</div></div>'
      + '<button type="button" onclick="closeVariationPicker()" aria-label="Close" style="background:none;border:none;color:var(--text-dim);font-size:1.5rem;line-height:1;cursor:pointer;padding:4px 8px">×</button>'
      + '</div>';
  }

  // glossary hits inside a piece of text
  function _vpGlossHits(text) {
    var t = ' ' + String(text).toLowerCase() + ' ', hits = [], seen = {};
    Object.keys(VP_GLOSSARY).forEach(function (term) {
      if (t.indexOf(term) >= 0 && !seen[VP_GLOSSARY[term]]) { seen[VP_GLOSSARY[term]] = 1; hits.push([term, VP_GLOSSARY[term]]); }
    });
    return hits;
  }
  function _vpDoorCompare() {
    function cell(src, label) {
      return '<div style="flex:1;text-align:center">'
        + '<img src="' + src + '" alt="' + label + ' door" style="width:100%;max-width:148px;border-radius:8px;border:1px solid var(--border);display:block;margin:0 auto">'
        + '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:5px;font-weight:600">' + label + '</div></div>';
    }
    return '<div style="display:flex;gap:10px;margin:8px 0 4px;align-items:flex-start">'
      + cell('door-single.png', 'Single-block') + cell('door-multi.png', 'Multi-block')
      + '</div>';
  }
  function _vpTermsPanel(texts) {
    var all = [], seen = {};
    texts.forEach(function (tx) { _vpGlossHits(tx).forEach(function (h) { if (!seen[h[0]]) { seen[h[0]] = 1; all.push(h); } }); });
    var joined = texts.join(' ').toLowerCase();
    var doorPic = (/block|door/.test(joined)) ? _vpDoorCompare() : '';
    var topicLink = (/truck|coupler/.test(joined)) ? '<div style="margin-top:6px">' + _vpGiLink('postwar-trucks', 'Full trucks &amp; couplers guide on COTT') + '</div>' : '';
    if (!all.length && !doorPic && !(/truck|coupler/.test(joined))) return '';
    var rows = all.map(function (h) {
      return '<div style="margin:6px 0"><span style="color:var(--accent2);font-weight:600">' + _vpEsc(_vpCap(h[0])) + '</span> — <span style="color:var(--text-mid)">' + _vpEsc(h[1]) + '</span></div>';
    }).join('');
    return '<details style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">'
      + '<summary style="cursor:pointer;font-size:0.82rem;color:var(--accent2);list-style:none">What do these terms mean?</summary>'
      + '<div style="font-size:0.82rem;line-height:1.5;margin-top:8px">' + doorPic + rows + topicLink + '</div></details>';
  }

  // pick the best unused question that splits current candidates
  function _vpNextQ() {
    var best = null, bestN = 1;
    VP.questions.forEach(function (q) {
      if (VP.used[q.key]) return;
      var n = _vpDistinct(q, VP.cands);
      if (n > bestN) { bestN = n; best = q; }
    });
    return best;
  }

  function _vpRender() {
    var sheet = document.getElementById('vp-sheet');
    if (VP.cands.length === 1) return _vpConfirm(VP.cands[0], true);
    var q = _vpNextQ();
    if (!q) return _vpFinalists();

    // distinct option values among current candidates
    var vals = [], seen = {};
    VP.cands.forEach(function (id) { var v = q.opts[id]; if (v != null && !seen[v]) { seen[v] = 1; vals.push(v); } });
    var labels = vals.map(function (v) {
      return q.type === 'yn' ? (v === 'yes' ? 'Yes' : 'No') : _vpCap(v);
    });

    var html = _vpHeader(VP.cands.length + ' left');
    html += '<div style="padding:18px">';
    html += '<div style="font-size:1.05rem;font-weight:600;color:var(--text);margin-bottom:4px;line-height:1.35">' + _vpEsc(q.stem) + '</div>';
    vals.forEach(function (v, i) {
      html += '<button type="button" class="vpbtn" onclick="_vpAnswer(\'' + encodeURIComponent(v) + '\')">' + _vpEsc(labels[i]) + '</button>';
    });
    html += '<button type="button" class="vpbtn" style="border-style:dashed;color:var(--text-dim)" onclick="_vpSkip()">Not sure / can’t tell</button>';
    html += _vpTermsPanel([q.stem].concat(labels));
    html += '<button type="button" onclick="closeVariationPicker()" style="display:block;margin:14px auto 4px;background:none;border:none;color:var(--text-dim);font-size:0.8rem;cursor:pointer">Cancel</button>';
    html += _vpGiFooter();
    html += '</div>';
    sheet.innerHTML = html;
  }

  window._vpAnswer = function (vEnc) {
    var v = decodeURIComponent(vEnc);
    var q = _vpNextQ();
    if (!q) return;
    VP.used[q.key] = 1;
    VP.cands = VP.cands.filter(function (id) { return String(q.opts[id]) === String(v); });
    _vpRender();
  };
  window._vpSkip = function () {
    var q = _vpNextQ();
    if (q) VP.used[q.key] = 1;
    _vpRender();
  };

  function _vpCardHtml(id) {
    var r = VP.byId[id] || {};
    var desc = _vpEsc(r.varDesc || r.description || 'No description');
    return '<div style="background:var(--surface2,#1d2040);border:1px solid var(--border);border-radius:11px;padding:12px;margin:8px 0">'
      + '<div style="font-family:var(--font-mono);font-size:0.95rem;font-weight:600;color:var(--accent2);margin-bottom:4px">Variation ' + _vpEsc(id) + (r.cottCode ? ' · ' + _vpEsc(r.cottCode) : '') + '</div>'
      + '<div style="font-size:0.82rem;color:var(--text-mid);line-height:1.5">' + desc + '</div></div>';
  }

  function _vpConfirm(id, solved) {
    var sheet = document.getElementById('vp-sheet');
    var html = _vpHeader(solved ? 'best match' : 'your pick');
    html += '<div style="padding:18px">';
    html += '<div style="display:flex;align-items:center;gap:7px;color:var(--accent2);font-size:0.85rem;font-weight:600;margin-bottom:10px">Best match — use it?</div>';
    html += _vpCardHtml(id);
    html += '<button type="button" class="vpbtn vpacc" style="text-align:center;font-weight:600" onclick="_vpUse(\'' + _vpEsc(id) + '\')">Use Variation ' + _vpEsc(id) + '</button>';
    html += '<button type="button" class="vpbtn" style="text-align:center" onclick="_vpFinalistsAll()">Not this — show all</button>';
    html += _vpGiFooter();
    html += '</div>';
    sheet.innerHTML = html;
  }

  function _vpFinalists() {
    var sheet = document.getElementById('vp-sheet');
    var html = _vpHeader('narrowed to ' + VP.cands.length);
    html += '<div style="padding:18px">';
    html += '<div style="font-size:0.95rem;font-weight:600;color:var(--text);margin-bottom:2px">Narrowed to ' + VP.cands.length + ' — very close</div>';
    html += '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:10px">Compare with the COTT photos to make the final call.</div>';
    VP.cands.forEach(function (id) {
      html += _vpCardHtml(id);
      html += '<button type="button" class="vpbtn" style="margin-top:-2px;text-align:center" onclick="_vpUse(\'' + _vpEsc(id) + '\')">Use Variation ' + _vpEsc(id) + '</button>';
    });
    html += '<button type="button" onclick="closeVariationPicker()" style="display:block;margin:14px auto 4px;background:none;border:none;color:var(--text-dim);font-size:0.8rem;cursor:pointer">Close — I’ll pick from the list</button>';
    html += _vpGiFooter();
    html += '</div>';
    sheet.innerHTML = html;
  }
  window._vpFinalistsAll = function () { _vpFinalists(); };

  window._vpUse = function (id) {
    closeVariationPicker();
    if (typeof window.wizardChooseVariation === 'function') window.wizardChooseVariation(id);
  };

})();
