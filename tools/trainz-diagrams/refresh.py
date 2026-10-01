#!/usr/bin/env python3
"""
refresh.py — rebuild app/trainz-diagrams-config.js from Trainz's own feed,
and CHECK every diagram page is really there.

v0.9.1855 (2026-10-01). Brad: the Trainz diagram button for 2338 opened
"Diagram not found" — Trainz had renamed the page since the list was copied
on 2026-09-02 (76 of 648 pages had moved). The list is LINKS ONLY; this is
how it stays true.

    python3 tools/trainz-diagrams/refresh.py            pull the feed, write the harvest + the config
    python3 tools/trainz-diagrams/refresh.py --check    ALSO open every diagram page; a page that says
                                                        "Diagram not found" is marked dead in the harvest
                                                        and LEFT OUT of the config (2026-10-01: Trainz's
                                                        own feed listed one such page, 6-19742)
    python3 tools/trainz-diagrams/refresh.py --check-only   just the check, on the newest harvest

Run it on demand — after a "diagram not found" report, or before a release
that touches the Workbench. Trainz asks for about one request a second;
the check takes ~13 minutes for ~700 pages. Exit 1 only when a page could
not be fetched at all (network), never for a dead page — those are dropped.

What it writes:
  harvests/trainz-diagrams-<date>.json   the feed as pulled (id, title, handle, upload date),
                                         plus checked:<date> and dead:true where the check found
                                         "Diagram not found"
  app/trainz-diagrams-config.js          {n, t, h} per LIVE diagram — n = the item numbers read
                                         off the title, t = the title (60 chars), h = the page handle
  tests/trainz_diagrams_tests.js holds the config to the harvest (live rows, same order).

The number rule (tests/trainz_diagrams_tests.js proves it on the harvest):
  split the title on spaces, commas and slashes; drop wheel arrangements
  (2-6-4) and version numbers (2.0); strip punctuation; keep a token that
  starts with a digit and holds two or more digits (2343, 6-18860 → 618860,
  6918009T01, 392T), or starts with letters and then two or more digits
  (GP20, O27, WS-85 → WS85, SD40-2 → SD402). F-3, NW-2, GG-1, K-4 (one
  digit) are model names, not catalog numbers, and are left out. On a
  TRANSFORMER diagram a two-letter token is the number (ZW, KW, LW, VW, RW).
"""
import json, os, re, sys, time, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CONFIG = os.path.join(ROOT, 'app', 'trainz-diagrams-config.js')
FEED = 'https://newwishes.trainz.com/api/parts-diagrams/summary?pageNumber={page}&pageSize=100'
PAGE = 'https://www.trainz.com/pages/parts-diagram/{handle}'
PAUSE = 1.1   # seconds between requests — Trainz's own pace
UA = {'User-Agent': 'Mozilla/5.0 (The Rail Roster diagram-link check; links only)'}


def numbers_of(title):
    out = []
    for tok in re.split(r'[\s,/]+', title or ''):
        t = tok.strip('.,;:()')
        if not t or re.search(r'\d\.\d', t):
            continue
        if re.fullmatch(r'\d{1,2}-\d{1,2}-\d{1,2}(-\d{1,2})?', t):
            continue
        a = re.sub(r'[^A-Za-z0-9]', '', t).upper()
        digits = len(re.findall(r'\d', a))
        # Lionel's transformers are lettered (ZW, KW, LW, VW, RW…): on a
        # transformer diagram a two-letter token IS the catalog number.
        xf = 'transformer' in (title or '').lower() and re.fullmatch(r'[A-Z]{2}', a) is not None
        if (re.fullmatch(r'\d[A-Z0-9]*', a) and digits >= 2) or re.fullmatch(r'[A-Z]+\d{2,}[A-Z0-9]*', a) or xf:
            if a not in out:
                out.append(a)
    return out


def pull_feed():
    out = []
    page = 1
    while True:
        with urllib.request.urlopen(urllib.request.Request(FEED.format(page=page), headers=UA), timeout=30) as r:
            res = json.load(r)['result']
        out += res['partDiagrams']
        print('  feed page %d: %d so far' % (page, len(out)))
        if not res['pagingData'].get('hasNext'):
            break
        page += 1
        time.sleep(PAUSE)
    seen = set()
    rows = []
    for d in out:
        h = d.get('handle') or ''
        if not h or h in seen:
            continue
        seen.add(h)
        rows.append({'diagramId': d.get('diagramId'), 'diagramTitle': (d.get('diagramTitle') or '').strip(),
                     'pageTitle': d.get('pageTitle'), 'handle': h, 'diagramFileUploadDate': d.get('diagramFileUploadDate')})
    return rows


