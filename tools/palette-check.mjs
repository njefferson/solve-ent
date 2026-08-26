#!/usr/bin/env node
/**
 * palette-check.mjs — the drift half of tools/palette.mjs, as its own executable so
 * `.branch-guard` can name it. The guard runs `also=` entries as commands with
 * no arguments, so a check that needs a flag needs a file.
 *
 * Two lines rather than a second implementation: forking the generator would
 * put the colour tokens back to being defined in two places, which is the exact thing
 * generating them was for.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = spawnSync(process.execPath, [join(here, 'palette.mjs'), '--check'], { stdio: 'inherit' });
process.exit(run.status ?? 1);
