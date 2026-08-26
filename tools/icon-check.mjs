#!/usr/bin/env node
/**
 * icon-check.mjs — the drift half of tools/icon.mjs, as its own executable so
 * `.branch-guard` can name it. The guard runs `also=` entries as commands with
 * no arguments, so a check that needs a flag needs a file.
 *
 * The icon is the one surface the accessibility gate cannot reach, so an
 * unmeasured colour reaching it would stay. This is what makes "the icon comes
 * from the palette" a fact rather than a comment.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = spawnSync(process.execPath, [join(here, 'icon.mjs'), '--check'], { stdio: 'inherit' });
process.exit(run.status ?? 1);
