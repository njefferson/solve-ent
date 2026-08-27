/**
 * drill.ts — what the app says about a run, and when.
 *
 * NO SCORE, NO STREAK, NO TARGET, NO CONGRATULATION. Streaks and badges teach a
 * student to chase the animation and make stopping feel like failing, and that
 * is exactly wrong for the person who most needs to do twenty of these — who is
 * usually the one who has been told longest that they are bad at it.
 *
 * WHAT REPLACES PRAISE IS CHANGE. A good tutor does not read out a fraction.
 * They say *that went upside down again, here is why*, and at the end *you were
 * getting these wrong the same way and now you are not*. So this reports what
 * happened, and reports that a repeated mistake stopped ONLY where that is
 * true.
 *
 * THE TYPES ARE THE RULE. {@link DrillOutcome} has no field for a count, a
 * total, a fraction or a score, and there must never be one. Omitting a number
 * from the rendering would be a rule to remember; having nowhere to put it is a
 * rule that holds — the same argument as the missing accommodation field on a
 * `Session`. `tools/copy-check.mjs` covers the words; this covers the shape.
 *
 * THE CADENCE, EXACTLY:
 *   once   — not a pattern, and never named.
 *   twice  — goes in the closing summary.
 *   three  — said DURING the run, once, with what fixes it, and never again.
 *
 * PURE. No I/O, no globals, no clock. A drill is a loop around this and the
 * classifier: no session, no code, nothing recorded.
 */

import {
  CLASS_MEANINGS,
  REMEDIES,
  remediesFor,
  type CounterSkill,
  type ErrorClass,
} from '../engine/taxonomy.ts';

/** One attempt in a run, as the classifier described it. */
export interface Attempt {
  /** Which skill the step was asking for. */
  readonly skill: CounterSkill;
  /** The class, or null where the attempt was right. */
  readonly errorClass: ErrorClass | null;
}

/** Something said while the run is still going. */
export interface DrillNote {
  /** The attempt it is said after — a zero-based index into the run. */
  readonly afterAttempt: number;
  readonly errorClass: ErrorClass;
  readonly text: string;
}

/** Everything the app says about a run. No counts, by construction. */
export interface DrillOutcome {
  readonly notes: readonly DrillNote[];
  readonly closing: readonly string[];
}

/**
 * How many times a mistake has to be made before it is named during the run.
 *
 * Once is not a pattern. Naming it teaches somebody that every slip is a
 * diagnosis, which is the opposite of what an attribution app is for.
 */
export const NAME_DURING_RUN_AT = 3;

/** And how many before it is worth mentioning at the end at all. */
export const NAME_IN_CLOSING_AT = 2;

/**
 * How many later attempts at the same skill, all free of a mistake, before the
 * app will say that mistake stopped.
 *
 * THE HONESTY THRESHOLD, and the reason it is not one. One clean attempt after
 * a run of wrong ones is as likely to be a guess as a change, and *you were
 * getting these wrong the same way and now you are not* is a claim about a
 * person that has to be earned. Two is the smallest number that is not a
 * coincidence, and it is stated here rather than chosen inside a condition.
 */
export const STOPPED_AFTER_CLEAN = 2;

/**
 * What to DO about a mistake, in words, with no number in it.
 *
 * THE `how`, NOT THE `name`. These sentences used to read "What fixes it is
 * undoing an operation on both sides to get one letter on its own" — which
 * names the topic the mistake belongs to and leaves the reader holding it.
 */
function whatFixesIt(errorClass: ErrorClass): string {
  const remedies = remediesFor(errorClass, null);
  const first = remedies[0];
  return first === undefined ? '' : REMEDIES[first].how;
}

/**
 * Read a run and say what the app says about it.
 *
 * PRECONDITION: `attempts` is in the order they were made. A correct attempt
 * carries a null class.
 *
 * Reads the run ONCE, forwards, because that is the order the notes are said
 * in — a second pass computing the closing from a different traversal is two
 * readings of one run, and they come to disagree.
 */
