/**
 * taxonomy.ts — attributing a wrong number to a conceptual failure.
 *
 * THIS IS THE PRODUCT. Everything else in the repository exists so that this
 * file can say "the 0.0526 you typed is what you get when you multiply the
 * concentration by the exponent instead of raising it" rather than
 * "incorrect". Free tools already solve these and already explain the
 * procedure; none of them attribute a specific wrong number to a specific
 * misconception, and that is the whole of what is being built.
 *
 * HOW IT WORKS. For each gated stage the correct value is computed from the
 * problem's stated values, and so is a set of PREDICTED WRONG VALUES — one or
 * more per plausible misconception, each derived from the same stated values by
 * making that specific mistake. A student's entry is matched against that set
 * at the student's own stated precision. One match is a diagnosis. No match
 * falls back to an arithmetic slip if the entry is within an order of
 * magnitude, and to E-UNCLASSIFIED otherwise — which is COUNTED and reported,
 * because the unclassified rate is the number that says whether this file is
 * any good.
 *
 * TWO MATCHES IS A DEFECT, NOT A TIEBREAK. If a wrong value is consistent with
 * two classes then the decomposition is wrong, and the fix is to stop posing
 * that problem. Nothing here picks a winner: a tiebreak would mean guessing
 * which misconception a student holds, and a guess reported to a teacher as a
 * diagnosis is worse than saying nothing at all.
 *
 * WHAT MAY NEVER APPEAR HERE. A prediction's `why` names the MOVE and never
 * carries a number from the problem. MoleBridge shipped algebra help whose
 * worked line ended in the value the student was stuck on, and a one-figure
 * magnitude estimate that the grader then accepted — because no intermediate
 * stage grades figures. The rule that came out of it holds here from the
 * first commit: no text this file produces may contain a number that would be
 * marked correct at the stage it appears on. The `why` strings are constants
 * with no interpolation, which is the structural way to keep it rather than
 * the remembering way.
 *
 * PURE. No I/O, no globals, no clock.
 */

import {
  formatSigFigs,
  formatUnambiguous,
  magnitudeOf,
  parseQuantity,
  roundToSigFigs,
  SigFigError,
  type Quantity,
} from '../num/sigfig.ts';
import { flip, formatUnit, parseUnit, runChain, sameUnit, type UnitExpr } from '../num/units.ts';
import { hashString } from './rng.ts';
import {
  countSigFigs,
  indistinguishable,
  normalise,
  rearrangeParts,
  relationById,
  sameAtPrecision,
  solve,
  statedValues,
  type Problem,
  type Solution,
  type StatedValue,
} from './problem.ts';
import {
  DISTINGUISHABLE_RELATIVE,
  ORDER_OF_MAGNITUDE_LIMIT,
  SCINOT_TRIGGER_LOG10,
} from './tolerance.ts';

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every misconception this app can attribute, plus the one that means "we do
 * not know", which is counted rather than hidden.
 *
 * ADDING ONE IS A DECOMPOSITION DECISION, not a copywriting one. A class earns
 * its place by predicting a value the other classes do not — if it cannot, it
 * is not a separate misconception, it is another name for one already here.
 */
export type ErrorClass =
  /* rearranging a formula */
  | 'E-REARR-MULTIPLIED'
  | 'E-REARR-INVERTED'
  | 'E-REARR-PARTIAL'
  | 'E-REARR-SIGN'
  /* proportions */
  | 'E-PROP-INVERTED'
  | 'E-PROP-ADDED'
  | 'E-PROP-DROPPED'
  /* scientific notation */
  | 'E-SCI-EXP-OP'
  | 'E-SCI-EXP-SIGN'
  | 'E-SCI-MANTISSA-OP'
  | 'E-SCI-NORMALISE'
  /* powers and roots */
  | 'E-POW-MULTIPLIED'
  | 'E-POW-INVERTED'
  | 'E-POW-SWAPPED'
  | 'E-POW-COEFF'
  /* fractions and rates */
  | 'E-FRAC-INVERTED'
  | 'E-FRAC-RECIPROCAL'
  | 'E-FRAC-RATE-IGNORED'
  /* cancelling units */
  | 'E-UNIT-FACTOR-INVERTED'
  | 'E-UNIT-DROPPED'
  | 'E-UNIT-CHAIN-INVERTED'
  | 'E-UNIT-MISSING'
  | 'E-UNIT-WRONG'
  /* significant figures */
  | 'E-SIG-FIGURES'
  | 'E-SIG-WRONG-RULE'
  | 'E-SIG-COUNT-ZEROS'
  | 'E-SIG-ROUND-EARLY'
  /* the two that are not misconceptions */
  | 'E-ARITH'
  | 'E-UNCLASSIFIED';

/** Every class, for a test that insists each one has a fixture. */
export const ERROR_CLASSES: readonly ErrorClass[] = [
  'E-REARR-MULTIPLIED', 'E-REARR-INVERTED', 'E-REARR-PARTIAL', 'E-REARR-SIGN',
  'E-PROP-INVERTED', 'E-PROP-ADDED', 'E-PROP-DROPPED',
  'E-SCI-EXP-OP', 'E-SCI-EXP-SIGN', 'E-SCI-MANTISSA-OP', 'E-SCI-NORMALISE',
  'E-POW-MULTIPLIED', 'E-POW-INVERTED', 'E-POW-SWAPPED', 'E-POW-COEFF',
  'E-FRAC-INVERTED', 'E-FRAC-RECIPROCAL', 'E-FRAC-RATE-IGNORED',
  'E-UNIT-FACTOR-INVERTED', 'E-UNIT-DROPPED', 'E-UNIT-CHAIN-INVERTED',
  'E-UNIT-MISSING', 'E-UNIT-WRONG',
  'E-SIG-FIGURES', 'E-SIG-WRONG-RULE', 'E-SIG-COUNT-ZEROS', 'E-SIG-ROUND-EARLY',
  'E-ARITH', 'E-UNCLASSIFIED',
];

/**
 * What each class means, in the words a teacher would use.
 *
 * CONSTANTS, WITH NO INTERPOLATION. A sentence assembled from the problem's
 * numbers is a sentence that can carry the answer, and the stage it appears on
 * may be one where nothing grades figures — so an estimate leaked into a
 * remediation is an estimate the grader will then accept. Keeping these
 * numberless is structural rather than a thing to remember.
 */
