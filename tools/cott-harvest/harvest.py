# tools/cott-harvest/harvest.py — steps 2-4 of a COTT deep-link harvest (read-only toward COTT).
#
# Built 2026-10-13 (v0.9.1940, [stated] Brad "yes" to adding the 115 COTT pages that had
# never been put in the deep-link map). Re-run it the same way whenever COTT pages are
# re-harvested; do not hand-edit the generated map.
#
#   python3 tools/cott-harvest/harvest.py <work-dir>
#     reads  <work-dir>/cott_rows.json, <work-dir>/pages_unharvested.json  (pull_rows.js)
#     writes <work-dir>/pages/<slug>.html   one fetch per page, 2 s apart, retried on errors
#            <work-dir>/sections.json       every bookmark id on each page + its text
#            <work-dir>/deep_new.json       entries for app/cott-anchors.js (DEEP_ADDED)
#
# HOW AN ENTRY IS MADE (slug -> number -> {g, a, m, d, h}):
#   * a page "section" starts at every element carrying an item id (theme ids skipped)
#   * a master number finds the sections whose own HEADING names it ("No. 600, 601"),
#     else the sections whose text names it as a catalogue number ("No. 920-2"),
#     else ("616E/W", "71 six 60") the part before the slash/space
#   * numbers COTT never prints (REC-…, BB-…, EP-…) match a section HEADING by the row's
#     own words: 80 % of the row's words in the heading, 60 % of the heading's words in
#     the row, and a clear winner — or nothing
#   * a: [id, words] — words from the heading, only those NOT in every section of that
#     number (a word every section has proves nothing)
#   * m:2, d:2 — the row's words must hit two of a section's words AND beat the next
#     section by two, or the words decide nothing (measured: 1-word picks were wrong)
#   * h — the number's home: the first section whose own heading names the number. Used
#     when the words decide nothing. No such heading → no home → the page top, never a guess
#   * g:0 always — none of these pages is in PREFIX, so today's built link has no anchor
import json, re, sys, os, glob, time, subprocess
from collections import Counter
from bs4 import BeautifulSoup, Tag
W = sys.argv[1] if len(sys.argv) > 1 else None
if not W: print('usage: python3 tools/cott-harvest/harvest.py <work-dir>'); sys.exit(2)
rows = json.load(open(os.path.join(W, 'cott_rows.json')))
plist = json.load(open(os.path.join(W, 'pages_unharvested.json')))
os.makedirs(os.path.join(W, 'pages'), exist_ok=True)

# ── 2. fetch ────────────────────────────────────────────────────────────
bad = []
for slug, n in plist:
    f = os.path.join(W, 'pages', slug + '.html')
    if os.path.exists(f) and os.path.getsize(f) > 5000: continue
    code = ''
    for k in range(4):
        r = subprocess.run(['curl', '-sL', '--compressed', '-m', '60', '-o', f, '-w', '%{http_code}', 'https://cornucopiaoftoytrains.com/' + slug + '/'], capture_output=True, text=True)
        code = r.stdout
        if code == '200' and os.path.getsize(f) > 5000: break
        time.sleep(10 * (k + 1))
    if code != '200': bad.append((slug, code))
    time.sleep(2)
if bad: print('PAGES NOT FETCHED (the map will lack them):', bad)

# ── 3. sections ─────────────────────────────────────────────────────────
SKIP=re.compile(r'^(post-|attachment|wp-|gallery|footer|toTop|google|menu|site|primary|main|content|comments|respond|page|jp-|sharing|like-|mc_|search|tablepress|ez-toc|toc|wrapper|trustedsite)',re.I)
BLOCK={'p','h1','h2','h3','h4','h5','h6','li','figcaption','td','th','dt','dd','pre','blockquote'}
def norm_num(s): return re.sub(r'[^A-Z0-9]','',s.upper())
NUMRE=re.compile(r'(?<![A-Za-z0-9])([A-Z]{0,3}\d{1,5}[A-Z]{0,3})(?:\s*[-–—]\s*(\d{1,4}[A-Z]{0,2}))?(?![A-Za-z0-9])')
out={}
for f in sorted(glob.glob(os.path.join(W,'pages','*.html'))):
    slug=os.path.basename(f)[:-5]
    soup=BeautifulSoup(open(f,encoding='utf-8',errors='replace').read(),'lxml')
    body=soup.select_one('.entry-content') or soup.select_one('article') or soup.body
    secs=[]; cur=None; seen=set()
    for el in body.descendants:
        if not isinstance(el,Tag): continue
        i=el.get('id')
        if i and not SKIP.match(i) and i not in seen:
            seen.add(i); cur={'id':i,'head':el.get_text(' ',strip=True)[:200],'text':''}; secs.append(cur)
        if el.name in BLOCK and not el.find(list(BLOCK)):
            for inner in el.find_all(attrs={'id':True}):
                j=inner.get('id')
                if j and not SKIP.match(j) and j not in seen:
                    seen.add(j); cur={'id':j,'head':el.get_text(' ',strip=True)[:200],'text':''}; secs.append(cur)
                    break
        if el.name in BLOCK and cur is not None and not el.find(list(BLOCK)):
            t=el.get_text(' ',strip=True)
            if t and len(cur['text'])<1500: cur['text']+=' '+t
    for s in secs:
        blob=(s['head']+' '+s['text'][:600])
        nums=set()
        for m in NUMRE.finditer(blob.upper()):
            a,b=m.group(1),m.group(2)
            if not re.search(r'\d',a): continue
            nums.add(norm_num(a))
            if b: nums.add(norm_num(a+b))
        # comma lists "No. 600, 601, 602" are caught by NUMRE individually
        s['nums']=sorted(nums)
        def numset(txt):
            ns=set()
            for m in NUMRE.finditer(txt.upper()):
                a,b=m.group(1),m.group(2)
                if not re.search(r'\d',a): continue
                ns.add(norm_num(a))
                if b: ns.add(norm_num(a+b))
            return ns
        s['numsHead']=sorted(numset(s['head']))
        # in the body, only numbers written as a catalogue number: "No. 123", "No. 123, 124"
        nb=set()
        for m in re.finditer(r'NO\.?\s*((?:[A-Z]{0,3}\d{1,5}[A-Z]{0,3}(?:\s*[-–—]\s*\d{1,4}[A-Z]{0,2})?(?:\s*(?:,|/|AND|&)\s*)?)+)', s['text'][:600].upper()):
            nb|=numset(m.group(1))
        s['numsNo']=sorted(nb)
    out[slug]=secs
