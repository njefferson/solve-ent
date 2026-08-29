#!/usr/bin/env node
/**
 * palette.mjs — the colour tokens, from ONE source.
 *
 *   node tools/palette.mjs           write public/css/tokens.css
 *   node tools/palette.mjs --check   fail if it has drifted from the palette
 *
 * ## Why generate rather than type
 *
 * Hub PALETTES.md §6, and it is the step it says is never optional:
 * **consolidate the token declarations to ONE source before there is more than
 * one of anything.** A palette declared in N places becomes `N × families ×
 * modes` blocks that must never drift, and this family has been bitten by
 * must-change-together token definitions repeatedly.
 *
 * Solve-ent has no screen yet, which is the cheapest possible moment to get this
 * right: `palettes/solve-ent.json` is the source, the hub's `palette-check.mjs`
 * measures THAT FILE against the hard floors, and this writes the CSS. So the
 * values the gate measures and the values a browser paints cannot be different
 * values — which is a property, not a promise, and the thing a second
 * declaration would quietly take away.
 *
 * ## The mode cascade, and why it is four blocks rather than two
 *
 * Night is the default because a colour must be defined outside every media
 * query and every attribute selector — a token whose only declaration lives in
 * one of those has no value in the other case. Then day arrives three ways, and
 * all three are needed:
 *
 *   - the system asking for light, with no explicit choice stored;
 *   - an explicit choice of day, which must beat the system asking for dark;
 *   - an explicit choice of night, which must beat the system asking for light.
 *
 * Dropping the last one is the common version of this bug: it looks correct
 * until somebody on a light-set device turns night mode on and nothing happens.
 *
 * ## What it refuses to generate
 *
 * A palette the hub's gate has not passed. The check is invoked here rather
 * than trusted to a separate step, because the failure this exists to prevent
 * is a colour reaching a screen without having been measured, and a gate in a
 * different command is a gate somebody can be in a hurry past.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(REPO, 'palettes/solve-ent.json');
const TARGET = join(REPO, 'public/css/tokens.css');
/**
 * Where the hub's palette gate is, which is TWO PLACES and not one.
 *
 * A session has the hub checked out beside this repository; CI checks it out
 * SHA-pinned into `.hub`, which is the name the hub's own gates know to skip.
 * Looking in only one of those is how a check comes to be watched passing in
 * the one place it proves nothing about — hub LESSONS §107 and §117, which cost
 * ten CI runs and three releases elsewhere. Both are tried, and finding neither
 * is a FAILURE rather than a skip: a colour reaching a screen unmeasured is the
 * whole thing this exists to prevent.
 */
const HUB_CANDIDATES = [join(REPO, '.hub/palette-check.mjs'), join(REPO, '../noahjefferson/palette-check.mjs')];
const HUB_GATE = HUB_CANDIDATES.find((path) => existsSync(path)) ?? null;

/** The night entry and the day entry, by name. */
const NIGHT = 'solvent-night';
const DAY = 'solvent-day';

/**
 * Role → token name. The ROLES are the hub's (PALETTES.md §1) and the names are
 * this app's; keeping the mapping in one table is what lets the shared gate
 * measure this palette without knowing anything about this app.
 */
const NAMES = {
  page: '--page',
  pageAlt: '--page-alt',
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  surfacePressed: '--surface-pressed',
  rail: '--rail',
  hairline: '--hairline',
  text: '--text',
  text2: '--text-2',
  text3: '--text-3',
  accent: '--accent',
  accentSoft: '--accent-soft',
};

const palette = JSON.parse(readFileSync(SOURCE, 'utf8'));