export const CLASS_MEANINGS: { readonly [K in ErrorClass]: string } = {
  'E-REARR-MULTIPLIED': 'moved a factor across the equals sign by multiplying, where it had to be divided',
  'E-REARR-INVERTED': 'wrote the whole rearrangement upside down',
  'E-REARR-PARTIAL': 'divided by one of the factors and left the other where it was',
  'E-REARR-SIGN': 'moved the constant across the equals sign in the wrong direction',
  'E-PROP-INVERTED': 'used the ratio the wrong way up',
  'E-PROP-ADDED': 'added the difference between the two numbers instead of scaling by their ratio',
  'E-PROP-DROPPED': 'carried the amount straight through as though the ratio were one to one',
  'E-SCI-EXP-OP': 'multiplied the exponents instead of adding or subtracting them',
  'E-SCI-EXP-SIGN': 'combined the exponents in the wrong direction',
  'E-SCI-MANTISSA-OP': 'did to the front numbers what belongs to the exponents',
  'E-SCI-NORMALISE': 'moved the decimal point without moving the exponent to match',
  'E-POW-MULTIPLIED': 'treated the exponent as something to multiply by',
  'E-POW-INVERTED': 'took the power where the root was wanted, or the root where the power was',
  'E-POW-SWAPPED': 'raised the exponent to the base instead of the base to the exponent',
  'E-POW-COEFF': 'raised the coefficient as well as the thing the exponent belongs to',
  'E-FRAC-INVERTED': 'multiplied by the rate where it had to be divided by',
  'E-FRAC-RECIPROCAL': 'wrote the answer upside down',
  'E-FRAC-RATE-IGNORED': 'carried the amount through without using the rate at all',
  'E-UNIT-FACTOR-INVERTED': 'used one conversion factor upside down, so its unit did not cancel',
  'E-UNIT-DROPPED': 'left a link out of the chain',
  'E-UNIT-CHAIN-INVERTED': 'turned every factor upside down',
  'E-UNIT-MISSING': 'gave a number with no unit on it',
  'E-UNIT-WRONG': 'gave a unit that does not survive the cancelling',
  'E-SIG-FIGURES': 'has the right value written to the wrong number of significant figures',
  'E-SIG-WRONG-RULE': 'used the decimal-places rule where the significant-figures rule applies, or the other way round',
  'E-SIG-COUNT-ZEROS': 'counted zeros that are only holding the decimal point in place',
  'E-SIG-ROUND-EARLY': 'rounded on the way through instead of once at the end',
  'E-ARITH': 'has the right method and a slip in the arithmetic',
  'E-UNCLASSIFIED': 'is not a number this can account for',
};

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

/**
 * Which of six skill counters a stage reports into.
 *
 * BY SKILL RATHER THAN BY STAGE NUMBER, and that is the decision worth
 * keeping. A teacher looking at a class's results wants to know which MOVE
 * a student cannot make, and "everybody fails step three" means nothing when
 * step three is a different thing in each of seven topics. These six are the
 * same move wherever it appears, so a count is comparable across topics.
 */
export type CounterSkill = 'SETUP' | 'REARRANGE' | 'SCALE' | 'EVALUATE' | 'UNITS' | 'PRECISION';

/** The six, in the order a report reads them. */
export const COUNTER_SKILLS: readonly CounterSkill[] = [
  'SETUP',
  'REARRANGE',
  'SCALE',
  'EVALUATE',
  'UNITS',
  'PRECISION',
];

/** What each counter is, for a teacher's page. */
export const SKILL_NAMES: { readonly [K in CounterSkill]: string } = {
  SETUP: 'choosing the move',
  REARRANGE: 'isolating the unknown',
  SCALE: 'scaling by a ratio',
  EVALUATE: 'doing the arithmetic',
  UNITS: 'carrying and cancelling units',
  PRECISION: 'significant figures and rounding',
};

/** What a stage asks for. */
export type StageKind = 'NUMERIC' | 'COUNT' | 'CHOICE';

/** One gated stage. */
export interface Stage {
  readonly id: string;
  readonly kind: StageKind;
  readonly counter: CounterSkill;
  /** The unit the answer must carry. Dimensionless means a bare number. */
  readonly unit: UnitExpr;
  /** Whether a unit is required at all. A count and an exponent have none. */
  readonly needsUnit: boolean;
  /** Only the last stage of a problem is graded on significant figures. */
  readonly gradesSigFigs: boolean;
  /** What the student is asked, in their words. */
  readonly prompt: string;
  /** For a CHOICE stage, what is on offer — in the order they are shown. */
  readonly options?: readonly string[];
}

const NO_UNIT = parseUnit('');

/**
 * Rotate a list deterministically, so the correct option is not always first.
 *
 * From the problem's own seed, not from a clock and not from `Math.random`:
 * the same problem must show the same options in the same order on every
 * device, or two students comparing "I picked the second one" are talking
 * about different things.
 */
function rotateFromSeed<T>(items: readonly T[], seed: string): { items: T[]; indexOf: (i: number) => number } {
  const by = items.length === 0 ? 0 : hashString(seed) % items.length;
  const rotated = [...items.slice(by), ...items.slice(0, by)];
  // Where the item originally at `i` ended up.
  const indexOf = (i: number): number => (i - by + items.length * 2) % items.length;
  return { items: rotated, indexOf };
}

/**
 * The stages of a problem, in order.
 *
 * SIGNIFICANT FIGURES ARE GRADED ONLY AT THE LAST STAGE, and that is a
 * judgement rather than a leniency. Rounding an intermediate is
 * E-SIG-ROUND-EARLY — an error in its own right — so a stage machine that
 * demanded a rounded intermediate would be marking students down for the thing
 * it elsewhere calls a mistake.
 *
 * PRECONDITION: `problem` came from the generator.
 */
