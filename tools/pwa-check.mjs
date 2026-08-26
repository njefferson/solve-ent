#!/usr/bin/env node
/**
 * pwa-check.mjs — the drift half of tools/pwa.mjs, as its own executable so
 * `.branch-guard` can name it. The guard runs `also=` entries with no
 * arguments, so a check that needs a flag needs a file.
 *
 * Two lines rather than a second implementation: forking the generator would
 * put the cache name and the precache list back to being defined in two places,
 * which is the exact thing generating them was for.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = spawnSync(process.execPath, [join(here, 'pwa.mjs'), '--check'], { stdio: 'inherit' });
process.exit(run.status ?? 1);