json.dump(out,open(os.path.join(W,'sections.json'),'w'))
secs=out

# ── 4. entries ──────────────────────────────────────────────────────────
pages=set(x[0] for x in plist)
STOP=set('THE AND WITH OF IN ON AN FOR TO NO IS ARE WAS WERE AS AT BY OR FROM THIS THAT THESE THOSE IT ITS BE BEEN HAS HAVE HAD ALSO WHICH ONE TWO BUT NOT ALL SOME OTHER THAN THEN THERE THEY THEIR'.split())
def stem_words(s):
    out=[]
    for w in re.sub(r'[^A-Z0-9]+',' ',str(s).upper()).split():
        if len(w)>3 and w.endswith('S'): w=w[:-1]
        out.append(w)
    return out
def norm(s): return re.sub(r'[^A-Z0-9]','',str(s).upper())
def slug_of(u):
    m=re.search(r'toytrains\.com/([^/#?]+)',u,re.I); return m.group(1).lower() if m else ''
by_page={}
for r in rows:
    s=slug_of(r['refLink'])
    if s in pages: by_page.setdefault(s,[]).append(r)
DEEP={}; report=[]
for slug,rs in by_page.items():
    ss=secs.get(slug) or []
    if not ss: continue
    entry={}
    for N in sorted(set(norm(r['itemNum']) for r in rs)):
        K=N
        cands=[s for s in ss if N in s['numsHead']] or [s for s in ss if N in s['numsNo']]
        if not cands:
            # "616E/W" is the 616E;  "71 six 60" is the 71 — the catalogue number is the first part
            raw=[r['itemNum'] for r in rs if norm(r['itemNum'])==N][0]
            first=norm(re.split(r'[/ ]',str(raw).strip())[0])
            if first and first!=N and re.search(r'\d',first):
                cands=[s for s in ss if first in s['numsHead']] or [s for s in ss if first in s['numsNo']]
                if cands: K=first
        kind='number'
        if not cands:
            # synthetic numbers (REC-…, BB-…, EP-…): the row's own words against each section HEADING
            best=None
            for r in [r for r in rs if norm(r['itemNum'])==N]:
                rw=set(w for w in stem_words(r.get('varDesc','')) if w not in STOP)
                if len(rw)<2: continue
                scored=[]
                for s in ss:
                    hw=set(w for w in stem_words(s['head']) if w not in STOP)
                    if not hw: continue
                    ov=len(rw&hw); scored.append((ov/max(len(rw),1), ov/max(len(hw),1), s))
                scored.sort(key=lambda x:(-x[0],-x[1]))
                if scored and scored[0][0]>=0.8 and scored[0][1]>=0.6 and (len(scored)==1 or (scored[0][0],scored[0][1])>(scored[1][0],scored[1][1])):
                    best=scored[0][2]
            if best: cands=[best]; kind='words'
        if not cands: continue
        common=None
        toks=[]
        for s in cands:
            t=set(w for w in stem_words(s['head']+' '+'') if w not in STOP and w!='A' and len(w)>1)
            toks.append(t); common=t if common is None else (common&t)
        # a word is evidence only if it is RARE among this number's sections:
        # in at most half of them (and never in all of them)
        from collections import Counter
        df=Counter(w for t in toks for w in t)
        a=[[s['id'],' '.join(sorted(w for w in t if len(cands)==1 or df[w]<len(cands)))] for s,t in zip(cands,toks)]
        rec={'g':0,'a':a}
        if len(cands)>1: rec['m']=2; rec['d']=2
        if len(cands)>1:
            heads=[s for s in cands if re.search(r'(?<![A-Z0-9])'+re.escape(K)+r'(?![A-Z0-9])', re.sub(r'(\d)\s*[-–—]\s*(\d)',r'\1\2',s['head'].upper()).replace(' ',' '))]
            heads=[s for s in heads if not re.match(r'\s*CLICK\s+OR\s+SCROLL',s['head'].upper())]
            # a section is the number's home only if its own heading names the number;
            # otherwise there is no home and an undecided row stays at the page top
            if heads: rec['h']=heads[0]['id']
        entry[N]=rec
        report.append((slug,N,kind,len(cands)))
    if entry: DEEP[slug]=entry
json.dump(DEEP,open(os.path.join(W,'deep_new.json'),'w'),separators=(',',':'),sort_keys=True)
print(len(secs),'pages read,',sum(1 for v in secs.values() if v),'with item ids;',len(DEEP),'pages with entries,',sum(len(v) for v in DEEP.values()),'numbers')