export function stagesFor(problem: Problem): Stage[] {
  switch (problem.topic) {
    case 'REARRANGE': {
      const relation = relationById(problem.relationId);
      if (relation === undefined) return [];
      const unit = parseUnit(relation.symbols[problem.solveFor]?.unit ?? '');
      const name = relation.symbols[problem.solveFor]?.name ?? problem.solveFor;
      if (relation.shape === 'OFFSET') {
        return [
          {
            id: 'R1',
            kind: 'CHOICE',
            counter: 'SETUP',
            unit: NO_UNIT,
            needsUnit: false,
            gradesSigFigs: false,
            prompt: `Which rearrangement of ${relation.written} gives you ${problem.solveFor}?`,
            options: rearrangeOptions(problem).items,
          },
          {
            id: 'R3',
            kind: 'NUMERIC',
            counter: 'EVALUATE',
            unit,
            needsUnit: true,
            gradesSigFigs: true,
            prompt: `Now work out ${name}. Give it to ${problem.answerSigFigs} significant figures, with its unit.`,
          },
        ];
      }
      const { rest } = rearrangeParts(problem);
      const stages: Stage[] = [
        {
          id: 'R1',
          kind: 'CHOICE',
          counter: 'SETUP',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt: `Which rearrangement of ${relation.written} gives you ${problem.solveFor}?`,
          options: rearrangeOptions(problem).items,
        },
      ];
      if (rest.length >= 2) {
        stages.push({
          id: 'R2',
          kind: 'NUMERIC',
          counter: 'REARRANGE',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `${problem.solveFor} has to be separated from ${rest.map((r) => r.symbol).join(' and ')}. ` +
            `Multiply those together — what do you have to divide by? A bare number is fine.`,
        });
      }
      stages.push({
        id: 'R3',
        kind: 'NUMERIC',
        counter: 'EVALUATE',
        unit,
        needsUnit: true,
        gradesSigFigs: true,
        prompt: `Now work out ${name}. Give it to ${problem.answerSigFigs} significant figures, with its unit.`,
      });
      return stages;
    }

    case 'PROPORTION':
      return [
        {
          id: 'P1',
          kind: 'NUMERIC',
          counter: 'SCALE',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `The recipe takes ${problem.from.written} mol of ${problem.fromName} and you have ` +
            `${problem.have.written}. How many times the recipe is that? A bare number.`,
        },
        {
          id: 'P2',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: problem.to.unit,
          needsUnit: true,
          gradesSigFigs: true,
          prompt:
            `Now scale the ${problem.toName} by that. Give it to ${problem.answerSigFigs} ` +
            `significant figures, with its unit.`,
        },
      ];

    case 'SCINOT':
      return [
        {
          id: 'N1',
          kind: 'COUNT',
          counter: 'SETUP',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `${problem.operation === 'MULTIPLY' ? 'Multiplying' : 'Dividing'} does one thing to the ` +
            `exponents. What exponent do the two powers of ten give you? A whole number.`,
        },
        {
          id: 'N2',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `And the two front numbers — ${problem.operation === 'MULTIPLY' ? 'multiply' : 'divide'} ` +
            `them. Carry all the digits; do not round yet.`,
        },
        {
          id: 'N3',
          kind: 'COUNT',
          counter: 'PRECISION',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `Scientific notation wants the front number between 1 and 10. ` +
            `After shifting it, what is the exponent? A whole number.`,
        },
        {
          id: 'N4',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: problem.answerUnit,
          needsUnit: !isEmptyUnit(problem.answerUnit),
          gradesSigFigs: true,
          prompt:
            `Write the whole answer in scientific notation, to ${problem.answerSigFigs} ` +
            `significant figures.`,
        },
      ];

    case 'POWERS': {
      const stages: Stage[] = [
        {
          id: 'W0',
          kind: 'CHOICE',
          counter: 'SETUP',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            problem.direction === 'POWER'
              ? `Which of these is what rate = k[A]^${problem.exponent} tells you to work out?`
              : `K = [A]^${problem.exponent}. Which of these gets you [A]?`,
          options: powerOptions(problem).items,
        },
      ];
      if (problem.direction === 'POWER') {
        stages.push({
          id: 'W1',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt: `Work out ${problem.baseName} to the power ${problem.exponent} on its own first. Carry all the digits.`,
        });
      }
      stages.push({
        id: 'W3',
        kind: 'NUMERIC',
        counter: 'EVALUATE',
        unit: problem.answerUnit,
        needsUnit: true,
        gradesSigFigs: true,
        prompt: `Now the whole thing, to ${problem.answerSigFigs} significant figures, with its unit.`,
      });
      return stages;
    }

    case 'FRACTIONS':
      return [
        {
          id: 'F1',
          kind: 'CHOICE',
          counter: 'SETUP',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt: `${problem.rateName} is a rate. Which of these gets you the answer?`,
          options: fractionOptions(problem).items,
        },
        {
          id: 'F2',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: problem.answerUnit,
          needsUnit: true,
          gradesSigFigs: true,
          prompt: `Work it out, to ${problem.answerSigFigs} significant figures, with its unit.`,
        },
      ];

    case 'UNITS': {
      const first = problem.factors[0];
      return [
        {
          id: 'U1',
          kind: 'CHOICE',
          counter: 'UNITS',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `The first conversion is: ${first?.label ?? ''}. ` +
            `Which way up does it have to go for the unit you are starting with to cancel?`,
          options: unitOptions(problem).items,
        },
        {
          id: 'U2',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: firstProducedUnit(problem),
          needsUnit: true,
          gradesSigFigs: false,
          prompt: `Apply just that first conversion. What have you got, and in what unit? Carry all the digits.`,
        },
        {
          id: 'U3',
          kind: 'NUMERIC',
          counter: 'EVALUATE',
          unit: problem.wantedUnit,
          needsUnit: true,
          gradesSigFigs: true,
          prompt:
            `Now finish the chain. Give the answer to ${problem.answerSigFigs} significant figures, ` +
            `with the unit you are left with.`,
        },
      ];
    }

    case 'SIGFIGS': {
      const first = problem.operands[0] as StatedValue;
      return [
        {
          id: 'G1',
          kind: 'COUNT',
          counter: 'PRECISION',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt: `How many significant figures does ${first.written} carry? A whole number.`,
        },
        {
          id: 'G2',
          kind: 'COUNT',
          counter: 'PRECISION',
          unit: NO_UNIT,
          needsUnit: false,
          gradesSigFigs: false,
          prompt:
            `${problem.operation === 'MULTIPLY' ? 'Multiplying' : 'Adding'} measurements — how many ` +
            `significant figures is the answer entitled to? A whole number.`,
        },
        {
          id: 'G3',
          kind: 'NUMERIC',
          counter: 'PRECISION',
          unit: problem.answerUnit,
          needsUnit: true,
          gradesSigFigs: true,
          prompt: `Write the answer, rounded once, at the end, with its unit.`,
        },
      ];
    }
  }
}

function isEmptyUnit(unit: UnitExpr): boolean {
  return unit.num.length === 0 && unit.den.length === 0;
}

/** The unit the chain carries after only its first link. */
function firstProducedUnit(problem: Problem & { topic: 'UNITS' }): UnitExpr {
  const first = problem.factors[0];
  if (first === undefined) return NO_UNIT;
  return runChain(1, problem.start.unit, [first]).unit;
}

/* ------------------------------------------------------------------ */
/* The options on a CHOICE stage — generated from the taxonomy          */
/* ------------------------------------------------------------------ */

/**
 * The choices are the PREDICTIONS, written symbolically.
 *
 * That is why they are here and not in `problem.ts`: an option list assembled
 * by hand would be a second statement of which mistakes exist, and it would go
 * stale the first time a class was added. Generated from the classes, a wrong
 * choice attributes with no matching table in between — and because the
 * options are symbolic they carry no value, so showing them is not showing an
 * answer.
 */
interface OptionSet {
  readonly items: readonly string[];
  readonly correct: number;
  readonly byClass: ReadonlyMap<ErrorClass, number>;
}

function buildOptions(
  seed: string,
  correctText: string,
  wrong: readonly { readonly errorClass: ErrorClass; readonly text: string }[],
): OptionSet {
  const unique: { errorClass: ErrorClass; text: string }[] = [];
  for (const candidate of wrong) {
    if (candidate.text === correctText) continue;
    if (unique.some((u) => u.text === candidate.text)) continue;
    unique.push(candidate);
  }
  const ordered = [correctText, ...unique.map((u) => u.text)];
  const { items, indexOf } = rotateFromSeed(ordered, seed);
  const byClass = new Map<ErrorClass, number>();
  unique.forEach((u, i) => byClass.set(u.errorClass, indexOf(i + 1)));
  return { items, correct: indexOf(0), byClass };
}

function rearrangeOptions(problem: Problem & { topic: 'REARRANGE' }): OptionSet {
  const relation = relationById(problem.relationId);
  const seed = `${problem.seed}|R1`;
  if (relation === undefined) return buildOptions(seed, '?', []);
  const onLeft = relation.left.includes(problem.solveFor);

  if (relation.shape === 'OFFSET') {
    const other = (onLeft ? relation.right : relation.left)[0] as string;
    const offset = relation.offset ?? 0;
    const right = onLeft ? `${problem.solveFor} = ${other} + ${offset}` : `${problem.solveFor} = ${other} − ${offset}`;
    const wrongWay = onLeft ? `${problem.solveFor} = ${other} − ${offset}` : `${problem.solveFor} = ${other} + ${offset}`;
    return buildOptions(seed, right, [{ errorClass: 'E-REARR-SIGN', text: wrongWay }]);
  }

  const { rest } = rearrangeParts(problem);
  const other = (onLeft ? relation.right : relation.left).join(' × ');
  const restText = rest.map((r) => r.symbol).join(' × ');
  const correctText = `${problem.solveFor} = ${other} ÷ (${restText})`;
  const wrong: { errorClass: ErrorClass; text: string }[] = [
    { errorClass: 'E-REARR-MULTIPLIED', text: `${problem.solveFor} = ${other} × ${restText}` },
    { errorClass: 'E-REARR-INVERTED', text: `${problem.solveFor} = (${restText}) ÷ ${other}` },
  ];
  if (rest.length >= 2) {
    const dropped = rest[0] as { symbol: string };
    const kept = rest.filter((r) => r.symbol !== dropped.symbol).map((r) => r.symbol).join(' × ');
    wrong.push({ errorClass: 'E-REARR-PARTIAL', text: `${problem.solveFor} = ${other} ÷ (${kept})` });
  }
  return buildOptions(seed, correctText, wrong);
}

