// ═══════════════════════════════════════════════════════════════
//  help-photo-id.js — "How best to use these features"
//  v0.9.1181 (Brad)
//
//  The panel that opens from the wide button under the 2x2 grid on the photo
//  inbox review card. Brad asked for it to say what each button does, what each
//  one costs, and the order to try them in.
//
//  THE COPY LIVES HERE, on purpose. It is several screens of prose and it would
//  have been the largest single block of text in photo-inbox.js, a file that is
//  already 7,000 lines. Keeping it separate means the wording can be edited
//  without opening the file that does the actual reading, and a mistake in the
//  wording cannot break the inbox.
//
//  RULES THIS FILE FOLLOWS
//  - No hardcoded colours, ever. This file is not in the colour budget and must
//    stay out of it: every colour here is a var() from the palette.
//  - No accuracy percentages. Brad's own estimate was "about 90%" for both the
//    Google route and the paid read, and he agreed to leave the number out:
//    "your right, we don't guarentee it". A printed figure is a promise, and one
//    bad afternoon turns it into a broken one.
//  - Never the phrase "AI" in anything a user reads. House rule.
//  - The example photos are Brad's OWN. Two earlier candidates were dropped
//    because they came off dealer listings — owning the item is not the same as
//    owning the photograph, and this ships inside the app to every user.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Photos are versioned with the app so a swapped example is never served from
  // a stale cache. They are small on purpose (19-66 KB) — this panel opens on a
  // phone, often on club wifi.
  function _v() {
    try {
      var m = String(window.APP_VERSION || '').match(/(\d+)$/);
      return m ? ('?v=' + m[1]) : '';
    } catch (e) { return ''; }
  }
  function _img(name, cap) {
    return '<figure style="margin:0 0 0.7rem;background:var(--surface2);'
      + 'border:1px solid var(--border);border-radius:10px;padding:0.5rem;overflow:hidden">'
      + '<img src="help-img/' + name + '.jpg' + _v() + '" alt="" loading="lazy" '
      + 'style="width:100%;display:block;border-radius:6px">'
      + '<figcaption style="font-size:0.74rem;color:var(--text-mid);margin-top:0.4rem;'
      + 'line-height:1.45">' + cap + '</figcaption></figure>';
  }

  var _H2 = 'font-family:var(--font-head);font-size:0.98rem;font-weight:700;'
    + 'margin:1.4rem 0 0.5rem;color:var(--accent2)';
  var _P  = 'font-size:0.87rem;margin:0 0 0.7rem;line-height:1.55';
  var _UL = 'margin:0 0 0.8rem;padding-left:1.1rem;font-size:0.87rem;line-height:1.55';
  var _HR = '<div style="border-top:1px solid var(--border);margin:1.3rem 0"></div>';

  // One step of the numbered list. free=true paints the cost line in the
  // "costs nothing" colour, which is the fact most people are here to find out.
  function _step(n, title, cost, free, body) {
    return '<div style="border-left:3px solid var(--border);padding:0.1rem 0 0.1rem 0.75rem;'
      + 'margin-bottom:0.9rem">'
      + '<div style="font-weight:800;font-size:0.9rem">' + n + '. ' + title + '</div>'
      + '<div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;'
      + 'letter-spacing:0.04em;color:' + (free ? 'var(--green)' : 'var(--accent2)') + '">'
      + cost + '</div>' + body + '</div>';
  }
  function _sp(t) {
    return '<p style="margin:0.2rem 0 0;font-size:0.85rem;color:var(--text-mid);'
      + 'line-height:1.5">' + t + '</p>';
  }
  function _row(what, cost, spend) {
    return '<tr><td style="padding:0.4rem 0.2rem;border-bottom:1px solid var(--border)">'
      + what + '</td><td style="padding:0.4rem 0.2rem;border-bottom:1px solid var(--border);'
      + 'text-align:right;font-weight:700;white-space:nowrap;color:'
      + (spend ? 'var(--accent2)' : 'var(--green)') + '">' + cost + '</td></tr>';
  }

  window.rrPhotoIdHelpHtml = function () {
    return ''
    + '<p style="' + _P + '"><b>We already tried, and it was free.</b></p>'
    + '<p style="' + _P + '">The moment this photo landed in your inbox, we looked for a '
      + 'printed number on it. That alone gets most items.</p>'

    + '<div style="' + _H2 + '">What we can usually read</div>'
    + '<ul style="' + _UL + '">'
      + '<li style="margin-bottom:0.35rem">A catalog number printed or stamped on the item '
        + 'itself — most prewar and postwar pieces carry one right on the side, and that is the '
        + 'easiest thing for us to read</li>'
      + '<li style="margin-bottom:0.35rem">The number or barcode on the box</li>'
      + '<li style="margin-bottom:0.35rem">A builder’s plate, if it’s in focus</li>'
    + '</ul>'
    + _img('item', 'This Alco wears <b>205</b> on the cab — and on a postwar piece that number '
        + '<i>is</i> the Lionel catalog number. Prewar is much the same. We read it straight off.')
    + _img('box', 'The box end carries the barcode <i>and</i> the catalog number, <b>6-36814</b>. '
        + 'Either one is enough.')

    + '<div style="' + _H2 + '">When there’s nothing for us to read</div>'
    + '<ul style="' + _UL + '">'
      + '<li style="margin-bottom:0.35rem">The item has no number on it anywhere. Accessories are '
        + 'often like this — the number was on the box and nowhere else.</li>'
      + '<li style="margin-bottom:0.35rem">The number on the item is a <i>road</i> number, not a '
        + 'catalog number. On postwar pieces the two are usually the same, so we get it. On modern '
        + 'pieces they often aren’t.</li>'
      + '<li style="margin-bottom:0.35rem">The number is on the side facing away from the camera, '
        + 'or it’s too small, blurry or worn to make out.</li>'
      + '<li style="margin-bottom:0.35rem">It’s still sealed, or it’s a repaint, a custom, or an '
        + 'unmarked reproduction.</li>'
    + '</ul>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));'
      + 'gap:0.55rem;align-items:start">'
      + _img('mkt', '<b>43</b> on the cab is the road number. It <i>looks</i> like a catalog '
          + 'number, which is exactly why this one fools a text reader.')
      + _img('chessie', '<b>GM50</b> is a commemorative road number. Nothing here points at a '
          + 'Lionel item.')
      + _img('unmarked', 'No number, no road name, nothing. There is literally nothing printed '
          + 'to read.')
      + _img('strongman', 'Covered in words <i>and</i> numbers — 500, 600, 800, 900 — and not one '
          + 'of them is this item’s number.')
    + '</div>'

    + '<div style="background:var(--surface2);border:1.5px solid var(--accent);border-radius:10px;'
      + 'padding:0.7rem 0.85rem;font-size:0.86rem;margin:0.9rem 0;line-height:1.55">'
      + '<b>If your photo looks like one of those, don’t bother with the free reader or re-scan.</b> '
      + 'Go straight to Google Search or Read this photo. Those two look at the shape, the colours '
      + 'and the whole item, not just printed text — so they’re the ones that can work with no '
      + 'number at all.</div>'

    + '<p style="' + _P + '"><b>And we get it wrong sometimes.</b> The reader is as good as we can '
      + 'make it, but a wrong answer is not unusual. That’s normal — it’s why these buttons are '
      + 'here, and why nothing gets saved until you say so.</p>'
    + _HR

    + '<div style="' + _H2 + '">Crop your photo — it pays off twice</div>'
    + '<p style="' + _P + '">Tap the ✂ on any photo and pull the edges in until it’s mostly the '
      + 'item. It takes about five seconds and it helps in two different ways.</p>'
    + '<p style="' + _P + '"><b>It reads better.</b> A wide shot hands the reader your shelf, your '
      + 'workbench, the wall behind it and whatever else is on the table — and every bit of that is '
      + 'more lettering to sift through and more chances to grab the wrong number. Crop in and the '
      + 'only thing left to read is the item.</p>'
    + '<p style="' + _P + '"><b>And it looks better.</b> This is the picture that shows up in your '
      + 'collection, on your For Sale list, and on anything you hand to a friend or a buyer. A tight '
      + 'shot looks like a catalog photo. A wide one looks like a snapshot of your basement.</p>'
    + '<p style="' + _P + '">Worth doing before you reach for a token, too — a bad crop is the '
      + 'cheapest thing to fix, and it sometimes fixes the answer on its own.</p>'
    + _HR

    + '<div style="' + _H2 + '">If the answer is wrong, work down this list</div>'
    + _step(1, 'This is wrong — re-scan', 'Free', true,
        _sp('Throws away the answer and looks again, harder. You can watch what it sees while it '
          + 'works — often that alone tells you why it went wrong.'))
    + _step(2, 'Research Number', 'Free', true,
        _sp('If you already know the number, or you can read it yourself in the photo, type it in '
          + 'and this looks it up in the catalog. Fastest route when you can read the number and '
          + 'the app can’t.'))
    + _step(3, 'Google Search', 'Free', true,
        _sp('Sends this photo to Google and lets Google find it. This is the one to reach for when '
          + 'there’s nothing printed to read. It usually gets there.')
        + _sp('The catch is that you have to carry the answer back yourself:')
        + '<div style="margin:0.5rem 0 0;padding:0.55rem 0.7rem;background:var(--surface2);'
          + 'border-radius:8px;font-size:0.82rem;color:var(--text);line-height:1.5">'
          + 'In the Google tab: <b>Ctrl+A</b> (select all), then <b>Ctrl+C</b> (copy). Come back '
          + 'here and press <b>Ctrl+V</b> in the paste box.</div>'
        + _sp('Four keystrokes. If you don’t mind them, this costs you nothing.'))
    + _step(4, 'Read this photo', '1 token', false,
        _sp('A different reader looks at the whole photo — the shape, the colours, the lettering — '
          + 'not just printed text. About as good as the Google route, and it does the '
          + 'carrying-back for you. Use it when you’d rather not do the copy-paste, or when Google '
          + 'didn’t get there either.'))
    + _HR

    + '<div style="' + _H2 + '">About tokens</div>'
    // "Nothing to buy." was here and was cut on 2026-07-30: purchased tokens are
    // planned (see BUY_MORE_TOKENS_TODO), and that is exactly the sentence a
    // beta user would quote back the day they ship. The rest is true either way.
    + '<p style="' + _P + '">You get a set number of photo reads every day, included with the app. '
      + 'The count sits right under the buttons, and it starts over each night.</p>'
    + '<p style="' + _P + '">Only <b>Read this photo</b> uses one. The first free read, re-scanning, '
      + 'Research Number and Google Search never do — you could use those all day.</p>'
    + '<p style="' + _P + '">If you’d rather never spend one, you can switch photo reads off '
      + 'entirely in <b>Preferences › Photo ID</b>.</p>'

    + '<div style="' + _H2 + '">The short version</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:0.84rem;margin-top:0.4rem">'
      + _row('The first read, when the photo arrives', 'Free', false)
      + _row('This is wrong — re-scan', 'Free', false)
      + _row('Research Number', 'Free', false)
      + _row('Google Search', 'Free', false)
      + _row('Read this photo', '1 token', true)
    + '</table>';
  };
})();