/** `rgba(r,g,b,a)` for the accent at its soft alpha, so it tints whatever it sits on. */
function softAccent(entry) {
  const hex = entry.accents.primary;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${entry.accentSoftAlpha})`;
}

function block(entry, indent) {
  const pad = ' '.repeat(indent);
  const [rest, raised, pressed] = entry.surfaces;
  const [primary, secondary, tertiary] = entry.text;
  const rows = [
    [NAMES.page, entry.page],
    [NAMES.pageAlt, entry.pageAlt],
    [NAMES.surface, rest],
    [NAMES.surfaceRaised, raised],
    [NAMES.surfacePressed, pressed],
    [NAMES.rail, entry.rail],
    [NAMES.hairline, entry.hairline],
    [NAMES.text, primary],
    [NAMES.text2, secondary],
    [NAMES.text3, tertiary],
    [NAMES.accent, entry.accents.primary],
    [NAMES.accentSoft, softAccent(entry)],
  ];
  return rows.map(([name, value]) => `${pad}${name}: ${value};`).join('\n');
}

/** The colour the browser chrome is told to paint, per mode. Never one static value. */
const chrome = (entry) => entry.page;

const generated = `/* tokens.css — GENERATED by tools/palette.mjs from palettes/solve-ent.json.
 * Do not edit here; edit the palette and regenerate.
 *
 * The family is Instrument, the hub's recommended default (PALETTES.md §5),
 * adopted rather than invented. The palette file is the ONE source: the hub's
 * palette-check.mjs measures that file against the hard floors, and this writes
 * these values from the same file, so what was measured and what is painted
 * cannot differ.
 *
 * Night is the default because a token needs a value outside every media query
 * and every attribute selector. Day then arrives three ways, and all three are
 * load-bearing: the system asking for light with nothing stored, an explicit
 * day beating a system set to dark, and an explicit night beating a system set
 * to light. The last is the one that gets dropped.
 *
 * Regenerate: node tools/palette.mjs
 * Check: node tools/palette.mjs --check   (runs on every commit)
 */

:root {
  color-scheme: dark light;

${block(palette[NIGHT], 2)}

  /* Chrome painted per mode by the same inline script that sets data-theme;
   * a static theme-color leaves the status bar wrong in the other mode. */
  --chrome: ${chrome(palette[NIGHT])};
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme='night']) {
${block(palette[DAY], 4)}
    --chrome: ${chrome(palette[DAY])};
  }
}

:root[data-theme='day'] {
${block(palette[DAY], 2)}
  --chrome: ${chrome(palette[DAY])};
}

