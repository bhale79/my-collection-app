#!/usr/bin/env python3
"""tools/icons/make_icons.py — every app icon, from ONE master. Written v0.9.1837.

    python3 tools/icons/make_icons.py          (from the repo root; needs Pillow)

The master is tools/icons/badge-master.png — the round Rail Roster badge
(conductor with the lantern, "THE RAIL ROSTER" / "THE ONLY WAY TO COLLECT."),
1260 x 1260 with transparent corners, exactly as Brad supplied it. Every file
below is cut from it here, so a new badge means: replace the master, run this,
ship. Nobody hand-edits an icon.

What a phone does to an icon, and why there are six files:

  icon-192.png / icon-512.png       manifest purpose "any". Shown whole: Android's
                                    splash screen, app info, the landing page's
                                    tab. The badge on a solid square of the app's
                                    dark, nearly filling it.
  icon-192-maskable.png / -512-     manifest purpose "maskable". Android cuts the
                                    home-screen icon into the phone's own shape
                                    (circle, squircle, rounded square) and only
                                    promises to keep the inner 80%. The badge is
                                    therefore drawn at 80% of the square, so no
                                    mask ever shaves its ring. A merged
                                    "any maskable" entry — what the manifest had
                                    before v1837 — is exactly how the ring got cut.
  apple-touch-icon.png (180)        the iPhone home screen. iOS allows no
                                    transparency (see-through corners turn black)
                                    and rounds the corners itself, so: the badge
                                    on the solid square, nearly filling it, and
                                    the navy corners vanish under iOS's rounding.
  favicon-32.png                    the browser tab. Transparent corners, so the
                                    coin sits on whatever colour the tab is.

The square behind the badge is manifest.json's background_color — READ from the
manifest, never typed here (tests/app_icons_tests.js refuses a colour literal in
this file). That is what makes the Android splash seamless: the splash paints
background_color and drops the "any" icon on it, and the icon's own square is
that same colour, so only the badge shows.

Names: the two "any" files keep their old names (the landing page, the precache
and the manifest point at them); the four new ones are new names. A changed
icon under an OLD name is picked up by the app's precache on the next release,
but a browser's tab-icon cache and an Android launcher key icons by URL and can
hold the old picture for a while — so a future NEW badge is best shipped under
new file names as well as a new master.
"""
import json
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit('needs Pillow:  pip install pillow')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
APP = os.path.join(ROOT, 'app')
MASTER = os.path.join(HERE, 'badge-master.png')

# file, square size, badge diameter as a fraction of the square, opaque square?
ICONS = [
    ('icon-192.png',          192, 0.96, True),
    ('icon-512.png',          512, 0.96, True),
    ('icon-192-maskable.png', 192, 0.80, True),
    ('icon-512-maskable.png', 512, 0.80, True),
    ('apple-touch-icon.png',  180, 0.96, True),
    ('favicon-32.png',         32, 1.00, False),
]


def fill_rgb():
    """The square's colour: manifest.json background_color, the one place it lives."""
    with open(os.path.join(APP, 'manifest.json'), encoding='utf-8') as f:
        hexv = json.load(f)['background_color'].lstrip('#')
    return tuple(int(hexv[i:i + 2], 16) for i in (0, 2, 4))


def badge_only(master):
    """Crop the master to the badge's own edge, so a fraction is of the BADGE, not of
    whatever transparent margin the master happens to carry."""
    box = master.getchannel('A').getbbox()
    badge = master.crop(box)
    w, h = badge.size
    if w != h:  # pad to a square around the centre; a badge is round
        s = max(w, h)
        sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        sq.alpha_composite(badge, ((s - w) // 2, (s - h) // 2))
        badge = sq
    return badge


def render(badge, size, frac, opaque, fill):
    d = int(round(size * frac))
    small = badge.resize((d, d), Image.LANCZOS)
    off = (size - d) // 2
    if opaque:
        canvas = Image.new('RGB', (size, size), fill)
        canvas.paste(small, (off, off), small)        # the badge's alpha is the mask
    else:
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(small, (off, off))
    return canvas


def main():
    master = Image.open(MASTER).convert('RGBA')
    badge = badge_only(master)
    fill = fill_rgb()
    print('master %dx%d, badge %dx%d, square fill rgb%s' % (master.size + badge.size + (fill,)))
    for name, size, frac, opaque in ICONS:
        out = os.path.join(APP, name)
        render(badge, size, frac, opaque, fill).save(out, 'PNG', optimize=True)
        print('  %-24s %4dx%-4d badge %3d%%  %s  %6d bytes'
              % (name, size, size, int(frac * 100), 'opaque' if opaque else 'alpha ', os.path.getsize(out)))


if __name__ == '__main__':
    main()
