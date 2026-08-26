/**
 * blocked.ts — one move, again, until it is yours.
 *
 * ## Why this is its own thing rather than a mode of a session
 *
 * A whole problem is INTERLEAVED practice, which is what makes a skill stick
 * once you have it. **A skill you do not have yet is built by BLOCKED
 * practice** — the same move again. An app with only whole problems makes the
 * student who inverts a ratio walk five steps they can already do to reach the
 * one they cannot, five times over.
 *
 * ## It costs almost nothing, and that is a property rather than luck
 *
 * `classify` is a pure function of (problem, stage, entry). So a drill is a
 * loop around it: **no `Session`, no completion code, nothing recorded, no
 * clock.** Nothing here can produce something to hand in, because there is
 * nothing here that accumulates. That purity is load-bearing now rather than a
 * testing convenience, and it is why this file is forty lines instead of four
 * hundred.
 *
 * ## Deterministic, like everything else
 *
 * An item is a pure function of (skill, key, index), so two people working from
 * the same key get the same drill in the same order — the same property that
 * lets one thing written on a board produce one set of problems.
 */

import { TOPIC_NAMES, generateProblem, laddersFor, type Problem, type Topic } from './problem.ts';
import { hashString } from './rng.ts';
import { stagesFor, type CounterSkill, type Stage } from './taxonomy.ts';

/** One thing to answer: a problem for context, and the single step being drilled. */
export interface DrillItem {
  readonly problem: Problem;
  /** The stage whose counter is the skill being drilled. Never the whole problem. */
  readonly stage: Stage;
}

/** A place a move can be found: a difficulty and a topic. */
interface Place {
  readonly tier: number;
  readonly topic: Topic;
}

/**
 * Difficulties to look through, easiest first.
 *
 * **NOT a single tier, and that was a real defect rather than a refinement.**
 * This was `const DRILL_TIER = 1` — the move on its own rather than the move
 * plus a hard number, which is the right instinct resting on an assumption that
 * turned out to be false: that every move exists at the easiest difficulty.
 *
 * `REARRANGE` does not. Its stage asks for a value AFTER the rearrangement and
 * exists only where the relation has two or more factors to shift — which is
 * 8% of tier-3 rearrangement problems and nothing else at all. So a drill on
 * **isolating the unknown**, the move this application is most about, could not
 * be built.
 */
const DRILL_TIERS = [1, 2, 3];

const TOPICS = Object.keys(TOPIC_NAMES) as Topic[];

/**
 * How hard to look, per place, when learning where a move lives.
 *
 * `REARRANGE` turns up in about one tier-3 rearrangement problem in twelve, so
 * a probe has to be generous or a real place reads as an empty one. At forty,
 * missing it would take a run of forty consecutive misses at p=0.92 — about
 * three chances in a thousand — and the test asserts all six are found.
 */
const PROBE_ATTEMPTS = 40;

/**
 * How hard to look for an ITEM once the places are known.
 *
 * Generous, because it is now looking somewhere the move is known to occur: at
 * one in twelve, two hundred attempts fail about six times in a hundred
 * million. Blind searching was the first version and it is why this exists —
 * a topic picked at random per attempt spent six sevenths of every search on
 * topics that could never carry the move, and produced an item fourteen times
 * out of twenty. A drill that works two thirds of the time is not a drill.
 */
const ITEM_ATTEMPTS = 200;

/**
 * Where each move lives, LEARNED ONCE rather than declared.
 *
 * A hand-written table would say what somebody believed when they wrote it, and
 * would go quietly wrong the first time a stage moved. This asks the generator.
 *
 * BOUNDED BY CONSTRUCTION: six skills, each holding at most twenty-one places.
 * That matters here — an unbounded module-level map in this same engine grew to
 * 2.8 MB over two thousand problems and was invisible until something looped the
 * generator, which is precisely what a drill does.
 *
 * `drillItem` stays a pure function of its arguments: this caches the result of
 * a deterministic computation, and clearing it would change nothing but speed.
 */
const PLACES = new Map<CounterSkill, Place[]>();

function placesFor(skill: CounterSkill): Place[] {
  const known = PLACES.get(skill);
  if (known !== undefined) return known;
  const found: Place[] = [];
  for (const tier of DRILL_TIERS) {
    for (const topic of TOPICS) {
      // ONLY WHERE THE TOPIC HAS ONE. Difficulty is per topic — `PROPORTION`
      // poses one and `FRACTIONS` two — and `generateProblem` refuses a tier a
      // topic does not declare rather than quietly handing back tier 1.
      if (!laddersFor(topic).some((difficulty) => difficulty.tier === tier)) continue;
      for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
        const problem = generateProblem(`probe|${skill}|${topic}|${String(tier)}`, topic, tier, attempt);
        if (stagesFor(problem).some((stage) => stage.counter === skill)) {
          found.push({ tier, topic });
          break;
        }
      }
    }
  }
  PLACES.set(skill, found);
  return found;
}

/**
 * The item at `index` of a drill on `skill`, or null where the move cannot be posed.
 *
 * Deterministic: a pure function of (skill, key, index), so two people working
 * from the same key get the same drill in the same order — the same property
 * that lets one thing written on a board produce one set of problems.
 *
 * PRECONDITION: none. Null is a fact worth reporting rather than a loop worth
 * running forever.
 */
export function drillItem(skill: CounterSkill, key: string, index: number): DrillItem | null {
  const places = placesFor(skill);
  if (places.length === 0) return null;
  for (let attempt = 0; attempt < ITEM_ATTEMPTS; attempt += 1) {
    // Easiest first, and rotating through the places a move actually occurs in,
    // so a drill varies its topic without ever looking where the move is not.
    const seed = `${key}|${skill}|${String(index)}|${String(attempt)}`;
    const place = places[(hashString(seed) + attempt) % places.length];
    if (place === undefined) continue;
    const problem = generateProblem(seed, place.topic, place.tier, attempt);
    const stage = stagesFor(problem).find((candidate) => candidate.counter === skill);
    if (stage !== undefined) return { problem, stage };
  }
  return null;
}

/**
 * Which skills a drill can be built for, MEASURED rather than declared.
 *
 * Used by the test that holds all six reachable. The screen offers all six
 * unconditionally: a move quietly missing from a menu is worse than a loud
 * failure at build time.
 */
export function drillableSkills(skills: readonly CounterSkill[], key: string): CounterSkill[] {
  return skills.filter((skill) => drillItem(skill, key, 0) !== null);
}