export function readRun(attempts: readonly Attempt[]): DrillOutcome {
  const notes: DrillNote[] = [];
  const seen = new Map<ErrorClass, number>();
  const named = new Set<ErrorClass>();
  /** Where each class was last made, and how many clean attempts at that skill since. */
  const lastAt = new Map<ErrorClass, number>();
  const skillOf = new Map<ErrorClass, CounterSkill>();

  attempts.forEach((attempt, index) => {
    if (attempt.errorClass === null) return;
    const errorClass = attempt.errorClass;
    // E-ARITH is a slip with the right method and E-UNCLASSIFIED means the app
    // cannot tell. Neither is a misconception, so neither is a pattern worth
    // naming — telling somebody they keep making a mistake the app could not
    // identify is telling them nothing they can act on.
    if (errorClass === 'E-ARITH' || errorClass === 'E-UNCLASSIFIED') return;

    const count = (seen.get(errorClass) ?? 0) + 1;
    seen.set(errorClass, count);
    lastAt.set(errorClass, index);
    skillOf.set(errorClass, attempt.skill);

    if (count === NAME_DURING_RUN_AT && !named.has(errorClass)) {
      named.add(errorClass);
      const fix = whatFixesIt(errorClass);
      notes.push({
        afterAttempt: index,
        errorClass,
        // ONCE, and never again. A second telling of the same thing is nagging,
        // and the reader already knows.
        text: `That is the third time this one has gone the same way — it ${CLASS_MEANINGS[errorClass]}.${
          fix === '' ? '' : ` ${fix}`
        }`,
      });
    }
  });

  return { notes, closing: closingFor(attempts, seen, lastAt, skillOf) };
}

/** True where a class was made, and then not made again for long enough to say so. */
function stopped(
  attempts: readonly Attempt[],
  errorClass: ErrorClass,
  lastIndex: number,
  skill: CounterSkill,
): boolean {
  let cleanSince = 0;
  for (let i = lastIndex + 1; i < attempts.length; i += 1) {
    const attempt = attempts[i] as Attempt;
    if (attempt.skill !== skill) continue;
    if (attempt.errorClass === errorClass) return false;
    cleanSince += 1;
  }
  return cleanSince >= STOPPED_AFTER_CLEAN;
}

function closingFor(
  attempts: readonly Attempt[],
  seen: ReadonlyMap<ErrorClass, number>,
  lastAt: ReadonlyMap<ErrorClass, number>,
  skillOf: ReadonlyMap<ErrorClass, CounterSkill>,
): string[] {
  const repeated = [...seen.entries()]
    .filter(([, count]) => count >= NAME_IN_CLOSING_AT)
    .sort((a, b) => b[1] - a[1])
    .map(([errorClass]) => errorClass);

  const nothingWentWrong = attempts.length > 0 && attempts.every((a) => a.errorClass === null);
  const nothingWentRight = attempts.length > 0 && attempts.every((a) => a.errorClass !== null);

  /* ---- the all-wrong case, written by hand ---- */
  //
  // The general sentence renders this as "four of them, and none right", which
  // is accurate and is the exact reading that person does not need. Every
  // generated sentence has a degenerate case; this is the one that matters,
  // so it is a branch rather than a template with a number in it.
  if (nothingWentRight) {
    const dominant = repeated[0];
    if (dominant !== undefined) {
      const fix = whatFixesIt(dominant);
      return [
        `Those all went the same way — each one ${CLASS_MEANINGS[dominant]}.`,
        `That is one move to fix, not a list of problems to redo.${fix === '' ? '' : ` ${fix}`}`,
      ];
    }
    const last = [...attempts]
      .reverse()
      .map((a) => a.errorClass)
      .find((errorClass): errorClass is ErrorClass => errorClass !== null);
    return last === undefined
      ? ['Those did not come out right. Worth going back to the worked example before the next one.']
      : [
          'Those did not come out right, and not the same way twice.',
          `The last one ${CLASS_MEANINGS[last]}. One at a time is the way back in.`,
        ];
  }

  const lines: string[] = [];

  /* ---- what repeated, and whether it stopped ---- */
  for (const errorClass of repeated) {
    const at = lastAt.get(errorClass);
    const skill = skillOf.get(errorClass);
    if (at === undefined || skill === undefined) continue;
    const fix = whatFixesIt(errorClass);
    if (stopped(attempts, errorClass, at, skill)) {
      // THE ONE SENTENCE THIS FILE EXISTS FOR, and it is said only where it is
      // true. Reporting a change that did not happen is worse than reporting
      // nothing, because it is the same shape as praise and it is a lie.
      lines.push(`You were getting these wrong the same way — each one ${CLASS_MEANINGS[errorClass]} — and then you were not.`);
    } else {
      lines.push(
        `This one kept happening: it ${CLASS_MEANINGS[errorClass]}.${fix === '' ? '' : ` ${fix}`}`,
      );
    }
  }

  if (lines.length === 0) {
    // Nothing repeated. There is nothing to report, and reporting nothing is
    // the right answer — a closing line that fires whatever happened is a
    // congratulation wearing a diagnosis's clothes.
    if (nothingWentWrong) return ['Nothing went wrong in those. Stop whenever you like.'];
    return ['Nothing in those went wrong the same way twice.'];
  }
  return lines;
}