function powerOptions(problem: Problem & { topic: 'POWERS' }): OptionSet {
  const seed = `${problem.seed}|W0`;
  const n = problem.exponent;
  if (problem.direction === 'ROOT') {
    return buildOptions(seed, `[A] = the ${n === 2 ? 'square' : 'cube'} root of K`, [
      { errorClass: 'E-POW-MULTIPLIED', text: `[A] = K ÷ ${n}` },
      { errorClass: 'E-POW-INVERTED', text: `[A] = K to the power ${n}` },
    ]);
  }
  return buildOptions(seed, `k × ([A] to the power ${n})`, [
    { errorClass: 'E-POW-MULTIPLIED', text: `k × [A] × ${n}` },
    { errorClass: 'E-POW-COEFF', text: `(k × [A]) to the power ${n}` },
    { errorClass: 'E-POW-SWAPPED', text: `k × (${n} to the power [A])` },
  ]);
}

function fractionOptions(problem: Problem & { topic: 'FRACTIONS' }): OptionSet {
  const seed = `${problem.seed}|F1`;
  const a = problem.amount.symbol;
  const r = problem.rate.symbol;
  return buildOptions(seed, `${a} ÷ ${r}`, [
    { errorClass: 'E-FRAC-INVERTED', text: `${a} × ${r}` },
    { errorClass: 'E-FRAC-RECIPROCAL', text: `${r} ÷ ${a}` },
    { errorClass: 'E-FRAC-RATE-IGNORED', text: `${a} on its own` },
  ]);
}

function unitOptions(problem: Problem & { topic: 'UNITS' }): OptionSet {
  const seed = `${problem.seed}|U1`;
  const first = problem.factors[0];
  if (first === undefined) return buildOptions(seed, '?', []);
  return buildOptions(seed, formatUnit(first.unit), [
    { errorClass: 'E-UNIT-FACTOR-INVERTED', text: formatUnit(flip(first).unit) },
  ]);
}

/* ------------------------------------------------------------------ */
/* Reading a typed answer                                              */
/* ------------------------------------------------------------------ */

/** What a student typed. */
export type StudentEntry =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'choice'; readonly option: number };

/** A typed answer, split into what it said and how precisely. */
export interface ReadEntry {
  readonly quantity: Quantity;
  /** The unit written after the number, or null where none was. */
  readonly unit: UnitExpr | null;
  /** The unit exactly as typed, for the message when it is the wrong one. */
  readonly unitText: string;
}

/**
 * Split a typed answer into a number and a unit.
 *
 * PRECONDITION: none. Returns null where there is no number to read at all —
 * which is a different event from a number with no unit, and the two get
 * different classes.
 */
export function readEntry(text: string): ReadEntry | null {
  const trimmed = text.trim();
  const match = /^([+-]?[\d.,]+(?:\s*(?:[eE][+-]?\d+|[x×*]\s*10\s*\^?\s*[+-]?\d+))?)\s*(.*)$/.exec(trimmed);
  if (match === null) return null;
  let quantity: Quantity;
  try {
    quantity = parseQuantity(match[1] as string);
  } catch (error) {
    if (error instanceof SigFigError) return null;
    throw error;
  }
  const tail = (match[2] as string).trim();
  if (tail.length === 0) return { quantity, unit: null, unitText: '' };
  try {
    return { quantity, unit: parseUnit(tail), unitText: tail };
  } catch {
    return { quantity, unit: null, unitText: tail };
  }
}

/* ------------------------------------------------------------------ */
/* Predictions                                                         */
/* ------------------------------------------------------------------ */

/** A value one specific mistake would produce. */
export interface Prediction {
  readonly errorClass: ErrorClass;
  /** The number this mistake produces, on a NUMERIC or COUNT stage. */
  readonly value?: number;
  /** The option this mistake picks, on a CHOICE stage. */
  readonly choice?: number;
  /** How many significant figures the mistake would be written to, where that is the mistake. */
  readonly sigFigs?: number;
  /** What the mistake was. A constant — never carries a value from the problem. */
  readonly why: string;
}

/** A prediction dropped because it is not distinguishable from the correct answer. */
export interface DroppedPrediction {
  readonly errorClass: ErrorClass;
  readonly reason: 'INDISTINGUISHABLE_FROM_CORRECT';
}

/** Everything predicted for one stage, and what could not be. */
export interface StagePredictions {
  readonly stage: string;
  readonly correctValue: number | null;
  readonly correctChoice: number | null;
  readonly predictions: readonly Prediction[];
  readonly dropped: readonly DroppedPrediction[];
}

const relativeClose = (a: number, b: number, tolerance: number): boolean => {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return true;
  return Math.abs(a - b) / scale <= tolerance;
};

/** The correct value at a stage, or null where the stage is a choice. */
export function correctValueAt(problem: Problem, solution: Solution, stage: Stage): number | null {
  if (stage.kind === 'CHOICE') return null;
  const found = solution.at[stage.id];
  return found === undefined ? null : found;
}

/**
 * What a student who rounded on the way through would end up with.
 *
 * Computed the same way for every topic: round every stated value to the
 * answer's own precision FIRST, then do the arithmetic. That is exactly what
 * "rounding early" means, and it is why this is one function rather than seven
 * — the misconception does not change with the topic.
 */
function roundEarlyAnswer(problem: Problem, solution: Solution): number | null {
  const figures = requiredSigFigs(problem, solution);
  const rounded = (value: number): number => roundToSigFigs(value, figures);
  switch (problem.topic) {
    case 'REARRANGE': {
      const relation = relationById(problem.relationId);
      if (relation === undefined || relation.shape === 'OFFSET') return null;
      const { rest, otherProduct } = rearrangeParts(problem);
      return rounded(rounded(otherProduct) / rounded(rest.reduce((a, r) => a * rounded(r.value), 1)));
    }
    case 'PROPORTION':
      return rounded(rounded(problem.have.quantity.value / problem.from.quantity.value) * problem.to.quantity.value);
    case 'SCINOT': {
      const raw =
        problem.operation === 'MULTIPLY'
          ? problem.firstMantissa * problem.secondMantissa
          : problem.firstMantissa / problem.secondMantissa;
      const exponent =
        problem.operation === 'MULTIPLY'
          ? problem.firstExponent + problem.secondExponent
          : problem.firstExponent - problem.secondExponent;
      return rounded(rounded(raw) * 10 ** exponent);
    }
    case 'POWERS': {
      if (problem.direction === 'ROOT') return null;
      const power = rounded(problem.base.quantity.value ** problem.exponent);
      return rounded(power * (problem.coefficient?.quantity.value ?? 1));
    }
    case 'FRACTIONS':
      return null;
    case 'UNITS': {
      let running = problem.start.quantity.value;
      for (const factor of problem.factors) running = rounded(running * factor.value);
      return running;
    }
    case 'SIGFIGS': {
      const values = problem.operands.map((o) => rounded(o.quantity.value));
      const raw =
        problem.operation === 'MULTIPLY'
          ? values.reduce((a, b) => a * b, 1)
          : values.reduce((a, b) => a + b, 0);
      return rounded(raw);
    }
  }
}

