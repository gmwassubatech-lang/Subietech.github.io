/* Static checks for the site: XML well-formedness of the sitemap, robots.txt rules,
   every sitemap URL maps to a real file, and head/CTA assertions on each page.
   Usage: node .github/checks/check-static.mjs  (from the repo root; also run by CI on every push) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// SITE can be overridden (used by the mutation self-test to check a throwaway copy)
const SITE = process.env.SITE ? path.resolve(process.env.SITE) : path.join(here, '..', '..');
const ORIGIN = 'https://gmwasubietech.online';
let fail = 0;
const ok = (m) => console.log('PASS ' + m);
const bad = (m) => { fail++; console.log('FAIL ' + m); };

/* --- robots.txt --- */
const robots = fs.readFileSync(path.join(SITE, 'robots.txt'), 'utf8');
/^\s*User-agent:\s*\*/m.test(robots) ? ok('robots.txt has User-agent: *') : bad('robots.txt missing User-agent');
robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`) ? ok('robots.txt points at absolute sitemap URL') : bad('robots.txt sitemap line wrong');

/* --- sitemap.xml --- */
const sm = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
let wellFormed = sm.startsWith('<?xml');
const stack = [];
const tokens = [...sm.matchAll(/<(\w+)[^>]*?(\/?)>|<\/(\w+)>/g)];
for (const t of tokens) {
  if (t[3]) {                       // closing tag
    if (stack.pop() !== t[3]) wellFormed = false;
  } else if (t[1] && t[2] !== '/') { // opening tag
    stack.push(t[1]);
  }
}
if (stack.length) wellFormed = false;
wellFormed ? ok('sitemap.xml is well-formed XML') : bad('sitemap.xml XML structure wrong');
sm.includes('http://www.sitemaps.org/schemas/sitemap/0.9') ? ok('sitemap.xml has the sitemap namespace') : bad('sitemap.xml namespace missing');
[...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].forEach((m) => {
  const url = m[1];
  url.startsWith(ORIGIN) ? ok('loc is absolute on production domain: ' + url) : bad('loc not on production domain: ' + url);
  const p = new URL(url).pathname;
  const file = p.endsWith('/') ? path.join(SITE, p, 'index.html') : path.join(SITE, p);
  fs.existsSync(file) ? ok('sitemap URL exists in repo: ' + p) : bad('sitemap URL has no file: ' + p);
});

/* --- every html page: canonical + social meta --- */
const pages = fs.readdirSync(SITE).filter((f) => f.endsWith('.html'));
for (const page of pages) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const dir = path.dirname('/');
  const url = page === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${page}`;
  html.includes('<link rel="canonical"') ? ok(`${page}: canonical present`) : bad(`${page}: canonical missing`);
  html.includes(`property="og:url" content="${url}"`) ? ok(`${page}: og:url matches canonical`) : bad(`${page}: og:url != ${url}`);
  /property="og:image" content="https:\/\//.test(html) ? ok(`${page}: og:image absolute`) : bad(`${page}: og:image not absolute`);
  /name="twitter:image" content="https:\/\//.test(html) ? ok(`${page}: twitter:image absolute`) : bad(`${page}: twitter:image not absolute`);
  const noHref = [...html.matchAll(/<a (?![^>]*href=)[^>]*data-wa=/g)].length;
  noHref === 0 ? ok(`${page}: all data-wa elements have href`) : bad(`${page}: ${noHref} data-wa elements without href`);
  const noTel = [...html.matchAll(/<a (?![^>]*href=)[^>]*(id="callLink"|id="fabCall")[^>]*>/g)].length;
  noTel === 0 ? ok(`${page}: telephone links have href`) : bad(`${page}: telephone link without href`);

  /* --- trust/markup assertions (phase 2) --- */
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of ldBlocks) {
    let obj;
    try { obj = JSON.parse(b[1]); ok(`${page}: JSON-LD parses`); }
    catch (e) { bad(`${page}: JSON-LD does not parse (${e.message})`); continue; }
    const nodes = obj['@graph'] || [obj];
    const types = nodes.map((n) => n['@type']);
    types.includes('AutoRepair') ? ok(`${page}: schema has AutoRepair`) : bad(`${page}: schema missing AutoRepair`);
    types.includes('WebSite') ? ok(`${page}: schema has WebSite`) : bad(`${page}: schema missing WebSite`);
    const business = nodes.find((n) => n['@type'] === 'AutoRepair');
    const site = nodes.find((n) => n['@type'] === 'WebSite');
    if (business && site) {
      site.publisher && site.publisher['@id'] === business['@id']
        ? ok(`${page}: WebSite publisher -> business @id`)
        : bad(`${page}: WebSite publisher does not link to business`);
    }
    const raw = b[1];
    ['priceRange', 'aggregateRating', '"@type": "Review"', 'foundingDate', 'numberOfEmployees', 'address']
      .filter((k) => raw.includes(k))
      .forEach((k) => bad(`${page}: schema contains unverified field ${k}`));
    raw.includes('Built for Subaru. Driven by trust.')
      ? ok(`${page}: schema slogan is the current brand slogan`)
      : bad(`${page}: schema slogan missing/outdated`);
    raw.includes('Built different. Driven hard') && bad(`${page}: old slogan still in schema`);
  }

  /* --- honest testimonials (phase 2) --- */
  const trustProblems = [];
  if (html.includes('Add real customer')) trustProblems.push('fake testimonial placeholder still live');
  if (/class="stars5"/.test(html)) trustProblems.push('star rating markup still present');
  if (/★★★★★/.test(html)) trustProblems.push('star glyphs still rendered');
  if (/property="og:description"[^>]*Built different\. Driven hard/.test(html)) trustProblems.push('old slogan still in og:description');
  trustProblems.length === 0
    ? ok(`${page}: no fabricated testimonials or stale slogan in markup`)
    : trustProblems.forEach((p) => bad(`${page}: ${p}`));
}  /* --- social + slogan sweep (this pass) --- */
  const mainJs = fs.readFileSync(path.join(SITE, 'js', 'main.js'), 'utf8');
  const placeholderSocials = ['"https://facebook.com/"', '"https://instagram.com/"', '"https://tiktok.com/"', '"https://youtube.com/"', '"https://x.com/"', '"https://linkedin.com/"'];
  const ph = placeholderSocials.filter((p) => mainJs.includes(p));
  ph.length === 0 ? ok(`site: no placeholder social URLs in main.js`) : ph.forEach((p) => bad(`site: placeholder social URL still in main.js: ${p}`));
  mainJs.includes('tiktok.com/@gmwassubietech') ? ok(`site: real TikTok handle wired`) : bad(`site: TikTok handle missing`);
  mainJs.includes('youtube.com/channel/UCxahd5f0KrdYQGU__6qC7kA') ? ok(`site: real YouTube channel wired`) : bad(`site: YouTube channel missing`);

  for (const block of [...fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]) {
    const obj = JSON.parse(block[1]);
    const nodes = obj['@graph'] || [obj];
    const biz = nodes.find((n) => n['@type'] === 'AutoRepair');
    if (!biz) continue;
    const sameAs = biz.sameAs || [];
    sameAs.length === 2 && sameAs.some((u) => u.includes('@gmwassubietech')) && sameAs.some((u) => u.includes('UCxahd5f0KrdYQGU__6qC7kA'))
      ? ok(`site: schema sameAs carries both real profiles`)
      : bad(`site: schema sameAs wrong/missing`);
    sameAs.some((u) => u.includes('facebook.com')) && bad(`site: unverified Facebook URL in sameAs`);
  }

  /* old slogan must appear nowhere in HTML or main.js */
  const staleHtml = (fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').match(/Built different\. Driven hard/g) || []).length;
  staleHtml === 0 ? ok(`site: old slogan fully swept from markup`) : bad(`site: old slogan appears ${staleHtml}x in markup`);
  const staleJs = (mainJs.match(/Built different/g) || []).length;
  staleJs === 0 ? ok(`site: old slogan absent from main.js`) : bad(`site: old slogan in main.js`);

  /* booking dropdown must route the new services */
  const served = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  for (const o of ['Motherboard / ECU board repair', 'BCM / body electronics', 'Keys &amp; immobiliser coding', 'Solenoids / transmission actuators', 'Gearbox service / CVT relearns']) {
    served.includes(`<option>${o}</option>`) ? ok(`site: booking dropdown option: ${o}`) : bad(`site: booking dropdown missing option: ${o}`);
  }

  /* new service cards present */
  for (const s of ['Motherboard &amp; ECU board repair', 'BCM &amp; body electronics', 'Keys &amp; immobiliser coding', 'Solenoids &amp; transmission actuators', 'Gearbox service &amp; CVT relearns']) {
    served.includes(s) ? ok(`site: service card present: ${s}`) : bad(`site: missing service card: ${s}`);
  }

  /* --- transmission section (this pass) --- */
  const idxl = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const trAt = idxl.indexOf('id="transmission"');
  trAt > -1 ? ok('site: transmission section present') : bad('site: transmission section missing');
  if (trAt > -1) {
    trAt < idxl.indexOf('id="reviews"')
      ? ok('site: transmission section precedes reviews')
      : bad('site: transmission section out of order');
    idxl.includes('<a href="#transmission">Gearbox</a>')
      ? ok('site: nav links to transmission section')
      : bad('site: nav missing Gearbox link');
    for (const t of ['Solenoid &amp; valve body repair', 'Gearbox service &amp; CVT relearns', 'CVT &amp; automatic fault diagnosis', 'Clutch, flywheel &amp; manual rebuilds', 'Driveshafts, diffs &amp; AWD', 'Gearbox supply &amp; fit']) {
      idxl.includes(`<h3>${t}</h3>`) ? ok(`site: transmission card: ${t}`) : bad(`site: missing transmission card: ${t}`);
    }
    idxl.includes('Diagnose my gearbox') ? ok('site: transmission CTA present') : bad('site: transmission CTA missing');
  }
  for (const o of ['Valve body / solenoid pack repair', 'Clutch, flywheel / manual gearbox rebuild', 'Driveshafts, diffs / AWD driveline']) {
    idxl.includes(`<option>${o}</option>`) ? ok(`site: booking dropdown option: ${o}`) : bad(`site: booking dropdown missing option: ${o}`);
  }
  for (const p of ['Transmission parts', 'Solenoids &amp; sensors', 'Clutches &amp; flywheels', 'Diffs &amp; driveshafts']) {
    idxl.includes(`<h4>${p}</h4>`) ? ok(`site: parts tile present: ${p}`) : bad(`site: missing parts tile: ${p}`);
  }
  for (const q of ['Can you fix harsh shifting or a slipping CVT?', 'Do you rebuild manual gearboxes and replace clutches?']) {
    idxl.includes(`<summary>${q}</summary>`) ? ok(`site: FAQ entry present: ${q}`) : bad(`site: missing FAQ entry: ${q}`);
  }
  /<meta name="description" content="[^"]*gearbox[^"]*CVT/i.test(idxl)
    ? ok('site: meta description mentions gearbox and CVT')
    : bad('site: meta description lacks gearbox/CVT terms');
  /<meta property="og:description" content="[^"]*gearbox/i.test(idxl)
    ? ok('site: og:description mentions gearbox')
    : bad('site: og:description lacks gearbox terms');

  /* --- every data-wa link must carry that exact message in its href --- */
  const ents = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
  const unent = (s) => s.replace(/&(amp|quot|#39|lt|gt);/g, (m) => ents[m]);
  let parityFails = 0;
  let parityLinks = 0;
  for (const m of idxl.matchAll(/<a\b[^>]*?\bhref="([^"]*)"[^>]*?\bdata-wa="([^"]*)"/g)) {
    parityLinks++;
    const [, href, wa] = m;
    let text = null;
    try { text = new URL(unent(href)).searchParams.get('text'); } catch { /* non-URL href */ }
    if (text !== unent(wa)) {
      parityFails++;
      bad(`site: data-wa href mismatch -> "${unent(wa).slice(0, 40)}..."`);
    }
  }
  parityLinks > 0 && parityFails === 0
    ? ok(`site: all ${parityLinks} data-wa links carry their exact message`)
    : (parityLinks === 0 && bad('site: no data-wa links found to check'));

  console.log(fail ? `\n${fail} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
