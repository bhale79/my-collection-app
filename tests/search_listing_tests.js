// GOOGLE SEARCH LISTING — robots.txt, sitemap.xml, the Search Console proof
// file and the home page's name label   (site release, 2026-10-19)
//
// Brad 2026-10-19: "show up in Google search for free". The site went public the
// same night (noindex dropped). Google Search Console is owned by
// support@therailroster.com, property https://therailroster.com/ (URL prefix),
// proven by the HTML-file method — the file must STAY or the site falls out of
// Search Console.
//
// Checks, each run against the real repo AND against a planted offender that
// must make it fail:
//   P  the proof file is there, and says exactly what Google expects
//   R  robots.txt names the sitemap and blocks no public page and not /app/
//      (a blocked page can't be read, so its noindex could never be seen)
//   S  the sitemap lists EXACTLY the public pages — every top-level page whose
//      index.html carries no noindex — so a new public page without a sitemap
//      line fails here, and so does a noindex page left in the sitemap
//   H  the home page: one canonical link to https://therailroster.com/, and a
//      name label (JSON-LD) that parses, names "The Rail Roster", points at a
//      logo that exists, and carries NO price (the price lives in app/config.js)

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://therailroster.com/';
const PROOF = 'google540af0b13abd3cff.html';

let pass = 0, fail = 0;
function ok(name, cond, why) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (why ? '  —  ' + why : '')); }
}

// A snapshot of the repo the checks read, so a planted copy can be fed in.
function snapshot() {
  const rd = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };
  const pages = {};                       // '/' and '/<dir>/' → the page's html
  pages['/'] = rd('index.html');
  for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || d.name === 'node_modules') continue;
    const h = rd(path.join(d.name, 'index.html'));
    if (h != null) pages['/' + d.name + '/'] = h;
  }
  const files = {};
  for (const f of fs.readdirSync(ROOT)) if (/^google[0-9a-f]+\.html$/.test(f)) files[f] = rd(f);
  return { pages, robots: rd('robots.txt'), sitemap: rd('sitemap.xml'), proofs: files,
           exists: f => fs.existsSync(path.join(ROOT, f)) };
}

const noindex = h => /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(h || '');

function checkProof(s) {
  const body = s.proofs[PROOF];
  if (body == null) return 'the proof file ' + PROOF + ' is missing';
  if (body.trim() !== 'google-site-verification: ' + PROOF) return 'its text is not what Google expects';
  for (const [f, b] of Object.entries(s.proofs))
    if ((b || '').trim() !== 'google-site-verification: ' + f) return f + ' does not name itself';
  return '';
}

function checkRobots(s) {
  const r = s.robots;
  if (r == null) return 'robots.txt is missing';
  if (!r.split('\n').some(l => l.trim() === 'Sitemap: ' + SITE + 'sitemap.xml')) return 'no Sitemap line';
  const blocked = r.split('\n').map(l => l.trim()).filter(l => /^disallow:/i.test(l))
    .map(l => l.replace(/^disallow:\s*/i, '')).filter(Boolean);
  for (const b of blocked) {
    if (b === '/') return 'Disallow: / blocks the whole site';
    if ('/app/'.startsWith(b) || b.startsWith('/app')) return 'it blocks /app/ — its noindex could not be seen';
    for (const p of Object.keys(s.pages)) if (!noindex(s.pages[p]) && p.startsWith(b)) return 'it blocks the public page ' + p;
  }
  return '';
}

