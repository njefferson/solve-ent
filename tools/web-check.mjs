#!/usr/bin/env node
/**
 * web-check.mjs — the drift half of tools/web-build.mjs, as its own executable so
 * `.branch-guard` can name it. The guard runs `also=` entries as commands with
 * no arguments, so a check that needs a flag needs a file.
 *
 * Two lines rather than a second implementation: forking the generator would
 * put the engine a browser runs back to being defined in two places, which is the exact thing
 * generating them was for.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = spawnSync(process.execPath, [join(here, 'web-build.mjs'), '--check'], { stdio: 'inherit' });
process.exit(run.status ?? 1);
