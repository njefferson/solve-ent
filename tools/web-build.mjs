#!/usr/bin/env node
/**
 * web-build.mjs — the engine, as a browser can run it.
 *
 *   node tools/web-build.mjs           write public/app/
 *   node tools/web-build.mjs --check   fail if it has drifted from src/
 *
 * ## The thing this repository had not had to answer yet
 *
 * "No bundler, no build step beyond the type checker" was written when there
 * was no screen, and Node strips TypeScript by itself. **A browser does not.**
 * The engine is the app — the generator, the classifier, the step machine — and
 * a second copy written in JavaScript for the browser would be a fork of the one
 * thing in here that must never have two versions.
 *
 * So the types are erased for the browser, and erasure is ALL that happens.
 * `erasableSyntaxOnly` in the base config is what makes that a checkable claim
 * rather than a hopeful one: it refuses any TypeScript whose meaning is not
 * purely annotation, so removing the types is a deletion and never a transform.
 * One file in, one file out, same name, same imports, same order, same target,
 * comments intact. No module graph is flattened, nothing is minified,
 * no dependency is resolved into the output, and nothing is added to the
 * dependency list — the type checker was already here.
 *
 * ## Why the output is COMMITTED rather than built at deploy time
 *
 * Because `public/` is the site, in this family, in every repository. Building
 * at deploy time would mean the deployed directory does not exist in the tree,
 * a Pages project that needs a build command set correctly by hand, and a new
 * way for a release to silently not arrive — which is hub LESSONS §53, and it
 * cost four releases somewhere else.
 *
 * The cost of committing it is staleness, and staleness is what a gate is for:
 * this runs on every commit through `.branch-guard`, so the tree cannot hold an
 * emitted engine that its source no longer says.
 *
 * ## What it refuses
 *
 * Anything under `public/app/` that no longer has a source. A file left behind
 * by a rename is worse than a stale one: it still imports, still runs, and is
 * whatever it was the day it was orphaned.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(REPO, 'public/app');
const PROJECT = join(REPO, 'tsconfig.web.json');
const CHECK = process.argv.includes('--check');

/** Every file under a directory, as paths relative to it. Sorted, so two trees compare. */
function tree(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full));
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

function emit(outDir) {
  const run = spawnSync(
    process.execPath,
    [join(REPO, 'node_modules/typescript/lib/tsc.js'), '--project', PROJECT, '--outDir', outDir],
    { encoding: 'utf8', cwd: REPO },
  );
  if (run.status !== 0) {
    console.error(`\nThe engine does not type-check for the browser:\n\n${run.stdout}${run.stderr}\n`);
    process.exit(1);
  }
}

if (!CHECK) {
  // A clean write, so a renamed module cannot leave its old output behind.
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  emit(OUT);
  const files = tree(OUT);
  console.log(`wrote public/app/ — ${files.length} module(s), types erased and nothing else`);
  process.exit(0);
}

console.log('\n=== the engine, as a browser runs it · Solve-ent ===\n');

const scratch = join(tmpdir(), `solvent-web-${process.pid}`);
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
emit(scratch);

const fresh = tree(scratch);
const shipped = tree(OUT);
const failures = [];

const orphans = shipped.filter((f) => !fresh.includes(f));
const absent = fresh.filter((f) => !shipped.includes(f));
for (const f of orphans) failures.push(`public/app/${f} has no source — a rename left it behind, and it still runs`);
for (const f of absent) failures.push(`public/app/${f} is missing — the browser would fetch a module that is not there`);

let compared = 0;
for (const f of fresh.filter((x) => shipped.includes(x))) {
  compared += 1;
  if (readFileSync(join(scratch, f), 'utf8') !== readFileSync(join(OUT, f), 'utf8')) {
    failures.push(`public/app/${f} has drifted from its source`);
  }
}
rmSync(scratch, { recursive: true, force: true });

if (failures.length === 0) {
  console.log(`  ok    ${compared} module(s) in public/app/ match their source exactly`);
  console.log('  ok    nothing under public/app/ is without a source');
  console.log('\nThe types are erased for the browser, and erasure is all that happens.\n');
  process.exit(0);
}
for (const failure of failures) console.log(`  FAIL  ${failure}`);
console.error(
  '\npublic/ is the site, so the engine a browser runs lives in the tree rather than\n' +
    'being built at deploy time. That makes staleness the risk, and this is the gate\n' +
    'for it. Run: node tools/web-build.mjs\n',
);
process.exit(1);