/**
 * Every value a plausible mistake would produce at this stage.
 *
 * PRECONDITION: `stage` came from {@link stagesFor} for this problem, and
 * `solution` from `solve()` of it. THE GRADER'S — never reachable from a path
 * that renders a problem.
 *
 * A prediction that lands on the correct answer is DROPPED and recorded rather
 * than kept: a mistake that produces the right number is not something this can
 * attribute, and keeping it would make every correct answer look ambiguous.
 */
export function predictionsFor(problem: Problem, solution: Solution, stage: Stage): StagePredictions {
  const raw: Prediction[] = [];
  const correctValue = correctValueAt(problem, solution, stage);
  let correctChoice: number | null = null;

  if (stage.kind === 'CHOICE') {
    const set = optionsFor(problem, stage);
    correctChoice = set.correct;
    for (const [errorClass, index] of set.byClass) {
      raw.push({ errorClass, choice: index, why: CLASS_MEANINGS[errorClass] });
    }
  } else {
    raw.push(...numericPredictions(problem, solution, stage));
  }

  const predictions: Prediction[] = [];
  const dropped: DroppedPrediction[] = [];
  const seen = new Set<string>();
  for (const prediction of raw) {
    if (prediction.value !== undefined) {
      if (!Number.isFinite(prediction.value)) continue;
      // DROPPED AT THE PROBLEM'S OWN PRECISION, the same reading everything
      // else uses. A mistake that produces the correct answer to the figures
      // being graded is not something this can attribute — the classifier will
      // mark that entry correct, and it would be right to.
      if (
        correctValue !== null &&
        prediction.sigFigs === undefined &&
        indistinguishable(prediction.value, correctValue, requiredSigFigs(problem, solution))
      ) {
        dropped.push({ errorClass: prediction.errorClass, reason: 'INDISTINGUISHABLE_FROM_CORRECT' });
        continue;
      }
    }
    const key = `${prediction.errorClass}|${prediction.value ?? ''}|${prediction.choice ?? ''}|${prediction.sigFigs ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    predictions.push(prediction);
  }

  return { stage: stage.id, correctValue, correctChoice, predictions, dropped };
}

function optionsFor(problem: Problem, stage: Stage): OptionSet {
  if (problem.topic === 'REARRANGE' && stage.id === 'R1') return rearrangeOptions(problem);
  if (problem.topic === 'POWERS' && stage.id === 'W0') return powerOptions(problem);
  if (problem.topic === 'FRACTIONS' && stage.id === 'F1') return fractionOptions(problem);
  if (problem.topic === 'UNITS' && stage.id === 'U1') return unitOptions(problem);
  return { items: [], correct: 0, byClass: new Map() };
}

const of = (errorClass: ErrorClass, value: number): Prediction => ({
  errorClass,
  value,
  why: CLASS_MEANINGS[errorClass],
});

function numericPredictions(problem: Problem, solution: Solution, stage: Stage): Prediction[] {
  const out: Prediction[] = [];

  switch (problem.topic) {
    case 'REARRANGE': {
      const relation = relationById(problem.relationId);
      if (relation === undefined) break;
      if (relation.shape === 'OFFSET') {
        if (stage.id !== 'R3') break;
        const onLeft = relation.left.includes(problem.solveFor);
        const other = (onLeft ? relation.right : relation.left)[0] as string;
        const otherValue = problem.given.find((g) => g.symbol === other)?.quantity.value ?? 0;
        const offset = relation.offset ?? 0;
        out.push(of('E-REARR-SIGN', onLeft ? otherValue - offset : otherValue + offset));
        break;
      }
      const { rest, restProduct, otherProduct } = rearrangeParts(problem);
      if (stage.id === 'R2') {
        // The intermediate: what the unknown has to be divided by. Dropping
        // one of the factors is the whole of what goes wrong here.
        for (const factor of rest) {
          out.push(of('E-REARR-PARTIAL', restProduct / factor.value));
        }
        break;
      }
      if (stage.id === 'R3') {
        const answer = otherProduct / restProduct;
        out.push(of('E-REARR-MULTIPLIED', otherProduct * restProduct));
        out.push(of('E-REARR-INVERTED', restProduct / otherProduct));
        for (const factor of rest) {
          out.push(of('E-REARR-PARTIAL', answer * factor.value));
        }
      }
      break;
    }

    case 'PROPORTION': {
      const a = problem.from.quantity.value;
      const b = problem.to.quantity.value;
      const c = problem.have.quantity.value;
      if (stage.id === 'P1') {
        // "How many times the recipe" taken upside down is the ratio error
        // arriving one stage early, which is exactly where it starts.
        out.push(of('E-PROP-INVERTED', a / c));
        break;
      }
      if (stage.id === 'P2') {
        out.push(of('E-PROP-INVERTED', (c * a) / b));
        out.push(of('E-PROP-ADDED', c + b - a));
        out.push(of('E-PROP-DROPPED', c));
      }
      break;
    }

    case 'SCINOT': {
      const e1 = problem.firstExponent;
      const e2 = problem.secondExponent;
      const m1 = problem.firstMantissa;
      const m2 = problem.secondMantissa;
      const multiplying = problem.operation === 'MULTIPLY';
      const rawMantissa = multiplying ? m1 * m2 : m1 / m2;
      const rawExponent = multiplying ? e1 + e2 : e1 - e2;
      const wrongExponentOp = e1 * e2;
      const wrongExponentSign = multiplying ? e1 - e2 : e1 + e2;
      const wrongMantissa = multiplying ? m1 + m2 : m1 - m2;

      if (stage.id === 'N1') {
        out.push(of('E-SCI-EXP-OP', wrongExponentOp));
        out.push(of('E-SCI-EXP-SIGN', wrongExponentSign));
        break;
      }
      if (stage.id === 'N2') {
        out.push(of('E-SCI-MANTISSA-OP', wrongMantissa));
        break;
      }
      if (stage.id === 'N3') {
        // ONLY THIS STAGE'S MISTAKE. The first version also predicted the
        // exponent a student would reach by carrying an N1 error forward —
        // which collided with the normalisation error twelve times in a
        // forty-problem sweep, and was the wrong model anyway. Work is
        // step-gated and each step is diagnosed on its own; a student who got
        // N1 wrong and carried it consistently is showing the N1 mistake
        // again, not a second one.
        out.push(of('E-SCI-NORMALISE', rawExponent));
        break;
      }
      if (stage.id === 'N4') {
        out.push(of('E-SCI-EXP-OP', rawMantissa * 10 ** wrongExponentOp));
        out.push(of('E-SCI-EXP-SIGN', rawMantissa * 10 ** wrongExponentSign));
        out.push(of('E-SCI-MANTISSA-OP', wrongMantissa * 10 ** rawExponent));
        const value = rawMantissa * 10 ** rawExponent;
        const { mantissa } = normalise(value);
        const shift = Math.round(Math.log10(rawMantissa / mantissa));
        if (shift !== 0) out.push(of('E-SCI-NORMALISE', value * 10 ** -shift));
      }
      break;
    }

    case 'POWERS': {
      const base = problem.base.quantity.value;
      const n = problem.exponent;
      const k = problem.coefficient?.quantity.value ?? 1;
      if (problem.direction === 'ROOT') {
        if (stage.id !== 'W3') break;
        out.push(of('E-POW-MULTIPLIED', base / n));
        out.push(of('E-POW-INVERTED', base ** n));
        break;
      }
      if (stage.id === 'W1') {
        out.push(of('E-POW-MULTIPLIED', base * n));
        out.push(of('E-POW-INVERTED', base ** (1 / n)));
        out.push(of('E-POW-SWAPPED', n ** base));
        break;
      }
      if (stage.id === 'W3') {
        out.push(of('E-POW-MULTIPLIED', k * base * n));
        out.push(of('E-POW-INVERTED', k * base ** (1 / n)));
        out.push(of('E-POW-SWAPPED', k * n ** base));
        out.push(of('E-POW-COEFF', (k * base) ** n));
      }
      break;
    }

    case 'FRACTIONS': {
      if (stage.id !== 'F2') break;
      const amount = problem.amount.quantity.value;
      const rate = problem.rate.quantity.value;
      out.push(of('E-FRAC-INVERTED', amount * rate));
      out.push(of('E-FRAC-RECIPROCAL', rate / amount));
      out.push(of('E-FRAC-RATE-IGNORED', amount));
      break;
    }

    case 'UNITS': {
      const start = problem.start.quantity.value;
      const factors = problem.factors;
      if (stage.id === 'U2') {
        const first = factors[0];
        if (first !== undefined) out.push(of('E-UNIT-FACTOR-INVERTED', start / first.value));
        break;
      }
      if (stage.id === 'U3') {
        const correct = runChain(start, problem.start.unit, factors).value;
        factors.forEach((factor, i) => {
          // One link upside down: the chain is out by that factor squared.
          out.push(of('E-UNIT-FACTOR-INVERTED', correct / (factor.value * factor.value)));
          // One link left out entirely.
          out.push(of('E-UNIT-DROPPED', correct / factor.value));
          void i;
        });
        // Every link upside down, which is what happens when somebody decides
        // the whole chain reads the other way.
        const allFlipped = factors.reduce((v, f) => v / (f.value * f.value), correct);
        out.push(of('E-UNIT-CHAIN-INVERTED', allFlipped));
      }
      break;
    }

    case 'SIGFIGS': {
      const first = problem.operands[0] as StatedValue;
      if (stage.id === 'G1') {
        // Counting the zeros that only hold the decimal point in place.
        const zeros = leadingZeroCount(first);
        if (zeros > 0) out.push(of('E-SIG-COUNT-ZEROS', countSigFigs(first) + zeros));
        break;
      }
      if (stage.id === 'G2') {
        const counts = ruleCounts(problem);
        if (counts !== null && counts.wrong !== counts.right) {
          out.push(of('E-SIG-WRONG-RULE', counts.wrong));
        }
        break;
      }
      if (stage.id === 'G3') {
        const counts = ruleCounts(problem);
        if (counts !== null && counts.wrong !== counts.right) {
          out.push(of('E-SIG-WRONG-RULE', roundToSigFigs(counts.raw, counts.wrong)));
        }
      }
      break;
    }
  }

  // The two that apply wherever an answer is finally written down, whatever
  // the topic. Both are about the LAST stage, because that is the only place
  // figures are graded — see `stagesFor`.
  if (stage.gradesSigFigs) {
    const early = roundEarlyAnswer(problem, solution);
    if (early !== null) out.push(of('E-SIG-ROUND-EARLY', early));
    const answer = correctValueAt(problem, solution, stage);
    if (answer !== null) {
      // The right value written to the wrong precision. Carried as a sigFigs
      // rather than a value, because the VALUE is right — that is the point of
      // the class, and comparing numbers could never see it.
      out.push({
        errorClass: 'E-SIG-FIGURES',
        value: answer,
        sigFigs: requiredSigFigs(problem, solution) - 1,
        why: CLASS_MEANINGS['E-SIG-FIGURES'],
      });
    }
  }

  return out;
}

/**
 * How many significant figures the final answer must be WRITTEN to.
 *
 * For six of the seven topics the problem states it, and this is that number.
 * For the significant-figures topic it is the thing being asked, so it is
 * derived from the measurements — and it is read off the SOLUTION rather than
 * put on the `Stage`, because stage G2 asks the student for exactly this
 * number and a stage object is something a screen renders.
 */
export function requiredSigFigs(problem: Problem, solution: Solution): number {
  if (problem.topic !== 'SIGFIGS') return problem.answerSigFigs;
  const derived = solution.at['G2'];
  return derived === undefined ? problem.answerSigFigs : derived;
}

/** How many leading zeros a stated value carries after its decimal point. */
function leadingZeroCount(value: StatedValue): number {
  const magnitude = value.quantity.value === 0 ? 0 : magnitudeOf(value.quantity.value);
  return magnitude < 0 ? -magnitude : 0;
}

/** The two figure counts a significant-figures problem's two rules give. */
function ruleCounts(problem: Problem & { topic: 'SIGFIGS' }): {
  right: number;
  wrong: number;
  raw: number;
} | null {
  const solution = solve(problem);
  const right = solution.at['G2'];
  if (right === undefined) return null;
  const values = problem.operands.map((o) => o.quantity.value);
  const raw =
    problem.operation === 'MULTIPLY'
      ? values.reduce((a, b) => a * b, 1)
      : values.reduce((a, b) => a + b, 0);
  // The other rule: the fewest significant figures where the decimal-place
  // rule applies, and the coarsest decimal place where it does not.
  const wrong =
    problem.operation === 'MULTIPLY'
      ? coarsestPlaceCount(problem, raw)
      : Math.min(...problem.operands.map((o) => countSigFigs(o)));
  return { right, wrong, raw };
}

function coarsestPlaceCount(problem: Problem & { topic: 'SIGFIGS' }, raw: number): number {
  let coarsest = -Infinity;
  for (const operand of problem.operands) {
    const q = operand.quantity;
    if (q.kind === 'measured') coarsest = Math.max(coarsest, q.reading.lastPlace);
    else if (q.kind === 'ambiguous') coarsest = Math.max(coarsest, q.low.lastPlace);
  }
  if (coarsest === -Infinity) return 1;
  return Math.max(1, magnitudeOf(raw) - coarsest + 1);
}

/* ------------------------------------------------------------------ */
/* Collisions                                                          */
/* ------------------------------------------------------------------ */

/** Two classes that predict something a student could not tell apart. */
export interface Collision {
  readonly topic: string;
  readonly stage: string;
  readonly classes: readonly [ErrorClass, ErrorClass];
  readonly value: string;
}

/**
 * Every pair of DIFFERENT classes whose predictions a student could not tell
 * apart, at this problem's own precision.
 *
 * PRECONDITION: as {@link predictionsFor}.
 *
 * A NON-EMPTY RESULT IS A DEFECT IN THE DECOMPOSITION, not something to work
 * around. Fix the decomposition or stop generating that problem; never add a
 * tiebreak.
 */
export function collisionsFor(problem: Problem, solution: Solution): Collision[] {
  const found: Collision[] = [];
  const sf = problem.answerSigFigs;

  for (const stage of stagesFor(problem)) {
    const { predictions } = predictionsFor(problem, solution, stage);
    for (let i = 0; i < predictions.length; i += 1) {
      for (let j = i + 1; j < predictions.length; j += 1) {
        const a = predictions[i] as Prediction;
        const b = predictions[j] as Prediction;
        if (a.errorClass === b.errorClass) continue;
        // A prediction ABOUT precision and one about a value are never the
        // same observable: one is "the right number written short", the other
        // is a different number. They are told apart by how it was written.
        if ((a.sigFigs === undefined) !== (b.sigFigs === undefined)) continue;
        let clash = false;
        let shown = '';
        if (a.value !== undefined && b.value !== undefined) {
          // AT EVERY READING A STUDENT MIGHT WRITE, not only at the problem's
          // own. See `indistinguishable`.
          clash = indistinguishable(a.value, b.value, sf);
          shown = formatSigFigs(a.value, sf);
        } else if (a.choice !== undefined && b.choice !== undefined) {
          clash = a.choice === b.choice;
          shown = `option ${a.choice + 1}`;
        }
        if (clash) {
          found.push({ topic: problem.topic, stage: stage.id, classes: [a.errorClass, b.errorClass], value: shown });
        }
      }
    }
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

/** What the classifier decided about one entry. */
export interface Classification {
  readonly stage: string;
  readonly correct: boolean;
  /** The single class, or null where the entry was correct. */
  readonly errorClass: ErrorClass | null;
  /** Every class that matched. More than one is a collision and a defect. */
  readonly matched: readonly ErrorClass[];
  readonly collision: boolean;
  /** log10(entry / correct), where both are numbers and neither is zero. */
  readonly logError: number | null;
  /** What happened, in the student's words. Empty where the entry was correct. */
  readonly why: string;
}

/** How many significant figures a quantity was WRITTEN to. */
function writtenSigFigs(quantity: Quantity): number | null {
  if (quantity.kind === 'measured') return quantity.reading.sigFigs;
  if (quantity.kind === 'ambiguous') return null;
  return null;
}

/**
 * True where the entry could be this candidate, judged at the precision the
 * student themselves wrote.
 *
 * FOR DIAGNOSIS, NOT FOR GRADING. Matching a predicted wrong value should be
 * generous — the point is to recognise the mistake, and a student who rounded
 * their wrong answer still made that mistake. Grading uses
 * {@link entryIsCorrect}, which is strict, and the two are separate on purpose.
 */
function entryMatches(quantity: Quantity, candidate: number, sigFigs: number): boolean {
  const readings =
    quantity.kind === 'exact'
      ? []
      : quantity.kind === 'measured'
        ? [quantity.reading.sigFigs]
        : [quantity.low.sigFigs, quantity.high.sigFigs];
  if (readings.length === 0) return relativeClose(quantity.value, candidate, DISTINGUISHABLE_RELATIVE);
  // FLOORED AT THE PROBLEM'S OWN PRECISION — the same floor `entryIsCorrect`
  // uses, and they have to be the same one. Judged more loosely than
  // correctness, an entry that failed the correctness check at four figures
  // would go on to match a predicted mistake at two, and a student who had the
  // right value and rounded it badly would be told they held a misconception
  // they did not.
  return readings.some((written) =>
    sameAtPrecision(quantity.value, candidate, Math.max(written, sigFigs)),
  );
}

/**
 * True where the entry IS the correct value, judged at no less than the
 * precision the problem works to.
 *
 * WHY THE FLOOR. Judging only at the precision the student wrote accepts an
 * answer of 2 for a value of 1.627, because at one significant figure they
 * agree — and no intermediate stage grades figures, so nothing else would catch
 * it. An answer twenty-three percent out would be correct at every stage but
 * the last. The floor is the problem's OWN stated precision rather than a
 * constant, which is what makes it work at the graded final stage too.
 */
function entryIsCorrect(quantity: Quantity, candidate: number, sigFigs: number): boolean {
  const readings =
    quantity.kind === 'exact'
      ? []
      : quantity.kind === 'measured'
        ? [quantity.reading.sigFigs]
        : [quantity.low.sigFigs, quantity.high.sigFigs];
  if (readings.length === 0) return relativeClose(quantity.value, candidate, DISTINGUISHABLE_RELATIVE);
  return readings.some((written) => sameAtPrecision(quantity.value, candidate, Math.max(written, sigFigs)));
}

/**
 * Classify one entry at one stage.
 *
 * PRECONDITION: `stage` came from {@link stagesFor} for this problem. An entry
 * of the wrong SHAPE for the stage — a choice where a number was asked for —
 * is reported as E-UNCLASSIFIED rather than throwing, because a defect in
 * whatever is calling this should show up in the unclassified count rather
 * than end a student's session.
 */
export function classify(
  problem: Problem,
  solution: Solution,
  stage: Stage,
  entry: StudentEntry,
): Classification {
  const predicted = predictionsFor(problem, solution, stage);
  const base = { stage: stage.id, collision: false, logError: null, matched: [] as ErrorClass[] };

  if (stage.kind === 'CHOICE') {
    if (entry.kind !== 'choice') {
      return { ...base, correct: false, errorClass: 'E-UNCLASSIFIED', why: 'that is not one of the choices' };
    }
    if (entry.option === predicted.correctChoice) {
      return { ...base, correct: true, errorClass: null, why: '' };
    }
    const matched = predicted.predictions.filter((p) => p.choice === entry.option);
    if (matched.length === 1) {
      const only = matched[0] as Prediction;
      return { ...base, correct: false, errorClass: only.errorClass, matched: [only.errorClass], why: only.why };
    }
    if (matched.length > 1) {
      return {
        ...base,
        correct: false,
        errorClass: null,
        matched: matched.map((m) => m.errorClass),
        collision: true,
        why: 'two different mistakes lead to that same choice',
      };
    }
    return { ...base, correct: false, errorClass: 'E-UNCLASSIFIED', why: CLASS_MEANINGS['E-UNCLASSIFIED'] };
  }

  if (entry.kind !== 'text') {
    return { ...base, correct: false, errorClass: 'E-UNCLASSIFIED', why: 'that is not a number' };
  }

  const read = readEntry(entry.text);
  if (read === null) {
    return { ...base, correct: false, errorClass: 'E-UNCLASSIFIED', why: 'there is no number here to read' };
  }

  const correctValue = predicted.correctValue;
  if (correctValue === null) {
    return { ...base, correct: false, errorClass: 'E-UNCLASSIFIED', why: CLASS_MEANINGS['E-UNCLASSIFIED'] };
  }

  const logError =
    read.quantity.value === 0 || correctValue === 0
      ? null
      : Math.log10(Math.abs(read.quantity.value / correctValue));

  /* ---- the unit, before the number ---- */
  //
  // A UNIT IS ITS OWN QUESTION and is asked first, because "you have the right
  // number and the wrong unit" and "you have the wrong number" are different
  // things to tell somebody, and folding them together would lose the one that
  // is nearly right.
  if (stage.needsUnit) {
    if (read.unit === null || isEmptyUnit(read.unit)) {
      return {
        ...base,
        correct: false,
        errorClass: 'E-UNIT-MISSING',
        matched: ['E-UNIT-MISSING'],
        logError,
        why: CLASS_MEANINGS['E-UNIT-MISSING'],
      };
    }
    if (!sameUnit(read.unit, stage.unit)) {
      return {
        ...base,
        correct: false,
        errorClass: 'E-UNIT-WRONG',
        matched: ['E-UNIT-WRONG'],
        logError,
        why: CLASS_MEANINGS['E-UNIT-WRONG'],
      };
    }
  }

  const required = requiredSigFigs(problem, solution);
  const figures = stage.kind === 'COUNT' ? 12 : required;

  /* ---- the right value written to the wrong number of figures ---- */
  //
  // ASKED FIRST, AND ASKED AT THE STUDENT'S OWN PRECISION. This is the only
  // question in the classifier that has to be, and the reason is that the
  // class exists for the case of TOO FEW figures: writing 1.5 where 1.50 was
  // asked. Judged at the required precision that entry is simply not the
  // correct value, so it falls through to the predictions and comes back as an
  // arithmetic slip — which is a worse thing to tell somebody than the truth,
  // that their number is right and their precision is not.
  //
  // Asking it before the predictions is also the safer order where both could
  // match: "your value is right, write it to the figures asked for" is true
  // and useful, and attributing the same entry to a misconception would not be.
  if (stage.gradesSigFigs) {
    const written = writtenSigFigs(read.quantity);
    const rightValue =
      written === null
        ? entryIsCorrect(read.quantity, correctValue, 1)
        : sameAtPrecision(read.quantity.value, correctValue, written);
    // An AMBIGUOUS answer at a graded stage is neither right nor wrong: `1500`
    // could be two figures or four, and a grader that picked one would be
    // inventing the student's own reading. It is reported as a precision
    // problem, which is exactly what it is.
    if (rightValue && written !== required) {
      return {
        ...base,
        correct: false,
        errorClass: 'E-SIG-FIGURES',
        matched: ['E-SIG-FIGURES'],
        logError,
        why: CLASS_MEANINGS['E-SIG-FIGURES'],
      };
    }
  }

  /* ---- correct? ---- */
  if (entryIsCorrect(read.quantity, correctValue, figures)) {
    return { ...base, correct: true, errorClass: null, logError, why: '' };
  }

  /* ---- which mistake? ---- */
  const matched: Prediction[] = [];
  for (const prediction of predicted.predictions) {
    if (prediction.value === undefined) continue;
    if (prediction.sigFigs !== undefined) continue;
    if (entryMatches(read.quantity, prediction.value, required)) matched.push(prediction);
  }
  const distinct = new Set(matched.map((m) => m.errorClass));
  if (distinct.size === 1) {
    const only = matched[0] as Prediction;
    return { ...base, correct: false, errorClass: only.errorClass, matched: [only.errorClass], logError, why: only.why };
  }
  if (distinct.size > 1) {
    return {
      ...base,
      correct: false,
      errorClass: null,
      matched: [...distinct],
      collision: true,
      logError,
      why: 'two different mistakes produce that same number',
    };
  }

  /* ---- no mistake accounts for it ---- */
  if (logError !== null && Math.abs(logError) < ORDER_OF_MAGNITUDE_LIMIT) {
    return { ...base, correct: false, errorClass: 'E-ARITH', matched: ['E-ARITH'], logError, why: CLASS_MEANINGS['E-ARITH'] };
  }
  return {
    ...base,
    correct: false,
    errorClass: 'E-UNCLASSIFIED',
    matched: ['E-UNCLASSIFIED'],
    logError,
    why: CLASS_MEANINGS['E-UNCLASSIFIED'],
  };
}

/**
 * Which of the four remediations a class routes to.
 *
 * The remediation is what the student is offered AFTER the attempt. It names
 * the move and nothing else — no value from the problem, because at an
 * intermediate stage nothing grades figures and an estimate handed over would
 * be accepted when it was typed back in.
 */
export type Remedy = 'A1-ISOLATE' | 'A2-PROPORTION' | 'A3-UNITS' | 'A4-MAGNITUDE';

/** What each remediation teaches. */
export const REMEDIES: { readonly [K in Remedy]: string } = {
  'A1-ISOLATE': 'undoing an operation on both sides to get one letter on its own',
  'A2-PROPORTION': 'setting two ratios equal and cross-multiplying',
  'A3-UNITS': 'writing a conversion so the unit you are carrying cancels',
  'A4-MAGNITUDE': 'checking the size of an answer before writing it down',
};

/**
 * The remediations for one class, in the order to offer them.
 *
 * PRECONDITION: none. Every class routes somewhere: a diagnosis that leads
 * nowhere is the failure this app was built to fix, reappearing one level up.
 */
export function remediesFor(errorClass: ErrorClass, logError: number | null): Remedy[] {
  const out: Remedy[] = [];
  switch (errorClass) {
    case 'E-REARR-MULTIPLIED':
    case 'E-REARR-INVERTED':
    case 'E-REARR-PARTIAL':
    case 'E-REARR-SIGN':
    case 'E-POW-MULTIPLIED':
    case 'E-POW-INVERTED':
    case 'E-POW-SWAPPED':
    case 'E-POW-COEFF':
      out.push('A1-ISOLATE');
      break;
    case 'E-PROP-INVERTED':
    case 'E-PROP-ADDED':
    case 'E-PROP-DROPPED':
    case 'E-FRAC-INVERTED':
    case 'E-FRAC-RECIPROCAL':
    case 'E-FRAC-RATE-IGNORED':
      out.push('A2-PROPORTION');
      break;
    case 'E-UNIT-FACTOR-INVERTED':
    case 'E-UNIT-DROPPED':
    case 'E-UNIT-CHAIN-INVERTED':
    case 'E-UNIT-MISSING':
    case 'E-UNIT-WRONG':
      out.push('A3-UNITS');
      break;
    case 'E-SCI-EXP-OP':
    case 'E-SCI-EXP-SIGN':
    case 'E-SCI-MANTISSA-OP':
    case 'E-SCI-NORMALISE':
      out.push('A4-MAGNITUDE');
      break;
    case 'E-SIG-FIGURES':
    case 'E-SIG-WRONG-RULE':
    case 'E-SIG-COUNT-ZEROS':
    case 'E-SIG-ROUND-EARLY':
      out.push('A4-MAGNITUDE');
      break;
    case 'E-ARITH':
      // An arithmetic slip bigger than about a factor of three is a decimal
      // place in the wrong spot rather than a miscount, so it gets the
      // magnitude help; anything smaller gets nothing to read, because there
      // is nothing to teach about a mistyped digit.
      if (logError !== null && Math.abs(logError) >= SCINOT_TRIGGER_LOG10) out.push('A4-MAGNITUDE');
      break;
    case 'E-UNCLASSIFIED':
      out.push('A4-MAGNITUDE');
      break;
  }
  return out;
}

/**
 * What the correct entry at a stage looks like, written as a student would.
 *
 * THE GRADER'S. This is what drives a session in the tests and the harness, and
 * what a reveal would show — never something a screen calls before an attempt.
 * It carries FULL precision at every stage that does not grade figures, because
 * a simulated student who rounded an intermediate would trip
 * E-SIG-ROUND-EARLY by accident and the suite would be measuring its own
 * scratch paper.
 */
export function correctEntryFor(
  problem: Problem,
  solution: Solution,
  stage: Stage,
  scratchSigFigs: number,
): StudentEntry {
  if (stage.kind === 'CHOICE') {
    return { kind: 'choice', option: optionsFor(problem, stage).correct };
  }
  const value = correctValueAt(problem, solution, stage) ?? 0;
  if (stage.kind === 'COUNT') return { kind: 'text', text: String(Math.round(value)) };
  const figures = stage.gradesSigFigs ? requiredSigFigs(problem, solution) : scratchSigFigs;
  const text = stage.gradesSigFigs
    ? formatUnambiguous(value, figures)
    : formatSigFigs(value, figures);
  return { kind: 'text', text: stage.needsUnit ? `${text} ${formatUnit(stage.unit)}` : text };
}

/** Re-exported for the tests and the harness, so there is one definition. */
export { formatUnit, sameUnit };