def js_str(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")


def write_config(rows, when):
    lines = []
    lines.append('// ============================================================')
    lines.append('//  trainz-diagrams-config.js — Trainz exploded-diagram index')
    lines.append('//  (v0.9.1646, Session 91; rebuilt by tools/trainz-diagrams/refresh.py).')
    lines.append('//  Pulled %s from Trainz\'s own parts-diagrams feed' % when)
    lines.append('//  (newwishes.trainz.com/api/parts-diagrams/summary, the same feed their')
    lines.append('//  /pages/parts-diagrams page uses): %d diagrams (%d the check found dead, left out),' % (len(rows), sum(1 for d in rows if d.get('dead'))))
    lines.append('//  numbers read off the')
    lines.append('//  titles (wheel arrangements like 2-6-4 and model names like F-3 excluded).')
    lines.append('//  LINKS ONLY — the diagrams stay on trainz.com where users can buy')
    lines.append('//  the parts; that is the point of their library and of this file.')
    lines.append('//  Refresh: python3 tools/trainz-diagrams/refresh.py --check   (never edit by hand —')
    lines.append('//  the harvest file in harvests/ is the record, and the test holds the two together).')
    lines.append('// ============================================================')
    lines.append('window.TRAINZ_DIAGRAMS = [')
    for d in rows:
        if d.get('dead'):
            continue
        t = d['diagramTitle'][:60]
        lines.append("    {n:'%s',t:'%s',h:'%s'}," % ('|'.join(numbers_of(d['diagramTitle'])), js_str(t), js_str(d['handle'])))
    lines.append('];')
    lines.append('window.TRAINZ_DIAGRAMS_PULLED = \'%s\';' % when)
    with open(CONFIG, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def newest_harvest():
    hd = os.path.join(ROOT, 'harvests')
    names = sorted(n for n in os.listdir(hd) if re.match(r'trainz-diagrams-\d{4}-\d{2}-\d{2}\.json$', n))
    return os.path.join(hd, names[-1]) if names else None


def check(rows, when):
    """Open every page. A page that answers but says "Diagram not found" (or
    carries no diagram at all) is marked dead:true on its row; a page that
    could not be fetched is an ERROR (nothing is decided about it)."""
    dead, errors = [], []
    print('checking %d diagram pages (~%d min)…' % (len(rows), int(len(rows) * PAUSE / 60) + 1))
    for i, d in enumerate(rows):
        url = PAGE.format(handle=d['handle'])
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                body = r.read(400000).decode('utf-8', 'replace')
                status = r.status
        except Exception as e:  # noqa
            body, status = '', getattr(e, 'code', 0)
        d['checked'] = when
        if status == 200 and not re.search(r'Diagram not found', body, re.I) and re.search(r'parts-diagram|PartsDiagrams', body, re.I):
            d.pop('dead', None)
        elif status == 404 or (status == 200 and body):
            d['dead'] = True
            dead.append(d['handle'])
            print('  DEAD %s (%s)' % (d['handle'], status))
        else:
            errors.append((d['handle'], status))
            print('  ERROR %s (%s) — not decided' % (d['handle'], status))
        if (i + 1) % 50 == 0:
            print('  %d / %d checked, %d dead, %d errors' % (i + 1, len(rows), len(dead), len(errors)))
        time.sleep(PAUSE)
    return dead, errors


def main():
    args = sys.argv[1:]
    when = datetime.date.today().isoformat()
    if '--check-only' in args:
        hv = newest_harvest()
        if not hv:
            sys.exit('no harvest to check — run without --check-only first')
        rows = json.load(open(hv, encoding='utf-8'))
        when_pulled = re.search(r'(\d{4}-\d{2}-\d{2})', os.path.basename(hv)).group(1)
    else:
        print('pulling the Trainz feed…')
        rows = pull_feed()
        hv = os.path.join(ROOT, 'harvests', 'trainz-diagrams-%s.json' % when)
        when_pulled = when
    errors = []
    if '--check' in args or '--check-only' in args:
        dead, errors = check(rows, when)
        print('\n%d dead page(s) left out of the config:' % len(dead) if dead else '\nevery page answers with a diagram.')
        for h in dead:
            print('  ' + h)
    with open(hv, 'w', encoding='utf-8') as f:
        json.dump(rows, f, indent=0)
    write_config(rows, when_pulled)
    live = sum(1 for d in rows if not d.get('dead'))
    print('wrote %s (%d diagrams, %d live) and %s' % (os.path.relpath(hv, ROOT), len(rows), live, os.path.relpath(CONFIG, ROOT)))
    if errors:
        print('\n%d page(s) could NOT be fetched — run the check again before shipping:' % len(errors))
        for h, st in errors:
            print('  %s (%s)' % (h, st))
        sys.exit(1)


if __name__ == '__main__':
    main()
