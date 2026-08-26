/**
 * tiers.test.ts — a tier that produces the same questions as the tier below is
 * not a tier.
 *
 * ## Why this exists
 *
 * `TIERS` has been `[1, 2, 3]` since the first release, and every screen opened
 * at tier 1, so nothing ever posed the other two to a reader. The moment a
 * difficulty picker was considered, the first question was whether the choice
 * would change anything somebody could tell — and in five of seven topics it
 * did not.
 *
 * **This is the collision rule one level up.** The taxonomy refuses to pose a
 * question where two misconceptions predict answers a reader could not tell
 * apart. Offering three difficulties that produce indistinguishable questions is
 * the same failure wearing different clothes: a control that does nothing, which
 * is worse than a control that is missing, because its presence answers "is
 * difficulty handled here" for everybody afterwards.
 *
 * ## The measure is UNIFORM, on purpose
 *
 * No topic gets a probe chosen for it. A per-topic signal is a signal somebody
 * can tune until the answer comes out right — hub LESSONS §141, where a check
 * derived its population from the fix it enforced.
 *
 * Two signals, and a tier passes on either:
 *
 * **New shapes.** The share of a tier's structural signatures — its stage list,
 * how many parts it has, how precisely the answer is asked — that the tier below
 * never produces. This catches a tier that unlocks harder TEMPLATES.
 *
 * **A shifted signal.** The relative change in a uniform measure: stage count,
 * part count, answer precision, and the size of the numbers, where size is read
 * from EXPONENTS as well as mantissas — without that, scientific notation reads
 * as flat when its tiers genuinely run 7.6 to 21.5.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LADDERS, TOPICS, generateProblem, laddersFor, type Problem, type Topic } from '../src/engine/problem.ts';
import { stagesFor } from '../src/engine/taxonomy.ts';

/** How many problems to look at per topic and tier. */
const SAMPLE = 300;

/**
 * How much a tier must add over the one below, on at least one signal.
 *
 * 12%, which sits well under the real separations (43% and 50% on part count
 * where a tier genuinely adds a factor or a link) and well above the noise
 * between two tiers that differ in nothing (1–3%).
 */
const FLOOR = 0.12;

/** Every array field's length. Catches links, operands and stated values without naming them. */
const parts = (problem: Problem): number =>
  Object.values(problem).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);

/**
 * How big the numbers are, in orders of magnitude.
 *
 * EXPONENT FIELDS COUNT. Scientific notation states a small mantissa and a large
 * exponent, so reading the literal numbers makes its hardest tier look like its
 * easiest. This adds any field whose name ends in "exponent" back in.
 */