:root[data-theme='night'] {
${block(palette[NIGHT], 2)}
  --chrome: ${chrome(palette[NIGHT])};
}
`;

/**
 * The four cascade cases, ASSERTED against the generated text.
 *
 * **This was printed as `ok` before it was checked**, and the gap was found the
 * only way a printed claim ever is: the explicit-night block was deleted from
 * the generator during a plant, the drift check went green — because it
 * regenerates from the same generator and compares like with like — and the run
 * cheerfully reported that night beats a system set to light while the rule
 * saying so was not in the file.
 *
 * A drift check is structurally incapable of catching a wrong GENERATOR; it can
 * only catch a wrong artefact. So the properties that matter are read off the
 * output text, where a generator that stops emitting one of them fails.
 */
function cascade(css) {
  const wanted = [
    [/^:root \{/m, 'a default block outside every query, so every token has a value'],
    [/@media \(prefers-color-scheme: light\)[\s\S]*?:root:not\(\[data-theme='night'\]\)/m,
      'the system asking for light, with nothing stored'],
    [/^:root\[data-theme='day'\] \{/m, 'an explicit day, beating a system set to dark'],
    [/^:root\[data-theme='night'\] \{/m, 'an explicit night, beating a system set to light'],
  ];
  return wanted.filter(([pattern]) => !pattern.test(css)).map(([, why]) => why);
}

/* ---- the palette must have passed the hub's gate ---- */
/**
 * Does the gates workflow hand the floors to the hub's own job?
 *
 * NOT A SKIP, AND NOT A FLAG. CI stopped checking the hub out into `.hub` when
 * the shared gates became a CALL rather than a copy, so this file could no
 * longer run the hub's palette gate itself on a runner. The floors are still
 * measured there — `palette-path:` makes hub-gates.yml run exactly this gate on
 * exactly this file, from the hub at the pinned commit — but that happens in a
 * different job and nothing in this process can see it.
 *
 * So this reads the workflow and requires POSITIVE EVIDENCE: the call must be
 * present, pinned to a commit, and naming THIS palette file. Absent, unpinned,
 * or naming something else and the answer is no, and the check fails exactly as
 * it did when the hub was missing. The failure this refuses to become is the
 * one its own comment names: a colour reaching a screen unmeasured.
 */
function floorsRunInTheHubJob() {
  let workflow;
  try {
    workflow = readFileSync(join(REPO, '.github/workflows/gates.yml'), 'utf8');
  } catch {
    return false;
  }
  const call = /uses:\s*njefferson\/noahjefferson\/\.github\/workflows\/hub-gates\.yml@[0-9a-f]{40}([\s\S]*?)(?=\n  \w|\n\S|$)/.exec(workflow);
  if (!call) return false;
  const declared = /^\s*palette-path:\s*(\S+)\s*$/m.exec(call[1])?.[1];
  return declared === 'palettes/solve-ent.json';
}

function measured() {
  if (HUB_GATE === null && floorsRunInTheHubJob()) {
    return { ok: true, worst: null, elsewhere: true };
  }
  if (HUB_GATE === null) {
    // NOT A SKIP. The hub absent means this could not be measured, and a colour
    // reaching a screen unmeasured is the whole failure.
    return {
      ok: false,
      why:
        'the hub is checked out at neither .hub nor ../noahjefferson, so the palette\n' +
        '  could not be measured against the shared floors. It is not skipped: a colour\n' +
        '  reaching a screen unmeasured is the whole thing this exists to prevent.\n' +
        '  Check njefferson/noahjefferson out beside this repository — every session here\n' +
        '  needs it anyway, for doctrine-sync and the shared gates. On a runner the\n' +
        '  floors are measured by the hub-gates job instead, which requires\n' +
        '  `palette-path: palettes/solve-ent.json` on the call in gates.yml.',
    };
  }
  const run = spawnSync(process.execPath, [HUB_GATE, SOURCE], { encoding: 'utf8' });
  if (run.status !== 0) return { ok: false, why: (run.stdout || '') + (run.stderr || '') };
  const worst = [...(run.stdout || '').matchAll(/worst text ([\d.]+)/g)].map((m) => Number(m[1]));
  return { ok: true, worst: worst.length > 0 ? Math.min(...worst) : null };
}

const gate = measured();

if (process.argv.includes('--check')) {
  const failures = [];
  if (!gate.ok) failures.push(`the palette has not cleared the hub's floors:\n${gate.why}`);

  let current = null;
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    failures.push('public/css/tokens.css is missing. Run: node tools/palette.mjs');
  }
  for (const missingCase of cascade(generated)) {
    failures.push(`the generated CSS has no rule for: ${missingCase}`);
  }
  if (current !== null && current !== generated) {
    failures.push(
      'public/css/tokens.css has drifted from palettes/solve-ent.json.\n' +
        'The colours are generated from one source so the values the gate measured and\n' +
        'the values a browser paints cannot be different values. Run: node tools/palette.mjs',
    );
  }

  console.log('\n=== the palette · Solve-ent ===\n');
  if (failures.length === 0) {
    if (gate.elsewhere) {
      console.log('  ok    palettes/solve-ent.json is measured against the hard floors by the');
      console.log("        hub-gates job, which runs the hub's palette gate on this exact file");
      console.log('        at the commit gates.yml pins. Not measured in THIS process, and not');
      console.log('        skipped: the call and its palette-path were read out of the workflow.');
    } else {
      console.log(`  ok    palettes/solve-ent.json clears every hard floor (worst text ${gate.worst})`);
      console.log(`  ok    measured by ${relative(REPO, HUB_GATE)}, the hub's canonical gate`);
    }
    console.log('  ok    public/css/tokens.css matches the palette it was generated from');
    console.log('  ok    all four cascade cases present, read off the generated text');
    console.log('\nOne source, so what was measured and what is painted are the same values.\n');
    process.exit(0);
  }
  for (const failure of failures) console.log(`  FAIL  ${failure}`);
  process.exit(1);
}

if (!gate.ok) {
  console.error(`\nRefusing to write colours that have not been measured.\n\n${gate.why}\n`);
  process.exit(1);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, generated);
console.log(`wrote public/css/tokens.css — Instrument, two modes, worst text ${gate.worst}`);