function checkSitemap(s) {
  const x = s.sitemap;
  if (x == null) return 'sitemap.xml is missing';
  if (!/^<\?xml/.test(x) || !/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(x)) return 'not a sitemap';
  const listed = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  for (const u of listed) if (!u.startsWith(SITE)) return u + ' is not on ' + SITE;
  const paths = listed.map(u => '/' + u.slice(SITE.length));
  const pub = Object.keys(s.pages).filter(p => !noindex(s.pages[p])).sort();
  const got = [...paths].sort();
  if (new Set(got).size !== got.length) return 'a page is listed twice';
  for (const p of got) if (!(p in s.pages)) return p + ' is listed but has no page';
  for (const p of got) if (noindex(s.pages[p])) return p + ' is listed but tells Google not to list it';
  for (const p of pub) if (!got.includes(p)) return 'the public page ' + p + ' is missing from the sitemap';
  if ((x.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length !== listed.length)
    return 'every page needs a lastmod date';
  return '';
}

function checkHome(s) {
  const h = s.pages['/'];
  if (h == null) return 'no home page';
  if (noindex(h)) return 'the home page says noindex';
  const canon = [...h.matchAll(/<link[^>]+rel=["']canonical["'][^>]*>/gi)];
  if (canon.length !== 1) return canon.length + ' canonical links (want 1)';
  if (!canon[0][0].includes('href="' + SITE + '"')) return 'the canonical link is not ' + SITE;
  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (blocks.length !== 1) return blocks.length + ' JSON-LD blocks (want 1)';
  let j; try { j = JSON.parse(blocks[0][1]); } catch (e) { return 'the JSON-LD does not parse: ' + e.message; }
  const g = j['@graph'] || [j];
  const site = g.find(n => n['@type'] === 'WebSite');
  const org = g.find(n => n['@type'] === 'Organization');
  if (!site || site.name !== 'The Rail Roster' || site.url !== SITE) return 'the WebSite label is wrong';
  if (!org || org.name !== 'The Rail Roster') return 'the Organization label is wrong';
  const logo = String(org.logo || '');
  if (!logo.startsWith(SITE) || !s.exists(logo.slice(SITE.length))) return 'the logo ' + logo + ' is not a file on the site';
  if (/price|\$\s*\d|"offers"/i.test(blocks[0][1])) return 'the label carries a price — the price lives in app/config.js only';
  return '';
}

const CHECKS = [['P proof file', checkProof], ['R robots.txt', checkRobots],
                ['S sitemap', checkSitemap], ['H home page label', checkHome]];

console.log('search_listing_tests — the real repo');
const real = snapshot();
for (const [n, f] of CHECKS) { const e = f(real); ok(n, !e, e); }

// Planted offenders — each must be caught.
console.log('search_listing_tests — planted offenders (each must FAIL its check)');
const clone = () => { const s = snapshot(); s.pages = { ...s.pages }; s.proofs = { ...s.proofs }; return s; };
const PLANTS = [
  ['P', checkProof, s => { delete s.proofs[PROOF]; }, 'proof file removed'],
  ['P', checkProof, s => { s.proofs[PROOF] = 'google-site-verification: google0000.html'; }, 'proof text wrong'],
  ['R', checkRobots, s => { s.robots = s.robots.replace(/Sitemap:.*\n?/, ''); }, 'no Sitemap line'],
  ['R', checkRobots, s => { s.robots += '\nDisallow: /app/\n'; }, '/app/ blocked'],
  ['R', checkRobots, s => { s.robots += '\nDisallow: /terms/\n'; }, 'a public page blocked'],
  ['S', checkSitemap, s => { s.pages['/faq/'] = '<html><head><title>x</title></head></html>'; }, 'new public page not in the sitemap'],
  ['S', checkSitemap, s => { s.pages['/terms/'] = '<meta name="robots" content="noindex">'; }, 'noindex page left in the sitemap'],
  ['S', checkSitemap, s => { s.sitemap = s.sitemap.replace('</urlset>', '<url><loc>https://therailroster.com/gone/</loc><lastmod>2026-10-19</lastmod></url></urlset>'); }, 'listed page that does not exist'],
  ['H', checkHome, s => { s.pages['/'] = s.pages['/'].replace(/<link rel="canonical"[^>]*>\n?/, ''); }, 'canonical removed'],
  ['H', checkHome, s => { s.pages['/'] = s.pages['/'].replace('"name":"The Rail Roster","url":"https://therailroster.com/","publisher"', '"name":"Rail Roster","url":"https://therailroster.com/","publisher"'); }, 'site name wrong'],
  ['H', checkHome, s => { s.pages['/'] = s.pages['/'].replace('"logo":"https://therailroster.com/app/icon-512.png"', '"logo":"https://therailroster.com/app/no-such.png","offers":{"price":"75"}'); }, 'missing logo + a price'],
  ['H', checkHome, s => { s.pages['/'] = s.pages['/'].replace('{"@context"', '{"@context":,'); }, 'JSON-LD broken'],
];
for (const [tag, f, plant, what] of PLANTS) {
  const s = clone(); plant(s); const e = f(s);
  ok(tag + ' catches: ' + what, !!e, 'the planted offender got through');
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  search_listing_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
