#!/usr/bin/env node
/**
 * coverage-check.mjs — every source file is in at least one TypeScript project.
 *
 *   node tools/coverage-check.mjs
 *
 * ## Why this exists, which is a defect it would have caught in ten seconds
 *
 * The type checker is the whole build here, so a file the type checker does not
 * see is a file with no build at all. That is not a hypothetical: the browser
 * layer was added under `src/ui/`, the base config was given
 * `"exclude": ["src/ui/**"]` so the engine could keep a DOM-free `lib`, and the
 * web config was left to pick it up by `include`.
 *
 * **`exclude` is inherited through `extends`.** So the exclusion applied to both
 * projects, `tsc --noEmit` exited 0 on each of them, and the screen — which had
 * two real type errors in it, a wrong field name and a property that did not
 * exist — was checked by nobody. Two green runs over an empty set, which is
 * indistinguishable from two green runs.
 *
 * It was found by asking `--listFilesOnly` how many files it had actually
 * looked at, on a hunch that a screen written in one pass had no business
 * compiling first time. That hunch is not a build system.
 *
 * ## What it asks
 *
 * Every `.ts` in the tree, against the union of what each project reports it
 * loads. A file in no project FAILS. A project that loads nothing at all also
 * fails, since an empty project is the same defect one level up.
 *
 * Wired as a `.branch-guard also=` entry, so a config edit that quietly drops a
 * directory is refused at the commit that makes it.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const PROJECTS = ['tsconfig.json', 'tsconfig.web.json'];
const ROOTS = ['src', 'test', 'tools'];
const TSC = join(REPO, 'node_modules/typescript/lib/tsc.js');

/** Every tracked `.ts` under the roots. `.mjs` tools are not type-checked and never were. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(relative(REPO, full));
    }
  };
  for (const root of ROOTS) {
    const full = join(REPO, root);
    if (existsSync(full)) walk(full);
  }
  return out;
}

/** What a project actually loads, asked of the compiler rather than inferred from the config. */
function loadedBy(project) {
  const run = spawnSync(process.execPath, [TSC, '--project', join(REPO, project), '--listFilesOnly'], {
    encoding: 'utf8',
    cwd: REPO,
  });
  if (run.status !== 0 && (run.stdout ?? '') === '') {
    return { error: (run.stdout ?? '') + (run.stderr ?? ''), files: [] };
  }
  const files = (run.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => relative(REPO, resolve(line)))
    .filter((line) => !line.startsWith('..') && !line.startsWith('node_modules'));
  return { error: null, files };
}

console.log('\n=== every source file is in a project · Solve-ent ===\n');

const failures = [];
const covered = new Set();
const perProject = [];

for (const project of PROJECTS) {
  const { error, files } = loadedBy(project);
  if (error !== null) {
    failures.push(`${project} could not be read by the compiler:\n${error}`);
    continue;
  }
  const own = files.filter((f) => ROOTS.some((r) => f.startsWith(`${r}/`)));
  // AN EMPTY PROJECT IS THE SAME DEFECT ONE LEVEL UP. A config that loads
  // nothing exits 0 and looks exactly like a config that loads everything.
  if (own.length === 0) failures.push(`${project} loads no source files at all`);
  for (const f of own) covered.add(f);
  perProject.push([project, own.length]);
}

const all = sources();
const orphans = all.filter((f) => !covered.has(f));
for (const f of orphans) {
  failures.push(`${f} is in no TypeScript project — it has no build, and green means nothing for it`);
}

for (const [project, count] of perProject) console.log(`  ok    ${project} loads ${count} source file(s)`);

if (failures.length === 0) {
  console.log(`  ok    all ${all.length} source file(s) are checked by at least one project`);
  console.log('\nThe type checker is the whole build, so a file it cannot see has no build.\n');
  process.exit(0);
}
for (const failure of failures) console.log(`  FAIL  ${failure}`);
console.error(
  '\n`exclude` is inherited through `extends`, which is how a whole directory came to\n' +
    'be checked by neither project while both exited 0. A file in no project is not a\n' +
    'file that passed.\n',
);
process.exit(1);
