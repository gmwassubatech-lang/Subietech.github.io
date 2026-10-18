/* Mutation self-test for check-static.mjs. Run by CI on every push, and locally the
   same way: node .github/checks/mutation-test.mjs  (from the repo root).
   Copies the working tree into a temp dir (the real checkout is never moved),
   injects ONE defect at a time, runs the checker against the copy, and asserts:
     - checker exits 1
     - checker output names the failure
   Then runs the checker on the real site (must be exit 0) and asserts the repo
   state is byte-identical to before. */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(here, '..', '..');
const CHECKER = path.join(here, 'check-static.mjs');

function snapshot(dir) {
  const out = {};
  const walk = (d, base) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, f.name);
      if (f.isDirectory()) {
        if (f.name === '.git') continue;
        walk(full, base);
      } else {
        const rel = path.relative(REAL, full).replaceAll('\\', '/');
        out[rel] = fs.readFileSync(full).toString('base64');
      }
    }
  };
  walk(dir, true);
  return out;
}
const before = snapshot(REAL);

const apply = {
  // 1. old slogan back into index.html (hero div)
  oldSloganHtml(h) {
    return h.replace('<div class="slogan">Built for Subaru. Driven by trust.</div>',
      '<div class="slogan">Built different. Driven hard. Trusted always.</div>');
  },
  // 2. old slogan back into main.js (comment line)
  oldSloganJs(src) {
    return src.replace('// Only real, verified profiles. Add more (with its ICONS entry) when created.',
      '// Built different. Driven hard. Trusted always.');
  },
  // 3. TikTok handle swapped to the generic placeholder in main.js only
  missingTiktokHandle(src) {
    return src.replace('https://www.tiktok.com/@gmwassubietech', 'https://tiktok.com/');
  },
  // 4. sameAs dropped from the schema (JSON-LD in index.html; CRLF-tolerant)
  missingSameAs(h) {
    return h.replace(/,\r?\n\s*"sameAs": \[[\s\S]*?\]/, '');
  },
  // 5. placeholder facebook URL back into main.js
  placeholderFacebook(src) {
    return src.replace('const SOCIAL = {', 'const SOCIAL = {\n    Facebook : "https://facebook.com/",');
  },
  // 6. one service card removed (CRLF-tolerant)
  missingServiceCard(h) {
    return h.replace(/<div class="card"><div class="num">13<\/div><h3>Solenoids &amp; transmission actuators<\/h3><p>[\s\S]*?<\/p><\/div>(\r?\n\s*)?/, '');
  },
  // 7. one booking dropdown option removed (CRLF-tolerant)
  missingDropdownOption(h) {
    return h.replace(/<option>Solenoids \/ transmission actuators<\/option>(\r?\n)?/, '');
  },
  // 8. the whole transmission section removed
  missingTransmissionSection(h) {
    return h.replace(/<section class="sec transmission" id="transmission">[\s\S]*?<\/section>(\r?\n)?/, '');
  },
  // 9. the Gearbox nav link removed
  missingGearboxNav(h) {
    return h.replace(/\s*<a href="#transmission">Gearbox<\/a>(\r?\n)?/, '\r\n');
  },
  // 10. one transmission card removed
  missingTransmissionCard(h) {
    return h.replace(/<div class="card"><h3>Driveshafts, diffs &amp; AWD<\/h3>[\s\S]*?<\/div>(\r?\n\s*)?/, '');
  },
  // 11. one of the new dropdown options removed
  missingValveBodyOption(h) {
    return h.replace(/<option>Valve body \/ solenoid pack repair<\/option>(\r?\n)?/, '');
  },
  // 12. one new parts tile removed
  missingPartsTile(h) {
    return h.replace(/<a class="part"[^>]*data-wa="Hi SUBIE TECH, I need DIFF[^>]*>[\s\S]*?<\/a>(\r?\n)?/, '');
  },
  // 13. WhatsApp href no longer matches its data-wa message
  waHrefDrift(h) {
    return h.replace('?text=Hi%20SUBIE%20TECH%2C%20my%20Subaru%20gearbox',
      '?text=Hi%20SUBIE%20TECH%2C%20my%20Subaru%20gearbox%20EXTRA');
  },
};

const defectName = {
  oldSloganHtml: 'old slogan in markup',
  oldSloganJs: 'old slogan in main.js',
  missingTiktokHandle: 'TikTok handle missing',
  missingSameAs: 'schema sameAs missing',
  placeholderFacebook: 'placeholder social URL',
  missingServiceCard: 'service card missing',
  missingDropdownOption: 'dropdown option missing',
};

/* expect: the substring of checker output that names each defect */
const expectName = {
  oldSloganHtml: 'old slogan appears',
  oldSloganJs: 'old slogan in main.js',
  missingTiktokHandle: 'TikTok handle missing',
  missingSameAs: 'sameAs wrong/missing',
  placeholderFacebook: 'placeholder social URL still in main.js',
  missingServiceCard: 'missing service card: Solenoids',
  missingDropdownOption: 'booking dropdown missing option: Solenoids',
  missingTransmissionSection: 'transmission section missing',
  missingGearboxNav: 'nav missing Gearbox link',
  missingTransmissionCard: 'missing transmission card: Driveshafts',
  missingValveBodyOption: 'booking dropdown missing option: Valve body',
  missingPartsTile: 'missing parts tile: Diffs',
  waHrefDrift: 'data-wa href mismatch',
};

const results = [];
let failures = 0;

for (const [name, fn] of Object.entries(apply)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-mut-'));
  fs.cpSync(REAL, tmp, { recursive: true, filter: (src) => path.basename(src) !== '.git' });
  // apply the mutation
  if (name === 'oldSloganJs' || name === 'placeholderFacebook' || name === 'missingTiktokHandle') {
    const p = path.join(tmp, 'js', 'main.js');
    fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
  } else {
    const p = path.join(tmp, 'index.html');
    fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
  }
  // sanity: mutation must actually differ from real file
  const realFile = ['oldSloganJs', 'placeholderFacebook', 'missingTiktokHandle'].includes(name)
    ? fs.readFileSync(path.join(REAL, 'js', 'main.js'), 'utf8')
    : fs.readFileSync(path.join(REAL, 'index.html'), 'utf8');
  const mutFile = fs.readFileSync(['oldSloganJs', 'placeholderFacebook', 'missingTiktokHandle'].includes(name)
    ? path.join(tmp, 'js', 'main.js') : path.join(tmp, 'index.html'), 'utf8');
  if (mutFile === realFile) {
    results.push({ name, pass: false, note: 'MUTATION WAS A NO-OP (checker not exercised)' });
    failures++;
    continue;
  }
  const r = spawnSync(process.execPath, [CHECKER], {
    env: { ...process.env, SITE: tmp },
    encoding: 'utf8',
  });
  const exitOk = r.status === 1;
  const named = (r.stdout + r.stderr).includes(expectName[name]);
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