const size = (problem: Problem): number => {
  const record = problem as unknown as Record<string, unknown>;
  let exponents = 0;
  for (const [key, value] of Object.entries(record)) {
    if (/exponent$/i.test(key) && typeof value === 'number') exponents += Math.abs(value);
  }
  const literals = (JSON.stringify(problem).match(/-?\d+\.?\d*/g) ?? [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n !== 0)
    .map(Math.abs);
  const biggest = literals.length > 0 ? Math.max(...literals) : 1;
  return Math.log10(biggest) + exponents;
};

const SIGNALS: Readonly<Record<string, (problem: Problem) => number>> = {
  stages: (problem) => stagesFor(problem).length,
  parts,
  figures: (problem) => problem.answerSigFigs,
  size,
};

/** The structural shape of a problem, with no numbers in it. */
const shape = (problem: Problem): string =>
  `${stagesFor(problem)
    .map((stage) => stage.id)
    .join('/')}|${String(parts(problem))}|${String(problem.answerSigFigs)}`;

interface Sample {
  readonly shapes: Set<string>;
  readonly means: Readonly<Record<string, number>>;
}

function sample(topic: Topic, tier: number): Sample {
  const problems: Problem[] = [];
  for (let i = 0; i < SAMPLE; i += 1) problems.push(generateProblem('tiers', topic, tier, i));
  const means: Record<string, number> = {};
  for (const [name, signal] of Object.entries(SIGNALS)) {
    means[name] = problems.reduce((total, problem) => total + signal(problem), 0) / problems.length;
  }
  return { shapes: new Set(problems.map(shape)), means };
}

/** How much `hi` adds over `lo`: new shapes, and the largest shifted signal. */
function separation(hi: Sample, lo: Sample): { novel: number; shift: number; on: string } {
  const novel = [...hi.shapes].filter((s) => !lo.shapes.has(s)).length / hi.shapes.size;
  let shift = 0;
  let on = 'none';
  for (const name of Object.keys(SIGNALS)) {
    const before = lo.means[name] ?? 0;
    const after = hi.means[name] ?? 0;
    const relative = Math.abs(after - before) / Math.max(Math.abs(before), 0.001);
    if (relative > shift) {
      shift = relative;
      on = name;
    }
  }
  return { novel, shift, on };
}

test('every difficulty poses questions the one below it does not', () => {
  const failures: string[] = [];
  const report: string[] = [];

  for (const topic of TOPICS) {
    const ladder = laddersFor(topic);
    const samples = ladder.map((difficulty) => sample(topic, difficulty.tier));
    if (ladder.length === 1) {
      report.push(`    ${topic.padEnd(11)} one difficulty — ${(ladder[0] as { name: string }).name}`);
      continue;
    }
    for (let i = 1; i < ladder.length; i += 1) {
      const lo = samples[i - 1];
      const hi = samples[i];
      const below = ladder[i - 1];
      const here = ladder[i];
      if (lo === undefined || hi === undefined || below === undefined || here === undefined) continue;
      const { novel, shift, on } = separation(hi, lo);
      const passes = novel >= FLOOR || shift >= FLOOR;
      report.push(
        `    ${topic.padEnd(11)} ${String(below.tier)}->${String(here.tier)}  ` +
          `${(novel * 100).toFixed(0).padStart(3)}% new shapes, ` +
          `${(shift * 100).toFixed(0).padStart(3)}% more ${on.padEnd(7)} ${passes ? '' : '  <-- adds nothing'}`,
      );
      if (!passes) {
        failures.push(
          `${topic} "${here.name}" poses what "${below.name}" already poses ` +
            `(${(novel * 100).toFixed(0)}% new shapes, ${(shift * 100).toFixed(0)}% on ${on})`,
        );
      }
    }
  }

  console.log('\n  DIFFICULTY SEPARATION, by topic:\n' + report.join('\n') + '\n');
  assert.deepEqual(
    failures,
    [],
    `\n  ${failures.join('\n  ')}\n\n  A difficulty a reader cannot tell from another one is a control that does\n` +
      '  nothing, and its presence answers "is difficulty handled here" for everybody after.\n',
  );
});

/**
 * The ladders themselves, before anything is measured about them.
 *
 * A tier that is declared and cannot be generated is the same defect as a tier
 * that adds nothing, arriving later: the picker offers it, the reader chooses
 * it, and the run does not start.
 */
test('every declared difficulty is contiguous, named once, and generates', () => {
  const names = new Set<string>();
  for (const topic of TOPICS) {
    const ladder = LADDERS[topic];
    assert.ok(ladder.length > 0, `${topic} declares no difficulty at all`);
    ladder.forEach((difficulty, i) => {
      assert.equal(
        difficulty.tier,
        i + 1,
        `${topic} declares tier ${String(difficulty.tier)} in position ${String(i + 1)} — ` +
          'tiers are contiguous from 1, so a gap means one was removed and the rest left where they were',
      );
      const key = `${topic}|${difficulty.name}`;
      assert.ok(!names.has(key), `${topic} names two difficulties "${difficulty.name}"`);
      names.add(key);
      assert.doesNotThrow(
        () => generateProblem('ladder', topic, difficulty.tier, 0),
        `${topic} declares "${difficulty.name}" and cannot generate it`,
      );
    });
  }
});

/** A tier a topic does not declare is refused rather than quietly clamped. */
test('an undeclared difficulty is refused', () => {
  assert.throws(
    () => generateProblem('ladder', 'PROPORTION', 2, 0),
    /no tier 2/,
    'PROPORTION has one difficulty; asking for a second must not hand back the first',
  );
});
