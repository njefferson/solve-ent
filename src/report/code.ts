/**
 * code.ts — the completion code, and reading one back.
 *
 * ## What it is for
 *
 * A student finishes an assigned set on a device that has no account, no
 * network and nothing to submit to. The code is how the result travels: they
 * write down sixteen characters, and whoever set the work reads them back.
 *
 * ## What it carries, and what it CANNOT
 *
 * A roster number, how many steps were attempted, how many were right first
 * time, how many went wrong per SKILL, and how long it took. That is the whole
 * payload and the type says so.
 *
 * **There is no field for an accommodation and there must never be one.** Text
 * size, spacing, one-step-at-a-time and read-aloud are disability information;
 * a code carrying one would make a student disclose it by handing the code in,
 * over a channel they cannot opt out of. Omitting it at the encoder would be a
 * rule somebody has to remember. Having nowhere to put it is a rule that holds.
 *
 * There is no name, no device id and no answer the student typed. The roster
 * number is the only identity this application has anywhere.
 *
 * ## The check digits are a TYPO DETECTOR, not a signature
 *
 * **Say this plainly wherever it is shown.** The check covers the payload and
 * the WHOLE ASSIGNMENT together — its key, its topic and its difficulty — so a
 * mistyped character fails, and so does a code from a different set, a
 * different topic, or an easier difficulty than the one that was set. That last
 * one is why the topic and the difficulty are in the binding rather than in the
 * payload: it costs no bits, and a code that did not say which questions were
 * worked would be a code that meant very little.
 *
 * It cannot stop a determined student who reads the source of a static site —
 * there is no server and therefore no secret, and an application that implied
 * otherwise would be lying about what it can do.
 *
 * What it is good for is the thing that actually happens in a room: a code
 * copied wrong, a digit transposed, or last week's code handed in again.
 *
 * ## Why Crockford's alphabet
 *
 * It is written on paper by hand and read back by somebody else. `I`, `L`, `O`
 * and `U` are not in it, and `I`/`L` decode as `1` and `O` as `0`, so the three
 * confusions that actually happen resolve to the right thing instead of
 * failing. Case is ignored.
 */

import { hashString } from '../engine/rng.ts';
import type { Topic } from '../engine/problem.ts';
import { COUNTER_SKILLS, type CounterSkill } from '../engine/taxonomy.ts';

/** Crockford base32: no I, L, O or U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** How many characters a code is, and how they are grouped when written down. */
export const CODE_LENGTH = 16;
const GROUP = 4;

/**
 * The layout, smallest field first. Changing ANY width changes what old codes
 * mean, which is what `VERSION` is for: a code carrying a version this build
 * does not know is refused rather than read with the wrong ruler.
 */
const VERSION = 1;
const VERSION_BITS = 4;
const ROSTER_BITS = 12;
const ATTEMPTED_BITS = 8;
const RIGHT_BITS = 8;
const SKILL_BITS = 3;
const MINUTES_BITS = 6;
const CHECK_BITS = 24;

/** The largest each field can say. Beyond it, a field SATURATES and says so. */
export const CODE_LIMITS = {
  roster: (1 << ROSTER_BITS) - 1,
  attempted: (1 << ATTEMPTED_BITS) - 1,
  rightFirstTime: (1 << RIGHT_BITS) - 1,
  perSkill: (1 << SKILL_BITS) - 1,
  minutes: (1 << MINUTES_BITS) - 1,
} as const;

/** What a code says, once it has been read back. */
export interface CodeContents {
  readonly rosterNumber: number;
  readonly attempted: number;
  readonly rightFirstTime: number;
  readonly wrongBySkill: { readonly [K in CounterSkill]: number };
  readonly minutes: number;
  /**
   * Which fields hit their ceiling. A saturated field is a FLOOR on the truth —
   * "seven or more" — and whoever reads it has to be told that rather than
   * shown a number that looks exact.
   */
  readonly atLimit: readonly string[];
}

/** Why a code could not be read. Never "invalid" on its own — it says which. */
export type CodeProblem =
  | 'EMPTY'
  | 'LENGTH'
  | 'CHARACTER'
  | 'CHECK'
  | 'VERSION';

export type CodeReading =
  | { readonly kind: 'read'; readonly contents: CodeContents }
  | { readonly kind: 'unreadable'; readonly why: CodeProblem };

const clamp = (value: number, ceiling: number): number =>
  !Number.isFinite(value) || value < 0 ? 0 : Math.min(Math.floor(value), ceiling);

/**
 * The check digits.
 *
 * OVER THE PAYLOAD AND THE KEY TOGETHER, which is what makes a code from
 * another set fail against this one. `hashString` is FNV — a mixer, not a
 * cryptographic hash, and the header says why that is the honest choice here
 * rather than an oversight.
 */
function checkOf(payload: bigint, assignment: Assignment): bigint {
  const bound = `${assignment.key}|${assignment.topic}|${String(assignment.tier)}`;
  const mixed = hashString(`${payload.toString(32)}|${bound}`);
  return BigInt(mixed) & ((1n << BigInt(CHECK_BITS)) - 1n);
}

