// ══════════════════════════════════════════════════════════════
//  help-guides.js — step-by-step written guides (v0.9.14xx)
//
//  Brad: "we need to do the step by step instructions, like we did
//  for the photo inbox, for adding an item, adding something to the
//  want list, adding a part to the want list, buying a part and
//  installing that part on another item, adding to the sale list,
//  report a sale, add to the contact list, how to research an item,
//  how to find things you may want by searching the master catalog."
//
//  SELF-CONTAINED FEATURE (same rule as dispatch-board.js): this file
//  is the ENTIRE feature. Delete the one script line in index.html and
//  the guides disappear with no other edits.
//
//  TWO DESIGN DECISIONS, both Brad's:
//  1. BRANCHING. "Can we have the user select which one they are
//     doing, so it pulls up the correct set of instructions." A guide
//     with `paths` opens on a chooser and then shows ONLY that path.
//     Nobody reads about mock-ups while entering a boxcar.
//  2. NO ICONS. Plain text headings throughout.
//
//  Content is DATA (RRG) and the shell is ONE renderer — a tenth
//  guide is a data entry, not another copy of the modal code.
//
//  v0.9.1987 (Brad: "get rid of the step by step guides. leave the other 2
//  under suggestions"): only the CONDITION GRADING guide is left — the Add
//  wizard's condition help (wizard.js _wizCondHelp) and the Help Center's
//  Suggestions row both open it. The other ten, the index and the
//  branching paths are gone; narrated videos cover those jobs now.
// ══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // A real-looking button, so the guide shows what to LOOK for.
  function chip(text, kind) {
    var c = {
      primary: 'background:var(--accent,#e8401c);color:#fff;border:1px solid var(--accent,#e8401c)',
      gold:    'background:rgba(212,168,67,0.16);color:var(--gold,#d4a843);border:1px solid rgba(212,168,67,0.55)',
      green:   'background:rgba(46,204,113,0.14);color:var(--t-green);border:1px solid rgba(46,204,113,0.5)',
      blue:    'background:rgba(41,128,185,0.14);color:var(--t-link);border:1px solid rgba(41,128,185,0.5)',
      ghost:   'background:var(--surface2,#242440);color:var(--text,#eee);border:1px solid var(--border,#444)'
    }[kind || 'ghost'];
    return '<span style="display:inline-block;' + c + ';border-radius:7px;padding:0.1rem 0.5rem;'
      + 'font-size:0.95em;font-weight:700;white-space:nowrap;line-height:1.5">' + esc(text) + '</span>';
  }
  function callout(label, body, colour) {
    var col = colour || '#d4a843';
    return '<div style="border-left:3px solid ' + col + ';background:rgba(255,255,255,0.03);'
      + 'border-radius:0 9px 9px 0;padding:0.7rem 0.9rem;margin:0.9rem 0">'
      + '<div style="font-size:0.95rem;font-weight:700;color:' + col + ';margin-bottom:0.2rem">' + esc(label) + '</div>'
      + '<div style="font-size:1.08rem;color:var(--text-mid,#ccc);line-height:1.6">' + body + '</div></div>';
  }

  // ── The guides. Content only. ────────────────────────────────
  // { title, blurb, intro, steps[], notes[] }              — linear
  // { title, blurb, intro, choose, paths[] }               — branching
  // step = { do, why }   note = [label, body]
  var RRG = {

    grading: {
      title: 'Condition grading — the C-scale collectors use',
      blurb: 'What C-7 means, and how it lines up with our 1–10.',
      intro: 'Nearly every ad, price guide and show table in this hobby grades condition on the Train Collectors Association scale, written C-1 to C-10. It is worth knowing even if you never use the letters yourself, because the price you see quoted always assumes a grade. Descriptions below are our summary of the TCA standard, not their wording.',
      steps: [
        { do: '<b>C-10 Mint</b> — brand new, all original, never used, not a mark on it.',
          why: 'For most postwar items this also means the original box. A genuinely mint 1950s item is rare, and priced accordingly.' },
        { do: '<b>C-9 Factory New</b> — unused and all original, but may carry factory rubs or the faintest signs of having been handled or test-run.',
          why: 'The difference between C-9 and C-10 is often the box and the paperwork rather than the item.' },
        { do: '<b>C-8 Like New</b> — complete and original, no rust, nothing missing; may show its age or time on display, and may have been run.',
          why: 'This is the top grade most collectors ever apply to a train that has actually been used.' },
        { do: '<b>C-7 Excellent</b> — all original, with only minute scratches and paint nicks; no rust, nothing missing, nothing bent.',
          why: 'C-7 is the workhorse grade in listings. If an ad just says "excellent", this is what is meant.' },
        { do: '<b>C-6 Very Good</b> — minor scratches and nicks, small spots of surface rust, no dents; may have a minor part replaced.',
          why: 'The point where replaced parts start being acceptable without calling it restored.' },
        { do: '<b>C-5 Good</b> — clear play wear: scratches, some paint loss, small dents, minor surface rust.',
          why: 'Good means used, not bad. A great many well-loved postwar trains live here.' },
        { do: '<b>C-4 Fair</b> — scratched, moderate paint loss, dents, missing parts, surface rust.',
          why: 'Still displayable and often still runs, but the value is a fraction of the same item at C-7.' },
        { do: '<b>C-3 Poor</b> — heavily scratched, significant rust, parts missing. A restoration candidate.',
          why: 'Worth buying when the item is scarce enough to justify the work.' },
        { do: '<b>C-2 Restoration required</b> and <b>C-1 Junk</b> — the second is parts value only.',
          why: 'A C-1 is not worthless: somebody else\u2019s C-3 needs exactly the part you are holding.' }
      ],
      notes: [
        ['How this lines up with our 1\u201310',
         'Our slider agrees with TCA at the top and bottom \u2014 10 is Mint, 6 is Very Good \u2014 but through the middle our wording runs about one notch kinder: what we label 8 \u201CExcellent\u201D is closer to TCA\u2019s C-8 Like New, and TCA\u2019s C-7 Excellent sits nearer our 7. If you grade to TCA, set the number to match the TCA grade and ignore our label.'],
        ['Importing a spreadsheet graded in words',
         'Words like Excellent, Like New, Very Good and Fair are read automatically and turned into a number, and you are shown every one of those decisions on a conversion table before anything is written. Change any of them there \u2014 once \u2014 and every item using that word follows.'],
        ['The box is graded separately',
         'You will see grades written like <b>C-8/P-6</b>: the item is C-8, the box (packaging) is P-6. The app keeps item condition and box condition as two separate fields for the same reason.'],
        ['Where this comes from',
         'The Train Collectors Association has published this standard for decades; it is the common language at York and in every price guide. The wording above is ours, summarising theirs.']
      ]
    }

  };

  // ── Renderer ─────────────────────────────────────────────────
  function stepsHtml(steps, notes) {
    var h = '';
    (steps || []).forEach(function (s, i) {
      h += '<div style="display:flex;gap:0.75rem;margin-bottom:1.05rem">'
        + '<div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--accent,#e8401c);'
        + 'color:#fff;font-weight:700;font-size:1.02rem;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:1.14rem;color:var(--text,#eee);line-height:1.6;margin-bottom:0.2rem">' + s.do + '</div>'
        + '<div style="font-size:1.02rem;color:var(--text-dim,#999);line-height:1.55;font-style:italic">' + s.why + '</div>'
        + '</div></div>';
    });
    (notes || []).forEach(function (n) { h += callout(n[0], n[1]); });
    return h;
  }

  // ── v0.9.1457 (Brad): "this page needs to be on the left side of the
  // screen, and be able to drag it." A guide you cannot keep open while you
  // work is only half useful — so this is a FLOATING PANEL, not a modal:
  // no dark backdrop, the app stays clickable behind it, it starts on the
  // left, drags by its header, and remembers where it was put (rr_guides_box).
  // Same shape as the photographing guide, which earned this pattern.
  var BOX_KEY = 'rr_guides_box';
  function savedBox() {
    try { return JSON.parse(localStorage.getItem(BOX_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveBox(l, t) {
    try { localStorage.setItem(BOX_KEY, JSON.stringify({ l: Math.round(l), t: Math.round(t) })); } catch (e) {}
  }

  function shell(titleHtml, bodyHtml, backLabel, backFn) {
    var old = document.getElementById('rrg-modal');
    if (old) old.remove();
    var narrow = (window.innerWidth || 0) < 780;
    var box = savedBox();
    // Default: left side, clear of the sidebar. A saved position wins, but is
    // clamped back on screen in case the window shrank since last time.
    var L = 236, T = 88;
    if (box) {
      L = Math.min(Math.max(0, box.l), Math.max(0, (window.innerWidth || 900) - 260));
      T = Math.min(Math.max(0, box.t), Math.max(0, (window.innerHeight || 700) - 120));
    }
    var p = document.createElement('div');
    p.id = 'rrg-modal';
    p.style.cssText = narrow
      ? 'position:fixed;left:0;right:0;bottom:0;max-height:72vh;max-height:72dvh;overflow-y:auto;z-index:100010;'
        + 'background:var(--surface,#1a1a2e);border-top:2px solid var(--gold,#d4a843);'
        + 'box-shadow:0 -6px 26px rgba(0,0,0,0.5);color:var(--text,#eee);font-family:var(--font-body,sans-serif)'
      : 'position:fixed;left:' + L + 'px;top:' + T + 'px;width:470px;max-height:82vh;max-height:82dvh;overflow-y:auto;'
        + 'z-index:100010;background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);'
        + 'border-radius:14px;box-shadow:0 14px 44px rgba(0,0,0,0.55);color:var(--text,#eee);'
        + 'font-family:var(--font-body,sans-serif)';
    p.innerHTML =
      // Drag handle — the whole header bar, so there is a big target.
      '<div id="rrg-grip" style="' + (narrow ? '' : 'cursor:move;') + 'position:sticky;top:0;z-index:2;'
      + 'background:var(--surface,#1a1a2e);border-bottom:1px solid var(--border,#333);'
      + 'border-radius:14px 14px 0 0;padding:0.85rem 1.1rem 0.7rem;display:flex;align-items:flex-start;gap:0.6rem">'
      +   '<div style="flex:1;min-width:0">' + titleHtml + '</div>'
      +   (narrow ? '' : '<span title="Drag to move" style="flex-shrink:0;color:var(--text-dim,#888);'
            + 'font-size:1.1rem;line-height:1;padding-top:0.15rem">⠿</span>')
      +   '<button id="rrg-x" title="Close" style="flex-shrink:0;background:none;border:none;'
      + 'color:var(--text-dim,#888);font-size:1.4rem;cursor:pointer;line-height:1;padding:0">✕</button>'
      + '</div>'
      + '<div style="padding:1.1rem 1.2rem 1.3rem">' + bodyHtml
      +   '<div style="margin-top:1.3rem;padding-top:0.9rem;border-top:1px solid var(--border,#333);'
      + 'display:flex;gap:0.6rem;flex-wrap:wrap;justify-content:flex-end">'
      +   (backLabel ? '<button id="rrg-back" style="padding:0.6rem 1.1rem;border-radius:9px;'
          + 'border:1px solid var(--border,#444);background:var(--surface2,#242440);color:var(--text,#eee);'
          + 'font-family:inherit;font-size:1rem;font-weight:600;cursor:pointer">' + esc(backLabel) + '</button>' : '')
      +   '<button id="rrg-done" style="padding:0.6rem 1.4rem;border-radius:9px;border:none;'
      + 'background:var(--accent,#e8401c);color:#fff;font-family:inherit;font-size:1rem;font-weight:700;'
      + 'cursor:pointer">Got it</button>'
      +   '</div></div>';
    document.body.appendChild(p);

    var close = function () { p.remove(); };
    document.getElementById('rrg-x').onclick = close;
    document.getElementById('rrg-done').onclick = close;
    var b = document.getElementById('rrg-back');
    if (b) b.onclick = function () { close(); if (backFn) backFn(); };

    // Drag — pointer events so it works with a mouse, a finger or a pen.
    if (!narrow) {
      var grip = document.getElementById('rrg-grip');
      var dx = 0, dy = 0, dragging = false;
      grip.addEventListener('pointerdown', function (e) {
        // Let the close button behave like a button.
        if (e.target && e.target.id === 'rrg-x') return;
        dragging = true;
        var r = p.getBoundingClientRect();
        dx = e.clientX - r.left; dy = e.clientY - r.top;
        try { grip.setPointerCapture(e.pointerId); } catch (eC) {}
        e.preventDefault();
      });
      grip.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var nl = Math.min(Math.max(0, e.clientX - dx), (window.innerWidth || 900) - 80);
        var nt = Math.min(Math.max(0, e.clientY - dy), (window.innerHeight || 700) - 60);
        p.style.left = nl + 'px'; p.style.top = nt + 'px';
      });
      var end = function (e) {
        if (!dragging) return;
        dragging = false;
        try { grip.releasePointerCapture(e.pointerId); } catch (eR) {}
        saveBox(parseFloat(p.style.left) || 0, parseFloat(p.style.top) || 0);
      };
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    }
    if (window.BackStack && BackStack.wire) BackStack.wire(p);
  }

  function head(title, blurb) {
    return '<div style="font-family:var(--font-head,sans-serif);font-size:1.6rem;font-weight:700;'
      + 'margin-bottom:0.15rem;padding-right:2rem">' + esc(title) + '</div>'
      + (blurb ? '<div style="font-size:1.05rem;color:var(--gold,#d4a843);margin-bottom:1.1rem">' + esc(blurb) + '</div>' : '');
  }

  // Open a guide. v0.9.1987: grading is the only one left and it is linear,
  // so the branching chooser (rrgPath) and the '‹ All guides' index went with
  // the guides that used them.
  function rrgOpen(id) {
    var g = RRG[id];
    if (!g) return;
    var body = '<div style="font-size:1.12rem;color:var(--text-mid,#ccc);line-height:1.65;margin-bottom:1rem">'
      + g.intro + '</div>' + stepsHtml(g.steps, g.notes);
    shell(head(g.title, g.blurb), body, null, null);
  }

  window.rrgOpen = rrgOpen;

  // v0.9.1987: this file no longer reaches into the Help Center. The grading
  // row is drawn by openHelpHub itself (tutorial.js) — the old wrapper polled
  // every second for a minute after load to slip two rows in next to
  // 'Photographing', and the 'Step-by-step guides' row it added is gone.
})();
