/* Mutation self-test for check-static.mjs. Run by CI on every push, and locally the
   same way: node .github/checks/mutation-test.mjs  (from the repo root).
   Copies the working tree into a temp dir (the real checkout is never moved),
   injects ONE defect at a time, runs the checker against the copy, and asserts:
     - checker exits 1
     - checker output names the failure
   Then runs the checker on the real site (must be exit 0) and asserts the repo
   state is byte-identical to before. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(here, '..', '..');
const CHECKER = path.join(here, 'check-static.mjs');

function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, f.name);
      if (f.isDirectory()) {
        if (f.name === '.git') continue;
        walk(full);
      } else {
        const rel = path.relative(REAL, full).replaceAll('\\', '/');
        out[rel] = fs.readFileSync(full).toString('base64');
      }
    }
  };
  walk(dir);
  return out;
}
const before = snapshot(REAL);

/* Each case names one defect: the file it lives in, the edit that injects it,
   and the phrase the checker must print when it catches it. */
const cases = [
  {
    name: 'oldSloganHtml',
    file: 'index.html',
    expect: 'old slogan appears',
    apply: (h) => h.replace('<div class="slogan">Built for Subaru. Driven by trust.</div>',
      '<div class="slogan">Built different. Driven hard. Trusted always.</div>'),
  },
  {
    name: 'oldSloganJs',
    file: 'js/main.js',
    expect: 'old slogan in main.js',
    apply: (src) => src.replace('// Only real, verified profiles. Add more (with its ICONS entry) when created.',
      '// Built different. Driven hard. Trusted always.'),
  },
  {
    name: 'missingTiktokHandle',
    file: 'js/main.js',
    expect: 'TikTok handle missing',
    apply: (src) => src.replace('https://www.tiktok.com/@gmwassubietech', 'https://tiktok.com/'),
  },
  {
    name: 'missingSameAs',
    file: 'index.html',
    expect: 'sameAs wrong/missing',
    apply: (h) => h.replace(/,\r?\n\s*"sameAs": \[[\s\S]*?\]/, ''),
  },
  {
    name: 'placeholderFacebook',
    file: 'js/main.js',
    expect: 'placeholder social URL still in main.js',
    apply: (src) => src.replace('const SOCIAL = {', 'const SOCIAL = {\n    Facebook : "https://facebook.com/",'),
  },
  {
    name: 'missingServiceCard',
    file: 'index.html',
    expect: 'missing service card: Solenoids',
    apply: (h) => h.replace(/<div class="card"><div class="num">13<\/div><h3>Solenoids &amp; transmission actuators<\/h3><p>[\s\S]*?<\/p><\/div>(\r?\n\s*)?/, ''),
  },
  {
    name: 'missingDropdownOption',
    file: 'index.html',
    expect: 'booking dropdown missing option: Solenoids',
    apply: (h) => h.replace(/<option>Solenoids \/ transmission actuators<\/option>(\r?\n)?/, ''),
  },
  {
    name: 'missingTransmissionSection',
    file: 'index.html',
    expect: 'transmission section missing',
    apply: (h) => h.replace(/<section class="sec transmission" id="transmission">[\s\S]*?<\/section>(\r?\n)?/, ''),
  },
  {
    name: 'missingGearboxNav',
    file: 'index.html',
    expect: 'nav missing Gearbox link',
    apply: (h) => h.replace(/\s*<a href="#transmission">Gearbox<\/a>(\r?\n)?/, '\r\n'),
  },
  {
    name: 'missingTransmissionCard',
    file: 'index.html',
    expect: 'missing transmission card: Driveshafts',
    apply: (h) => h.replace(/<div class="card"><h3>Driveshafts, diffs &amp; AWD<\/h3>[\s\S]*?<\/div>(\r?\n\s*)?/, ''),
  },
  {
    name: 'missingValveBodyOption',
    file: 'index.html',
    expect: 'booking dropdown missing option: Valve body',
    apply: (h) => h.replace(/<option>Valve body \/ solenoid pack repair<\/option>(\r?\n)?/, ''),
  },
  {
    name: 'missingPartsTile',
    file: 'index.html',
    expect: 'missing parts tile: Diffs',
    apply: (h) => h.replace(/<a class="part"[^>]*data-wa="Hi SUBIE TECH, I need DIFF[^>]*>[\s\S]*?<\/a>(\r?\n)?/, ''),
  },
  {
    name: 'waHrefDrift',
    file: 'index.html',
    expect: 'data-wa href mismatch',
    apply: (h) => h.replace('?text=Hi%20SUBIE%20TECH%2C%20my%20Subaru%20gearbox',
      '?text=Hi%20SUBIE%20TECH%2C%20my%20Subaru%20gearbox%20EXTRA'),
  },
  {
    // the call button must keep the country code, or it cannot dial from abroad
    name: 'localDialHref',
    file: 'index.html',
    expect: 'call button not wired to',
    apply: (h) => h.replace('id="fabCall" href="tel:+254745505324"',
      'id="fabCall" href="tel:0745505324"'),
  },
  {
    // the call button must keep the logo blue, not drift back to the old gold
    name: 'goldCallFab',
    file: 'css/styles.css',
    expect: 'call button does not use the logo blue',
    apply: (css) => css.replace('.fab .call{background:var(--accent)',
      '.fab .call{background:var(--gold)'),
  },
];

const results = [];
let failures = 0;

for (const { name, file, expect, apply } of cases) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-mut-'));
  fs.cpSync(REAL, tmp, { recursive: true, filter: (src) => path.basename(src) !== '.git' });
  const target = path.join(tmp, file);
  fs.writeFileSync(target, apply(fs.readFileSync(target, 'utf8')));

  // sanity: the mutation must actually change the file, or the checker is untested
  if (fs.readFileSync(target, 'utf8') === fs.readFileSync(path.join(REAL, file), 'utf8')) {
    results.push({ name, pass: false, note: 'MUTATION WAS A NO-OP (checker not exercised)' });
    failures++;
    fs.rmSync(tmp, { recursive: true, force: true });
    continue;
  }

  const r = spawnSync(process.execPath, [CHECKER], {
    env: { ...process.env, SITE: tmp },
    encoding: 'utf8',
  });
  const exitOk = r.status === 1;
  const named = (r.stdout + r.stderr).includes(expect);
  results.push({ name, pass: exitOk && named, exit: r.status, named });
  if (!(exitOk && named)) failures++;
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* clean control: checker must pass on the untouched real site */
const control = spawnSync(process.execPath, [CHECKER], { encoding: 'utf8' });

/* real repo must be byte-identical to the start */
const after = snapshot(REAL);
const untouched = JSON.stringify(before) === JSON.stringify(after);

console.log('=== per-mutation results ===');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? ' — ' + r.note : ''}  (exit=${r.exit ?? 'n/a'}, named=${r.named ?? 'n/a'})`);
}
console.log(`\ncontrol run on real site: exit=${control.status} (expect 0)`);
console.log(`real site untouched after all mutations: ${untouched ? 'YES' : 'NO — DO NOT TRUST RESULTS'}`);
console.log(`\n${failures === 0 && control.status === 0 && untouched ? 'MUTATION SUITE: ALL GREEN' : 'MUTATION SUITE: FAILURES PRESENT'}`);
process.exit(failures === 0 && control.status === 0 && untouched ? 0 : 1);