/**
 * What a code is bound to: the set as it was actually given out.
 *
 * NOT CARRIED IN THE CODE, and that is the point — it is what the code is
 * CHECKED against, so whoever set the work supplies it from what they set. A
 * code read against a different topic or a lower difficulty does not read at
 * all.
 */
export interface Assignment {
  readonly key: string;
  readonly topic: Topic;
  readonly tier: number;
}

/** What goes into a code. Deliberately not `CompletionCounts` — see below. */
export interface CodeInput {
  readonly rosterNumber: number;
  readonly attempted: number;
  readonly rightFirstTime: number;
  readonly wrongBySkill: { readonly [K in CounterSkill]: number };
  readonly elapsedMs: number;
}

/**
 * Write a completion code.
 *
 * PRECONDITION: none — every field is clamped into its width rather than
 * throwing, because a run that went long is still a run somebody finished and
 * refusing to give them a code at the end of it would be the worst possible
 * moment to be strict. What saturation costs is precision, and `atLimit` on the
 * way back out is what stops that being silent.
 */
export function writeCode(input: CodeInput, assignment: Assignment): string {
  let payload = 0n;
  const push = (value: number, bits: number): void => {
    payload = (payload << BigInt(bits)) | BigInt(value & ((1 << bits) - 1));
  };

  push(VERSION, VERSION_BITS);
  push(clamp(input.rosterNumber, CODE_LIMITS.roster), ROSTER_BITS);
  push(clamp(input.attempted, CODE_LIMITS.attempted), ATTEMPTED_BITS);
  push(clamp(input.rightFirstTime, CODE_LIMITS.rightFirstTime), RIGHT_BITS);
  // ORDERED BY `COUNTER_SKILLS`, which is the one list of them. A second order
  // written here would be a second definition of which skill is which.
  for (const skill of COUNTER_SKILLS) {
    push(clamp(input.wrongBySkill[skill], CODE_LIMITS.perSkill), SKILL_BITS);
  }
  push(clamp(input.elapsedMs / 60_000, CODE_LIMITS.minutes), MINUTES_BITS);

  const whole = (payload << BigInt(CHECK_BITS)) | checkOf(payload, assignment);
  let out = '';
  for (let i = CODE_LENGTH - 1; i >= 0; i -= 1) {
    const digit = Number((whole >> BigInt(i * 5)) & 31n);
    out += ALPHABET[digit] ?? '0';
  }
  return out;
}

/** Group a code the way somebody writes it down. */
export const groupCode = (code: string): string =>
  (code.match(new RegExp(`.{1,${String(GROUP)}}`, 'g')) ?? []).join('-');

/**
 * Read a code back.
 *
 * PRECONDITION: none. Anything a person can type arrives here — hyphens,
 * spaces, lower case, and the three characters Crockford's alphabet leaves out
 * because a hand writes them like digits.
 */
export function readCode(text: string, assignment: Assignment): CodeReading {
  const cleaned = text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (cleaned === '') return { kind: 'unreadable', why: 'EMPTY' };
  if (cleaned.length !== CODE_LENGTH) return { kind: 'unreadable', why: 'LENGTH' };

  let whole = 0n;
  for (const character of cleaned) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) return { kind: 'unreadable', why: 'CHARACTER' };
    whole = (whole << 5n) | BigInt(digit);
  }

  const mask = (1n << BigInt(CHECK_BITS)) - 1n;
  const payload = whole >> BigInt(CHECK_BITS);
  if ((whole & mask) !== checkOf(payload, assignment)) {
    return { kind: 'unreadable', why: 'CHECK' };
  }

  // READ BACK IN THE ORDER IT WAS WRITTEN, from the bottom up.
  let rest = payload;
  const take = (bits: number): number => {
    const value = Number(rest & ((1n << BigInt(bits)) - 1n));
    rest >>= BigInt(bits);
    return value;
  };
  const minutes = take(MINUTES_BITS);
  const wrongBySkill: Record<string, number> = {};
  for (const skill of [...COUNTER_SKILLS].reverse()) wrongBySkill[skill] = take(SKILL_BITS);
  const rightFirstTime = take(RIGHT_BITS);
  const attempted = take(ATTEMPTED_BITS);
  const rosterNumber = take(ROSTER_BITS);
  const version = take(VERSION_BITS);
  if (version !== VERSION) return { kind: 'unreadable', why: 'VERSION' };

  const atLimit: string[] = [];
  if (attempted === CODE_LIMITS.attempted) atLimit.push('steps');
  if (rightFirstTime === CODE_LIMITS.rightFirstTime) atLimit.push('right first time');
  if (minutes === CODE_LIMITS.minutes) atLimit.push('minutes');
  for (const skill of COUNTER_SKILLS) {
    if (wrongBySkill[skill] === CODE_LIMITS.perSkill) atLimit.push(skill);
  }

  return {
    kind: 'read',
    contents: {
      rosterNumber,
      attempted,
      rightFirstTime,
      wrongBySkill: wrongBySkill as { [K in CounterSkill]: number },
      minutes,
      atLimit,
    },
  };
}
