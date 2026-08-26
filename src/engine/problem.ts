/**
 * problem.ts — what a problem IS, what its answer is, and what the generator
 * refuses to ask.
 *
 * THE TYPE IS THE WALL. A `Problem` carries only what a student is told: the
 * relation, the stated values, the units, the precision asked for. It carries
 * no answer, no intermediate and no prediction. `solve()` and everything in
 * `taxonomy.ts` are the GRADER's, and the separation is the reason `Problem`
 * and `Solution` are two types rather than one object with more fields on it.
 *
 * SCOPE. Seven topics, and the list is closed: rearranging a formula,
 * proportions and cross-multiplication, scientific notation, powers and roots,
 * fractions and reciprocals, dimensional analysis, and significant figures.
 * Every one of them is on the list because a student cannot do a stoichiometry
 * problem without it. Nothing else goes in without the teacher asking for it —
 * this is not a general algebra course and must never grow into one.
 *
 * THE GENERATION GUARANTEES ARE WHERE THE THESIS LIVES. A problem is refused
 * when two error classes would predict a value a student could not tell apart.
 * The fix for a collision is always to stop posing that problem, never to add a
 * tiebreak to the classifier — a tiebreak would mean guessing which
 * misconception somebody has, and a guess reported to a teacher as a diagnosis
 * is worse than saying nothing.
 *
 * PURE. No I/O, no globals, no clock.
 */

import {
  addSubtract,
  exact,
  formatSigFigs,
  formatUnambiguous,
  lastPlaceOf,
  magnitudeOf,
  measured,
  multiplyDivide,
  roundToSigFigs,
  sigFigsFrom,
  type Quantity,
} from '../num/sigfig.ts';
import {
  DIMENSIONLESS,
  divideUnits,
  formatUnit,
  multiplyUnits,
  parseUnit,
  runChain,
  sameUnit,
  type Factor,
  type UnitExpr,
} from '../num/units.ts';
import { makeRng, nextInt, pick, type Rng } from './rng.ts';
import {
  FACTOR_SEPARATION,
  MAX_ANSWER_SIG_FIGS,
  MAX_EVERYDAY,
  MAX_EXPONENT,
  MAX_GENERATION_ATTEMPTS,
  MIN_ANSWER_SIG_FIGS,
  MIN_EVERYDAY,
  MIN_EXPONENT,
  RATIO_MARGIN,
  UNITY_MARGIN,
} from './tolerance.ts';

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

/** The algebra chemistry actually needs. The list is closed on purpose. */
export type Topic =
  | 'REARRANGE'
  | 'PROPORTION'
  | 'SCINOT'
  | 'POWERS'
  | 'FRACTIONS'
  | 'UNITS'
  | 'SIGFIGS';

/** Every topic, in the order a course would meet them. */
export const TOPICS: readonly Topic[] = [
  'REARRANGE',
  'PROPORTION',
  'SCINOT',
  'POWERS',
  'FRACTIONS',
  'UNITS',
  'SIGFIGS',
];

/** What each topic is, in the words a student would use. */
export const TOPIC_NAMES: { readonly [K in Topic]: string } = {
  REARRANGE: 'rearranging a formula',
  PROPORTION: 'proportions and cross-multiplying',
  SCINOT: 'scientific notation',
  POWERS: 'powers and roots',
  FRACTIONS: 'fractions and rates',
  UNITS: 'cancelling units',
  SIGFIGS: 'significant figures',
};

/**
 * Difficulty within a topic. Three, not four: the third tier is where a
 * problem gains an extra link, an extra factor or an awkward precision, and a
 * fourth would be a difference nobody could name.
 */
export const TIERS: readonly number[] = [1, 2, 3];

/* ------------------------------------------------------------------ */
/* Stated values                                                       */
/* ------------------------------------------------------------------ */

/** A number the problem states, with its precision and its unit. */
export interface StatedValue {
  /** The symbol the problem writes it as — `P`, `[A]`, `c`. */
  readonly symbol: string;
  /** What it is, in words. */
  readonly label: string;
  /** The value, carrying how precisely it was stated. */
  readonly quantity: Quantity;
  /** How it is written on the page, at the precision it was stated to. */
  readonly written: string;
  /** Its unit. Dimensionless where it is a bare number. */
  readonly unit: UnitExpr;
}

function state(symbol: string, label: string, value: number, sigFigs: number, unit: string): StatedValue {
  const rounded = roundToSigFigs(value, sigFigs);
  return {
    symbol,
    label,
    quantity: measured(rounded, sigFigs),
    // UNAMBIGUOUS, not merely formatted. `20` written for a two-figure
    // measurement could be one figure or two, and `sigfig.ts` refuses to
    // resolve that on purpose — so a problem that states it that way is asking
    // a question it has not finished writing. `20.` is unmistakable.
    written: formatUnambiguous(rounded, sigFigs),
    unit: parseUnit(unit),
  };
}

/** A stated value that is exact — a count, a coefficient, a defined conversion. */
function stateExact(symbol: string, label: string, value: number, unit: string): StatedValue {
  return {
    symbol,
    label,
    quantity: exact(value),
    written: Number.isInteger(value) ? String(value) : String(value),
    unit: parseUnit(unit),
  };
}

/* ------------------------------------------------------------------ */
/* REARRANGE — the relations                                           */
/* ------------------------------------------------------------------ */

/** What one symbol in a relation means, and what values it can take. */
interface SymbolInfo {
  readonly name: string;
  readonly unit: string;
  /** The band a drawn value comes from. A constant has neither. */
  readonly min?: number;
  readonly max?: number;
  /** Set where the symbol is a published constant rather than a drawn value. */
  readonly constant?: number;
}

/**
 * A relation a student rearranges.
 *
 * `PRODUCT` is `∏left = ∏right` and covers almost everything chemistry uses.
 * `OFFSET` is `left = right + offset` and exists for the one conversion that
 * is not a product — Celsius to Kelvin — which is on the list because every
 * gas-law problem starts with it and getting its direction wrong is the single
 * commonest way a correct rearrangement still produces a wrong number.
 */
interface Relation {
  readonly id: string;
  readonly shape: 'PRODUCT' | 'OFFSET';
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly offset?: number;
  /** How it is written on the board. */
  readonly written: string;
  /** What it is for, in words. */
  readonly about: string;
  readonly symbols: Readonly<Record<string, SymbolInfo>>;
  /** The lowest tier this relation is posed at. */
  readonly tier: number;
}

/**
 * The relations, all of them from the course this is for.
 *
 * The ranges are a school laboratory's rather than arithmetic's. A generator
 * whose bounds come from what a float can hold poses a kilogram of propane,
 * and every one of those problems is correct — which is why no test objects.
 */
const RELATIONS: readonly Relation[] = [
  {
    id: 'MOLARITY',
    shape: 'PRODUCT',
    left: ['M', 'V'],
    right: ['n'],
    written: 'M × V = n',
    about: 'concentration, volume and moles',
    tier: 1,
    symbols: {
      M: { name: 'concentration', unit: 'mol/L', min: 0.05, max: 3 },
      V: { name: 'volume', unit: 'L', min: 0.05, max: 2.5 },
      n: { name: 'moles', unit: 'mol', min: 0.002, max: 8 },
    },
  },
  {
    id: 'DENSITY',
    shape: 'PRODUCT',
    left: ['d', 'V'],
    right: ['m'],
    written: 'd × V = m',
    about: 'density, volume and mass',
    tier: 1,
    symbols: {
      d: { name: 'density', unit: 'g/mL', min: 0.6, max: 14 },
      V: { name: 'volume', unit: 'mL', min: 2, max: 400 },
      m: { name: 'mass', unit: 'g', min: 1, max: 5000 },
    },
  },
  {
    id: 'MOLES_FROM_MASS',
    shape: 'PRODUCT',
    left: ['n', 'Mm'],
    right: ['m'],
    written: 'n × M = m',
    about: 'moles, molar mass and mass',
    tier: 1,
    symbols: {
      n: { name: 'moles', unit: 'mol', min: 0.01, max: 6 },
      Mm: { name: 'molar mass', unit: 'g/mol', min: 16, max: 260 },
      m: { name: 'mass', unit: 'g', min: 0.2, max: 1500 },
    },
  },
  {
    id: 'KELVIN',
    shape: 'OFFSET',
    left: ['TK'],
    right: ['TC'],
    offset: 273.15,
    written: 'T(K) = T(°C) + 273.15',
    about: 'Celsius and Kelvin',
    tier: 1,
    symbols: {
      TK: { name: 'temperature in kelvin', unit: 'K', min: 220, max: 620 },
      TC: { name: 'temperature in Celsius', unit: '°C', min: -50, max: 350 },
    },
  },
  {
    id: 'BOYLE',
    shape: 'PRODUCT',
    left: ['P1', 'V1'],
    right: ['P2', 'V2'],
    written: 'P₁V₁ = P₂V₂',
    about: 'a gas at two pressures',
    tier: 2,
    symbols: {
      P1: { name: 'the first pressure', unit: 'atm', min: 0.4, max: 6 },
      V1: { name: 'the first volume', unit: 'L', min: 0.5, max: 30 },
      P2: { name: 'the second pressure', unit: 'atm', min: 0.4, max: 6 },
      V2: { name: 'the second volume', unit: 'L', min: 0.5, max: 30 },
    },
  },
  {
    id: 'DILUTION',
    shape: 'PRODUCT',
    left: ['C1', 'Vd1'],
    right: ['C2', 'Vd2'],
    written: 'C₁V₁ = C₂V₂',
    about: 'diluting a stock solution',
    tier: 2,
    symbols: {
      C1: { name: 'the stock concentration', unit: 'mol/L', min: 0.5, max: 12 },
      Vd1: { name: 'the volume taken', unit: 'mL', min: 2, max: 250 },
      C2: { name: 'the final concentration', unit: 'mol/L', min: 0.01, max: 4 },
      Vd2: { name: 'the final volume', unit: 'mL', min: 10, max: 2000 },
    },
  },
  {
    id: 'HEAT',
    shape: 'PRODUCT',
    left: ['q'],
    right: ['m', 'c', 'dT'],
    written: 'q = m × c × ΔT',
    about: 'heat, mass, specific heat capacity and temperature change',
    tier: 3,
    symbols: {
      q: { name: 'the heat', unit: 'J', min: 5, max: 400000 },
      m: { name: 'mass', unit: 'g', min: 4, max: 600 },
      c: { name: 'specific heat capacity', unit: 'J/(g·K)', min: 0.12, max: 4.2 },
      dT: { name: 'the temperature change', unit: 'K', min: 2, max: 95 },
    },
  },
  {
    id: 'IDEAL_GAS',
    shape: 'PRODUCT',
    left: ['P', 'Vg'],
    right: ['ng', 'R', 'T'],
    written: 'PV = nRT',
    about: 'a gas at one set of conditions',
    tier: 3,
    symbols: {
      P: { name: 'pressure', unit: 'atm', min: 0.4, max: 6 },
      Vg: { name: 'volume', unit: 'L', min: 0.4, max: 40 },
      ng: { name: 'moles', unit: 'mol', min: 0.02, max: 6 },
      R: { name: 'the gas constant', unit: 'L·atm/(mol·K)', constant: 0.082057 },
      T: { name: 'temperature', unit: 'K', min: 240, max: 520 },
    },
  },
];

/** A relation by id, for the tests and the harness. */
export function relationById(id: string): Relation | undefined {
  return RELATIONS.find((r) => r.id === id);
}

/* ------------------------------------------------------------------ */
/* Problems                                                            */
/* ------------------------------------------------------------------ */

/** What every problem carries whatever its topic. */
interface ProblemBase {
  readonly topic: Topic;
  readonly tier: number;
  /** The seed this came from, so a student can go back to it. */
  readonly seed: string;
  /** How many significant figures the final answer is asked to. */
  readonly answerSigFigs: number;
  /** The question, in the student's words. */
  readonly prompt: string;
}

/** Rearrange a relation for one of its symbols, then evaluate it. */
export interface RearrangeProblem extends ProblemBase {
  readonly topic: 'REARRANGE';
  readonly relationId: string;
  /** The symbol to solve for. */
  readonly solveFor: string;
  /** Every other symbol, with the value the problem states for it. */
  readonly given: readonly StatedValue[];
}

/** A proportion. This is the mole ratio, written as algebra. */
export interface ProportionProblem extends ProblemBase {
  readonly topic: 'PROPORTION';
  /** The recipe: `from` of the first makes `to` of the second. */
  readonly from: StatedValue;
  readonly to: StatedValue;
  /** What the student actually has, in the first substance's unit. */
  readonly have: StatedValue;
  readonly fromName: string;
  readonly toName: string;
}

/** Multiply or divide two numbers written in scientific notation. */
export interface ScinotProblem extends ProblemBase {
  readonly topic: 'SCINOT';
  readonly operation: 'MULTIPLY' | 'DIVIDE';
  readonly firstMantissa: number;
  readonly firstExponent: number;
  readonly secondMantissa: number;
  readonly secondExponent: number;
  readonly firstLabel: string;
  readonly secondLabel: string;
  /** The unit the answer carries, which the notation does not touch. */
  readonly answerUnit: UnitExpr;
}

/** A power or a root, in the shape a rate law or an equilibrium puts it. */
export interface PowersProblem extends ProblemBase {
  readonly topic: 'POWERS';
  readonly direction: 'POWER' | 'ROOT';
  /** The coefficient in front. `POWER` only — a root problem has none. */
  readonly coefficient: StatedValue | null;
  /** The base, for a power. For a root this is the value being rooted. */
  readonly base: StatedValue;
  /** The exponent. Exact: it is counted, not measured. */
  readonly exponent: number;
  readonly answerUnit: UnitExpr;
  readonly baseName: string;
}

/** Dividing by a rate, which is what a per-unit quantity always is. */
export interface FractionsProblem extends ProblemBase {
  readonly topic: 'FRACTIONS';
  /** How much of the thing there is. */
  readonly amount: StatedValue;
  /** The rate — so much per unit of the answer. */
  readonly rate: StatedValue;
  readonly amountName: string;
  readonly rateName: string;
  readonly answerUnit: UnitExpr;
}

/** A chain of conversions, worked by watching the units cancel. */
export interface UnitsProblem extends ProblemBase {
  readonly topic: 'UNITS';
  readonly start: StatedValue;
  /** Every link, already the right way up. Which is what the student decides. */
  readonly factors: readonly Factor[];
  /** What the chain is asked to end in. */
  readonly wantedUnit: UnitExpr;
  readonly substance: string;
}

/**
 * Combining measurements and rounding ONCE, at the end.
 *
 * `ADD_THEN_MULTIPLY` is the case chemistry-education research reports students
 * failing most — a problem mixing an addition with a multiplication, where the
 * answer's precision is set by the DECIMAL PLACES of the sum first and then by
 * the SIGNIFICANT FIGURES of the product. The catalogued error is rounding on
 * the fewest significant figures among everything in sight, without ever asking
 * what the intermediate sum was entitled to.
 *
 * THE GENERATOR COULD NOT POSE IT, because this field read `'MULTIPLY' | 'ADD'`.
 * The type forbade the hardest case in the topic, and no sweep over generated
 * problems could have noticed — a sweep only ever sees what the generator can
 * make. It was found by reading the literature instead, which is the one
 * validation route that can find a MISSING case rather than confirming a
 * present one.
 */
export interface SigfigsProblem extends ProblemBase {
  readonly topic: 'SIGFIGS';
  readonly operation: 'MULTIPLY' | 'ADD' | 'ADD_THEN_MULTIPLY';
  readonly operands: readonly StatedValue[];
  readonly answerUnit: UnitExpr;
}

/** One problem. */
export type Problem =
  | RearrangeProblem
  | ProportionProblem
  | ScinotProblem
  | PowersProblem
  | FractionsProblem
  | UnitsProblem
  | SigfigsProblem;

/* ------------------------------------------------------------------ */
/* Solutions                                                           */
/* ------------------------------------------------------------------ */

/** Everything the grader knows and a screen must never be handed. */
export interface Solution {
  readonly topic: Topic;
  /** The final answer at full precision. */
  readonly answer: number;
  /** The unit the final answer carries. */
  readonly answerUnit: UnitExpr;
  /**
   * Named intermediates, keyed by stage. Every gated stage that asks for a
   * number reads its truth from here.
   */
  readonly at: Readonly<Record<string, number>>;
  /** The precision each intermediate is entitled to, where the rules give one. */
  readonly precisionAt: Readonly<Record<string, Quantity>>;
  /** Working the grader shows only after an attempt. */
  readonly working: readonly string[];
}

/** A generator that ran out of draws. */
export class GenerationError extends Error {
  readonly topic: Topic;
  readonly attempts: number;
  constructor(topic: Topic, attempts: number, detail: string) {
    super(`${topic}: gave up after ${attempts} attempts — ${detail}`);
    this.name = 'GenerationError';
    this.topic = topic;
    this.attempts = attempts;
  }
}

const productOf = (values: readonly number[]): number => values.reduce((a, b) => a * b, 1);

/** The value a stated symbol holds, by symbol name. */
function givenValue(problem: RearrangeProblem, symbol: string): number {
  const found = problem.given.find((g) => g.symbol === symbol);
  if (found === undefined) throw new RangeError(`${problem.relationId} states no ${symbol}`);
  return found.quantity.value;
}

/** The quantities of the stated values, for propagating precision. */
function givenQuantities(problem: RearrangeProblem): Quantity[] {
  return problem.given.map((g) => g.quantity);
}

/**
 * The factors the unknown has to be separated from, and the product it equals.
 *
 * This is the whole of rearranging, and it is computed rather than written per
 * relation — which is what makes the error predictions derivable instead of
 * hand-typed eight times over. `rest` is what sits beside the unknown on its
 * own side; `other` is everything on the far side.
 */
export function rearrangeParts(problem: RearrangeProblem): {
  readonly rest: readonly { symbol: string; value: number }[];
  readonly restProduct: number;
  readonly otherProduct: number;
  readonly relation: Relation;
} {
  const relation = relationById(problem.relationId);
  if (relation === undefined) throw new RangeError(`no relation ${problem.relationId}`);
  const onLeft = relation.left.includes(problem.solveFor);
  const same = onLeft ? relation.left : relation.right;
  const other = onLeft ? relation.right : relation.left;
  const rest = same
    .filter((s) => s !== problem.solveFor)
    .map((s) => ({ symbol: s, value: symbolValue(problem, relation, s) }));
  const otherProduct = productOf(other.map((s) => symbolValue(problem, relation, s)));
  return { rest, restProduct: productOf(rest.map((r) => r.value)), otherProduct, relation };
}

function symbolValue(problem: RearrangeProblem, relation: Relation, symbol: string): number {
  const info = relation.symbols[symbol];
  if (info?.constant !== undefined) return info.constant;
  return givenValue(problem, symbol);
}

/**
 * Work a problem out.
 *
 * PRECONDITION: `problem` came from {@link generateProblem}, so its guarantees
 * hold. This is the GRADER's function and must never be reachable from a path
 * that renders a problem — that separation is what `Problem` carrying no
 * answer is for.
 */
export function solve(problem: Problem): Solution {
  switch (problem.topic) {
    case 'REARRANGE':
      return solveRearrange(problem);
    case 'PROPORTION':
      return solveProportion(problem);
    case 'SCINOT':
      return solveScinot(problem);
    case 'POWERS':
      return solvePowers(problem);
    case 'FRACTIONS':
      return solveFractions(problem);
    case 'UNITS':
      return solveUnits(problem);
    case 'SIGFIGS':
      return solveSigfigs(problem);
  }
}

function unitOfSolveFor(problem: RearrangeProblem): UnitExpr {
  const relation = relationById(problem.relationId);
  return parseUnit(relation?.symbols[problem.solveFor]?.unit ?? '');
}

function solveRearrange(problem: RearrangeProblem): Solution {
  const { relation, rest, restProduct, otherProduct } = rearrangeParts(problem);
  const unit = unitOfSolveFor(problem);

  if (relation.shape === 'OFFSET') {
    const offset = relation.offset ?? 0;
    const onLeft = relation.left.includes(problem.solveFor);
    const other = (onLeft ? relation.right : relation.left)[0] as string;
    const otherValue = givenValue(problem, other);
    // left = right + offset, so isolating the LEFT symbol adds and isolating
    // the RIGHT symbol subtracts. Which of the two it is IS the question.
    const answer = onLeft ? otherValue + offset : otherValue - offset;
    return {
      topic: 'REARRANGE',
      answer,
      answerUnit: unit,
      at: { R1: answer, R3: answer },
      precisionAt: { R3: addSubtract(answer, [...givenQuantities(problem), exact(offset)]) },
      working: [
        `${relation.written}`,
        `${problem.solveFor} = ${other} ${onLeft ? '+' : '−'} ${offset}`,
      ],
    };
  }

  const answer = otherProduct / restProduct;
  const precision = multiplyDivide(answer, givenQuantities(problem));
  // R2 EXISTS ONLY WHERE IT IS A STAGE. With one factor beside the unknown
  // there is nothing to multiply together, so `stagesFor` does not ask — and an
  // `at` entry for a stage nobody is asked is a value with no question against
  // it. It also reads, to anything walking this map, exactly like an answer the
  // problem is carrying: with one factor its value IS one of the stated ones,
  // which is what made the check that walks this map report a leak.
  const at: Record<string, number> = rest.length >= 2 ? { R2: restProduct, R3: answer } : { R3: answer };
  return {
    topic: 'REARRANGE',
    answer,
    answerUnit: unit,
    at,
    precisionAt: {
      R2: multiplyDivide(restProduct, rest.map((r) => quantityOfSymbol(problem, r.symbol))),
      R3: precision,
    },
    working: [
      relation.written,
      `${problem.solveFor} = ${otherProduct} ÷ ${rest.map((r) => r.symbol).join(' ÷ ')}`,
    ],
  };
}

function quantityOfSymbol(problem: RearrangeProblem, symbol: string): Quantity {
  const found = problem.given.find((g) => g.symbol === symbol);
  if (found !== undefined) return found.quantity;
  const relation = relationById(problem.relationId);
  const constant = relation?.symbols[symbol]?.constant;
  // A published constant is quoted to more figures than any measurement in the
  // problem, so it is not what limits the answer. Treating it as exact is the
  // ordinary rule, and it is why the gas constant never sets the precision.
  return exact(constant ?? 1);
}

function solveProportion(problem: ProportionProblem): Solution {
  const from = problem.from.quantity.value;
  const to = problem.to.quantity.value;
  const have = problem.have.quantity.value;
  // The intermediate a student can actually name: how many times the recipe.
  const scale = have / from;
  const answer = scale * to;
  return {
    topic: 'PROPORTION',
    answer,
    answerUnit: problem.to.unit,
    at: { P1: scale, P2: answer },
    precisionAt: {
      P1: multiplyDivide(scale, [problem.have.quantity, problem.from.quantity]),
      P2: multiplyDivide(answer, [problem.have.quantity, problem.from.quantity, problem.to.quantity]),
    },
    working: [
      `${problem.from.written} ${problem.fromName} makes ${problem.to.written} ${problem.toName}`,
      `${problem.have.written} ÷ ${problem.from.written} = ${scale}`,
      `${scale} × ${problem.to.written} = ${answer}`,
    ],
  };
}

/** The mantissa and exponent of a value in normalised scientific notation. */
export function normalise(value: number): { mantissa: number; exponent: number } {
  if (value === 0) return { mantissa: 0, exponent: 0 };
  const exponent = magnitudeOf(value);
  return { mantissa: value / 10 ** exponent, exponent };
}

function solveScinot(problem: ScinotProblem): Solution {
  const rawMantissa =
    problem.operation === 'MULTIPLY'
      ? problem.firstMantissa * problem.secondMantissa
      : problem.firstMantissa / problem.secondMantissa;
  const rawExponent =
    problem.operation === 'MULTIPLY'
      ? problem.firstExponent + problem.secondExponent
      : problem.firstExponent - problem.secondExponent;
  const value = rawMantissa * 10 ** rawExponent;
  const { mantissa, exponent } = normalise(value);
  const precision = multiplyDivide(value, [
    measured(problem.firstMantissa, sigFigsOfMantissa(problem.firstMantissa)),
    measured(problem.secondMantissa, sigFigsOfMantissa(problem.secondMantissa)),
  ]);
  return {
    topic: 'SCINOT',
    answer: value,
    answerUnit: problem.answerUnit,
    at: { N1: rawExponent, N2: rawMantissa, N3: exponent, N4: value },
    precisionAt: { N4: precision },
    working: [
      `${problem.operation === 'MULTIPLY' ? 'multiplying' : 'dividing'} the mantissas: ${rawMantissa}`,
      `${problem.operation === 'MULTIPLY' ? 'adding' : 'subtracting'} the exponents: ${rawExponent}`,
      `normalised: ${mantissa} × 10^${exponent}`,
    ],
  };
}

/** How many figures a mantissa as written carries. */
function sigFigsOfMantissa(mantissa: number): number {
  const text = String(mantissa);
  const digits = text.replace('-', '').replace('.', '').replace(/^0+/, '');
  return Math.max(1, digits.length);
}

function solvePowers(problem: PowersProblem): Solution {
  const base = problem.base.quantity.value;
  const k = problem.coefficient?.quantity.value ?? 1;
  if (problem.direction === 'ROOT') {
    const answer = base ** (1 / problem.exponent);
    return {
      topic: 'POWERS',
      answer,
      answerUnit: problem.answerUnit,
      at: { W1: answer, W3: answer },
      precisionAt: { W3: multiplyDivide(answer, [problem.base.quantity]) },
      working: [`the ${problem.exponent === 2 ? 'square' : 'cube'} root of ${base} is ${answer}`],
    };
  }
  const power = base ** problem.exponent;
  const answer = k * power;
  return {
    topic: 'POWERS',
    answer,
    answerUnit: problem.answerUnit,
    at: { W1: power, W3: answer },
    precisionAt: {
      W1: multiplyDivide(power, [problem.base.quantity]),
      W3: multiplyDivide(answer, [problem.base.quantity, problem.coefficient?.quantity ?? exact(1)]),
    },
    working: [
      `${base} to the power ${problem.exponent} is ${power}`,
      `${k} × ${power} = ${answer}`,
    ],
  };
}

function solveFractions(problem: FractionsProblem): Solution {
  const amount = problem.amount.quantity.value;
  const rate = problem.rate.quantity.value;
  const answer = amount / rate;
  return {
    topic: 'FRACTIONS',
    answer,
    answerUnit: problem.answerUnit,
    at: { F2: answer },
    precisionAt: { F2: multiplyDivide(answer, [problem.amount.quantity, problem.rate.quantity]) },
    working: [
      `${problem.amount.written} ÷ ${problem.rate.written} = ${answer}`,
    ],
  };
}

function solveUnits(problem: UnitsProblem): Solution {
  const ran = runChain(problem.start.quantity.value, problem.start.unit, problem.factors);
  // U2 IS THE FIRST LINK ONLY, and the stage says so — "apply just that first
  // conversion". The first version put the WHOLE chain's value here while the
  // stage declared the first link's unit, so the harness printed
  // "1.95407755102e25 g" for 3.975 kg. Every test stayed green, because
  // `correctEntryFor` read this same field and `classify` compared against it:
  // the engine agreeing with itself about a number that was wrong. It was
  // caught by reading a session's output, which is the argument for having a
  // harness that prints one.
  const first = problem.factors[0];
  const afterFirst = first === undefined ? problem.start.quantity.value : problem.start.quantity.value * first.value;
  const at: Record<string, number> = { U2: afterFirst, U3: ran.value };
  const measuredOperands = [problem.start.quantity, ...problem.factors.map(() => exact(1))];
  return {
    topic: 'UNITS',
    answer: ran.value,
    answerUnit: ran.unit,
    at,
    precisionAt: { U3: multiplyDivide(ran.value, measuredOperands) },
    working: problem.factors.map(
      (f) => `× ${f.value} ${formatUnit(f.unit)} — ${f.label}`,
    ),
  };
}

/**
 * How many significant figures a combination is entitled to.
 *
 * Multiplication and division take the FEWEST significant figures among the
 * measured operands; addition and subtraction take the COARSEST last decimal
 * place. Using one rule where the other applies is a whole error class, so
 * both are computed here rather than one being assumed.
 */
function solveSigfigs(problem: SigfigsProblem): Solution {
  const values = problem.operands.map((o) => o.quantity.value);
  const quantities = problem.operands.map((o) => o.quantity);

  // THE MIXED SHAPE, and its precision is set in TWO steps: the sum's last
  // decimal place first, then the fewest significant figures between that sum
  // and the thing it multiplies. Neither step alone gives the right answer, and
  // taking the fewest figures among all three operands — the obvious shortcut —
  // is the misconception this shape exists to catch.
  if (problem.operation === 'ADD_THEN_MULTIPLY') {
    const first = quantities[0] as Quantity;
    const second = quantities[1] as Quantity;
    const third = quantities[2] as Quantity;
    const sumValue = (values[0] as number) + (values[1] as number);
    const sum = addSubtract(sumValue, [first, second]);
    const sumFigures = sum.kind === 'measured' ? sum.reading.sigFigs : problem.answerSigFigs;
    const mixedRaw = sumValue * (values[2] as number);
    // CARRIED, NOT ROUNDED. The sum enters the multiplication at full
    // precision; rounding it here would be E-SIG-ROUND-EARLY committed by the
    // grader itself.
    const mixedPrecision = multiplyDivide(mixedRaw, [sum, third]);
    const mixedFigures =
      mixedPrecision.kind === 'measured' ? mixedPrecision.reading.sigFigs : problem.answerSigFigs;
    return {
      topic: 'SIGFIGS',
      answer: roundToSigFigs(mixedRaw, mixedFigures),
      answerUnit: problem.answerUnit,
      at: {
        G1: countSigFigs(problem.operands[0] as StatedValue),
        Gs: sumFigures,
        G2: mixedFigures,
        G3: roundToSigFigs(mixedRaw, mixedFigures),
      },
      precisionAt: { Gs: sum, G3: mixedPrecision },
      working: [
        `the sum is ${sumValue}, and the addition rule limits its last decimal place`,
        `so the sum is entitled to ${sumFigures} significant figures`,
        `the product is ${mixedRaw}, entitled to ${mixedFigures}`,
      ],
    };
  }

  const raw =
    problem.operation === 'MULTIPLY'
      ? values.reduce((a, b) => a * b, 1)
      : values.reduce((a, b) => a + b, 0);
  const precision =
    problem.operation === 'MULTIPLY' ? multiplyDivide(raw, quantities) : addSubtract(raw, quantities);
  const figures = precision.kind === 'measured' ? precision.reading.sigFigs : problem.answerSigFigs;
  const answer = roundToSigFigs(raw, figures);
  return {
    topic: 'SIGFIGS',
    answer,
    answerUnit: problem.answerUnit,
    at: { G1: countSigFigs(problem.operands[0] as StatedValue), G2: figures, G3: answer },
    precisionAt: { G3: precision },
    working: [
      `${problem.operation === 'MULTIPLY' ? 'the product' : 'the sum'} is ${raw}`,
      `it is entitled to ${figures} significant figures`,
    ],
  };
}

/** How many significant figures a stated value carries. */
export function countSigFigs(value: StatedValue): number {
  const q = value.quantity;
  if (q.kind === 'measured') return q.reading.sigFigs;
  if (q.kind === 'ambiguous') return q.low.sigFigs;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Generation guarantees                                               */
/* ------------------------------------------------------------------ */

/**
 * Every condition the generator refuses to break, named.
 *
 * READ THIS BEFORE ADDING ONE. A guarantee is a condition on the problem's own
 * STATED VALUES, and it is stated that way on purpose: a guarantee written as
 * "no two predictions land on the same number" would make the collision sweep
 * circular — the sweep would be re-running the generator's own test and
 * reporting zero because it could not have reported anything else (hub LESSONS
 * 141). The sweep's value is in the pairs no guarantee mentions.
 *
 * `PREDICTIONS_SEPARATED` is the one exception, and it is named separately for
 * exactly that reason. It is a backstop for rare degenerate draws in the two
 * topics whose class pairs have no clean algebraic separator, and the sweep
 * REPORTS how many problems each guarantee rejected — so if that one is doing
 * the work rather than catching stragglers, the number says so out loud.
 */
export type Guarantee =
  /** REARRANGE: some product of the stated values would make two classes agree. */
  | 'NO_DEGENERATE_PRODUCT'
  /** REARRANGE, OFFSET only: the two directions must not land on the same number. */
  | 'OFFSET_DIRECTIONS_SEPARATE'
  /** PROPORTION: a 1:1 ratio makes right, upside-down and ignored all one answer. */
  | 'RATIO_NOT_UNITY'
  /** PROPORTION: what you have must differ from what the recipe takes. */
  | 'SCALE_NOT_RECIPE'
  /** SCINOT: the sum, difference and product of the exponents must be three numbers. */
  | 'EXPONENTS_NOT_DEGENERATE'
  /** SCINOT: the combination must actually need renormalising, or must clearly not. */
  | 'NORMALISATION_DECIDABLE'
  /** SCINOT: doing the exponent rule to the front numbers must give a different one. */
  | 'MANTISSA_OPS_SEPARATE'
  /** POWERS: a coefficient of 1 makes raising it and not raising it the same. */
  | 'COEFFICIENT_NOT_UNITY'
  /** POWERS: a base of 1 makes every power and every root of it the same. */
  | 'BASE_NOT_UNITY'
  /** FRACTIONS: a rate of 1 makes multiplying by it and dividing by it the same. */
  | 'RATE_NOT_UNITY'
  /** FRACTIONS: an amount equal to the rate makes the reciprocal error invisible. */
  | 'AMOUNT_NOT_RATE'
  /** UNITS: two equal links make "dropped this one" name two of them. */
  | 'FACTORS_SEPARATED'
  /** UNITS: a link of 1 does nothing, so leaving it out is not an error. */
  | 'NO_FACTOR_NEAR_UNITY'
  /** UNITS: a chain multiplying to 1 puts the whole-chain-inverted mistake on the answer. */
  | 'CHAIN_PRODUCT_NOT_UNITY'
  /** SIGFIGS: the two rules must give different figure counts, or the topic is moot. */
  | 'SIGFIG_RULES_DISAGREE'
  /** SIGFIGS: rounding to the wrong count must change the number. */
  | 'ROUNDING_IS_VISIBLE'
  /** Every stated and computed value sits in a range somebody could measure. */
  | 'PHYSICALLY_REAL'
  /** The backstop. Named apart because it is the one that can go circular. */
  | 'PREDICTIONS_SEPARATED';

const nearUnity = (value: number, margin: number): boolean => Math.abs(Math.abs(value) - 1) < margin;

/** True where two positive values are within a margin of each other, as a ratio. */
function withinRatio(a: number, b: number, margin: number): boolean {
  if (a === 0 || b === 0) return a === b;
  const ratio = Math.abs(a / b);
  return Math.abs(ratio - 1) < margin;
}

/** True where two values would round to the same thing at `sigFigs`. */
export function sameAtPrecision(a: number, b: number, sigFigs: number): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return roundToSigFigs(a, sigFigs) === roundToSigFigs(b, sigFigs);
}

/** True where a value is one somebody could measure in a school laboratory. */
function physicallyReal(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const magnitude = Math.abs(value);
  return magnitude >= MIN_EVERYDAY && magnitude <= MAX_EVERYDAY;
}

/**
 * Every guarantee this problem breaks. An empty list is a problem worth posing.
 *
 * PRECONDITION: none. Safe to call on a candidate that has not been accepted —
 * which is the whole of what it is for.
 */
export function checkGuarantees(problem: Problem): Guarantee[] {
  const broken: Guarantee[] = [];
  const sf = problem.answerSigFigs;

  switch (problem.topic) {
    case 'REARRANGE': {
      const relation = relationById(problem.relationId);
      if (relation === undefined) return ['PHYSICALLY_REAL'];
      if (relation.shape === 'OFFSET') {
        const solution = solve(problem);
        const other = (relation.left.includes(problem.solveFor) ? relation.right : relation.left)[0] as string;
        const otherValue = givenValue(problem, other);
        const offset = relation.offset ?? 0;
        const wrongWay = relation.left.includes(problem.solveFor) ? otherValue - offset : otherValue + offset;
        // The sign error has to produce a different number. It does unless the
        // offset is zero, but a temperature that lands both ways inside one
        // rounding step is still a problem that cannot teach the direction.
        if (sameAtPrecision(solution.answer, wrongWay, sf)) broken.push('OFFSET_DIRECTIONS_SEPARATE');
        if (!Number.isFinite(solution.answer)) broken.push('PHYSICALLY_REAL');
        const info = relation.symbols[problem.solveFor];
        if (info?.min !== undefined && info.max !== undefined) {
          if (solution.answer < info.min || solution.answer > info.max) broken.push('PHYSICALLY_REAL');
        }
        return broken;
      }

      // THE ALGEBRA, worked out once here so the conditions are conditions on
      // the stated numbers rather than a comparison of predicted values.
      //
      // With A the correct answer, R the product of the factors beside the
      // unknown, O the product of the far side (so O = A·R), and f each factor
      // in R, the four predictions are:
      //
      //   correct       A            multiplied   A·R²        (moved R across
      //   inverted      1/A          partial_i    A·f_i         by multiplying)
      //
      // and every pair agrees exactly when one of these is 1:
      //
      //   multiplied = correct   ⟺  R² = 1     ⟺  R = 1
      //   inverted   = correct   ⟺  A² = 1     ⟺  A = 1
      //   multiplied = inverted  ⟺  A²R² = 1   ⟺  O = 1
      //   partial_i  = correct   ⟺  f_i = 1
      //   partial_i  = multiplied ⟺ f_i = R²
      //   partial_i  = inverted  ⟺  A²·f_i = 1
      const { rest, restProduct, otherProduct } = rearrangeParts(problem);
      const answer = otherProduct / restProduct;
      if (!Number.isFinite(answer) || answer <= 0) return ['PHYSICALLY_REAL'];
      if (nearUnity(restProduct, UNITY_MARGIN)) broken.push('NO_DEGENERATE_PRODUCT');
      if (nearUnity(answer, UNITY_MARGIN)) broken.push('NO_DEGENERATE_PRODUCT');
      if (nearUnity(otherProduct, UNITY_MARGIN)) broken.push('NO_DEGENERATE_PRODUCT');
      for (const factor of rest) {
        if (nearUnity(factor.value, UNITY_MARGIN)) broken.push('NO_DEGENERATE_PRODUCT');
        if (withinRatio(factor.value, restProduct * restProduct, UNITY_MARGIN)) {
          broken.push('NO_DEGENERATE_PRODUCT');
        }
        if (withinRatio(answer * answer * factor.value, 1, UNITY_MARGIN)) {
          broken.push('NO_DEGENERATE_PRODUCT');
        }
      }
      // Two factors of equal value make "you dropped this one" name both.
      for (let i = 0; i < rest.length; i += 1) {
        for (let j = i + 1; j < rest.length; j += 1) {
          if (withinRatio((rest[i] as { value: number }).value, (rest[j] as { value: number }).value, FACTOR_SEPARATION)) {
            broken.push('FACTORS_SEPARATED');
          }
        }
      }
      if (!physicallyReal(answer)) broken.push('PHYSICALLY_REAL');
      const info = relation.symbols[problem.solveFor];
      if (info?.min !== undefined && info.max !== undefined) {
        if (answer < info.min || answer > info.max) broken.push('PHYSICALLY_REAL');
      }
      return broken;
    }

    case 'PROPORTION': {
      const from = problem.from.quantity.value;
      const to = problem.to.quantity.value;
      const have = problem.have.quantity.value;
      // A 1:1 ratio collapses three misconceptions onto the right answer:
      // using the ratio upside down, ignoring it, and getting it right all
      // produce the same number. That is not a hard problem, it is a problem
      // that cannot tell you anything.
      //
      // EXACT, NOT A MARGIN, because a mole ratio is COUNTED — the two numbers
      // are coefficients from a balanced equation and there is no measurement
      // in them to be near anything. A margin here did real damage: at 0.2 it
      // refused the 4:5 recipe, which is a perfectly good proportion to teach
      // with, and it refused it by a floating-point hair (|0.8 − 1| computes as
      // 0.19999999999999996). A tolerance on a counted thing is a tolerance
      // with nothing to absorb.
      //
      // AND IT OVERLAPS THE ONE BELOW. At a = b the additive answer IS the
      // correct answer, so `SCALE_NOT_RECIPE` refuses the same candidates —
      // which means removing either of these alone changes nothing the
      // generator poses, and a plant that removes one proves nothing. Removing
      // BOTH moves two measurements: one collision appears, and the share of
      // stages that can attribute nothing goes from 9.30% to 10.52%. Written
      // down because the overlap is invisible from either line on its own.
      if (from === to) broken.push('RATIO_NOT_UNITY');
      // The additive misconception — "add the difference between the two
      // numbers" — lands on the right answer exactly when what you have equals
      // what the recipe takes. Worked out by hand:
      //
      //     c + b − a = cb/a   ⟺   (c − a)(b − a) = 0
      //
      // and b ≠ a is already guaranteed above. So the GAP between the two is
      // (c − a)(b − a)/a — which is why a margin on c/a alone was the wrong
      // shape and let a real collision through: it does not mention b at all,
      // so a ratio only a little away from one shrinks the gap however far c
      // sits from a. With a = 4, b = 5, c = 4.99 and two significant figures
      // asked for, the additive answer and the correct one are both 6.0.
      //
      // Stated as a separation between two values rather than as a band, since
      // the quantity that has to be big enough is the gap itself.
      const answer = (have / from) * to;
      if (indistinguishable(have + to - from, answer, sf)) broken.push('SCALE_NOT_RECIPE');
      // And rounding the scale on the way through sits within a rounding step
      // of the correct answer, so it needs the same separation from the
      // additive one that the correct answer does.
      const earlyScale = roundToSigFigs(have / from, sf);
      if (indistinguishable(have + to - from, roundToSigFigs(earlyScale * to, sf), sf)) {
        broken.push('SCALE_NOT_RECIPE');
      }
      if (!physicallyReal(answer)) broken.push('PHYSICALLY_REAL');
      return broken;
    }

    case 'SCINOT': {
      const e1 = problem.firstExponent;
      const e2 = problem.secondExponent;
      // WORKED OUT BY HAND, over the integers, so this is a condition on the
      // exponents and not a comparison of predictions.
      //
      //   e1 + e2 = e1 · e2   has integer solutions only at (0,0) and (2,2)
      //   e1 − e2 = e1 · e2   only at (0,0) and (−2,2)
      //   e1 + e2 = e1 − e2   only where e2 = 0
      //
      // So requiring both exponents non-zero and ruling out |e1| = |e2| = 2
      // separates the sum, the difference and the product for every pair this
      // will ever draw.
      if (e1 === 0 || e2 === 0) broken.push('EXPONENTS_NOT_DEGENERATE');
      if (Math.abs(e1) === 2 && Math.abs(e2) === 2) broken.push('EXPONENTS_NOT_DEGENERATE');
      // AND A MARGIN OF TWO, not one, because renormalising moves the answer's
      // exponent by one either way. Requiring only that the product differ
      // from the sum lets "multiplied the exponents" land exactly where
      // "shifted the decimal point without moving the exponent" lands — twelve
      // times in a forty-problem sweep, at the last stage, where every mistake
      // in the topic shows up at once.
      const combined = problem.operation === 'MULTIPLY' ? e1 + e2 : e1 - e2;
      if (Math.abs(e1 * e2 - combined) < 2) broken.push('EXPONENTS_NOT_DEGENERATE');
      const rawMantissa =
        problem.operation === 'MULTIPLY'
          ? problem.firstMantissa * problem.secondMantissa
          : problem.firstMantissa / problem.secondMantissa;
      // Renormalising is a step, and a step that sometimes is not there cannot
      // be graded. A raw mantissa sitting right on 10 or right on 1 makes
      // "does this need shifting" a coin toss rather than a reading.
      if (withinRatio(rawMantissa, 10, UNITY_MARGIN / 2)) broken.push('NORMALISATION_DECIDABLE');
      if (withinRatio(rawMantissa, 1, UNITY_MARGIN / 2)) broken.push('NORMALISATION_DECIDABLE');
      // Doing to the front numbers what belongs to the exponents lands on the
      // right front number exactly when m1·m2 = m1+m2 — which has real
      // solutions, so it is drawn against rather than reasoned away.
      const wrongMantissa =
        problem.operation === 'MULTIPLY'
          ? problem.firstMantissa + problem.secondMantissa
          : problem.firstMantissa - problem.secondMantissa;
      if (withinRatio(wrongMantissa, rawMantissa, RATIO_MARGIN)) broken.push('MANTISSA_OPS_SEPARATE');
      const value = rawMantissa * 10 ** combined;
      if (!Number.isFinite(value) || value === 0) broken.push('PHYSICALLY_REAL');
      return broken;
    }

    case 'POWERS': {
      const base = problem.base.quantity.value;
      const k = problem.coefficient?.quantity.value ?? 1;
      // Raising the coefficient as well as the base gives k^n·x^n where k·x^n
      // is wanted, and those agree exactly when k = 1.
      if (problem.direction === 'POWER' && nearUnity(k, UNITY_MARGIN)) broken.push('COEFFICIENT_NOT_UNITY');
      // A base of 1 is every power and every root of itself.
      if (nearUnity(base, UNITY_MARGIN)) broken.push('BASE_NOT_UNITY');
      if (problem.exponent < 2) broken.push('BASE_NOT_UNITY');
      const solution = solve(problem);
      if (!Number.isFinite(solution.answer) || solution.answer <= 0) broken.push('PHYSICALLY_REAL');

      // THE BACKSTOP, and this is the one topic that needs it.
      //
      // Every other topic's class pairs agree at a point that can be written
      // down — a ratio of 1, a factor equal to another factor, an exponent of
      // zero. POWERS does not: `x·n = n^x` and `k·x·n = k^n·x^n` have no
      // solutions a generator can be told to avoid, only ones it has to look
      // for. So the four values are compared directly here.
      //
      // That is the shape that can make a collision sweep circular, which is
      // why it is a NAMED guarantee and why the sweep prints how often it
      // fires. The draw bands do the separating — a base well below 1 and a
      // coefficient nowhere near it — and this catches the stragglers. If its
      // count ever stops being small, the bands have stopped working and the
      // answer is to fix them, not to widen this.
      //
      // BOTH STAGES, not only the last one. The first version checked the
      // final answer's candidates and missed the stage that asks for the power
      // on its own — where the coefficient is not there to pull the values
      // apart, and `base × n` and `the nth root of base` collided twice in
      // 4200 problems.
      const withCoefficient =
        problem.direction === 'POWER'
          ? [
              solution.answer,
              k * base * problem.exponent,
              k * base ** (1 / problem.exponent),
              k * problem.exponent ** base,
              (k * base) ** problem.exponent,
            ]
          : [solution.answer, base / problem.exponent, base ** problem.exponent];
      const bare =
        problem.direction === 'POWER'
          ? [
              base ** problem.exponent,
              base * problem.exponent,
              base ** (1 / problem.exponent),
              problem.exponent ** base,
            ]
          : [];
      if (!predictionsSeparated(withCoefficient, sf) || !predictionsSeparated(bare, sf)) {
        broken.push('PREDICTIONS_SEPARATED');
      }
      return broken;
    }

    case 'FRACTIONS': {
      const amount = problem.amount.quantity.value;
      const rate = problem.rate.quantity.value;
      // Multiplying by a rate and dividing by it agree exactly when the rate
      // is 1, and ignoring it agrees with dividing by it at the same point.
      if (nearUnity(rate, UNITY_MARGIN)) broken.push('RATE_NOT_UNITY');
      // Taking the reciprocal of the answer gives rate/amount where
      // amount/rate is wanted; the two agree when amount = rate.
      if (withinRatio(amount, rate, RATIO_MARGIN)) broken.push('AMOUNT_NOT_RATE');
      // Writing the answer upside down and never using the rate at all are the
      // same number when rate = amount²; multiplying by the rate and writing
      // the answer upside down are the same when amount = 1. Both worked out
      // by hand from `rate/amount = amount` and `amount·rate = rate/amount`.
      if (withinRatio(rate, amount * amount, RATIO_MARGIN)) broken.push('AMOUNT_NOT_RATE');
      if (nearUnity(amount, UNITY_MARGIN)) broken.push('AMOUNT_NOT_RATE');
      const answer = amount / rate;
      if (!physicallyReal(answer)) broken.push('PHYSICALLY_REAL');
      return broken;
    }

    case 'UNITS': {
      const factors = problem.factors;
      for (const factor of factors) {
        // A link whose value is 1 converts nothing, so leaving it out is not a
        // mistake and turning it upside down is not either.
        if (nearUnity(factor.value, UNITY_MARGIN)) broken.push('NO_FACTOR_NEAR_UNITY');
      }
      for (let i = 0; i < factors.length; i += 1) {
        for (let j = i + 1; j < factors.length; j += 1) {
          const a = (factors[i] as Factor).value;
          const b = (factors[j] as Factor).value;
          // Dropping A and dropping B are the same number when A = B, so the
          // diagnosis would name two links and mean one.
          if (withinRatio(a, b, FACTOR_SEPARATION)) broken.push('FACTORS_SEPARATED');
          // Dropping A and inverting B are the same number when A = B².
          if (withinRatio(a, b * b, FACTOR_SEPARATION)) broken.push('FACTORS_SEPARATED');
          if (withinRatio(b, a * a, FACTOR_SEPARATION)) broken.push('FACTORS_SEPARATED');
        }
      }
      // TURNING THE WHOLE CHAIN UPSIDE DOWN divides the answer by the square of
      // the chain's product, so a chain whose factors multiply to about 1 puts
      // that mistake back on the correct answer. Found by the sweep on a real
      // one: 1.98 g/mL × (1/44.01) mol/g × 22.414 L/mol comes to 1.0084, and
      // at two significant figures the inverted chain and the correct answer
      // are the same number. It is not a near-miss to be tolerated — the whole
      // chain being upside down is one of the three things this topic is for.
      const chainProduct = factors.reduce((a, f) => a * f.value, 1);
      if (nearUnity(chainProduct, UNITY_MARGIN)) broken.push('CHAIN_PRODUCT_NOT_UNITY');
      const ran = runChain(problem.start.quantity.value, problem.start.unit, factors);
      if (!sameUnit(ran.unit, problem.wantedUnit)) broken.push('PHYSICALLY_REAL');
      if (!Number.isFinite(ran.value) || ran.value === 0) broken.push('PHYSICALLY_REAL');
      return broken;
    }

    case 'SIGFIGS': {
      const quantities = problem.operands.map((o) => o.quantity);
      const values = problem.operands.map((o) => o.quantity.value);

      // THE MIXED SHAPE HAS ITS OWN PAIR OF RULES, and the "wrong" one is not
      // the other rule applied to everything — it is the shortcut students
      // actually take: round on the fewest significant figures in sight and
      // never ask what the intermediate sum was entitled to.
      if (problem.operation === 'ADD_THEN_MULTIPLY') {
        const solution = solve(problem);
        const rightMixed = solution.at['G2'];
        const shortcut = Math.min(...problem.operands.map((o) => countSigFigs(o)));
        const rawMixed = ((values[0] as number) + (values[1] as number)) * (values[2] as number);
        if (rightMixed === undefined || rightMixed < 1) broken.push('SIGFIG_RULES_DISAGREE');
        else if (rightMixed === shortcut) broken.push('SIGFIG_RULES_DISAGREE');
        else if (
          sameAtPrecision(
            roundToSigFigs(rawMixed, rightMixed),
            roundToSigFigs(rawMixed, shortcut),
            MAX_ANSWER_SIG_FIGS + 2,
          )
        ) {
          broken.push('ROUNDING_IS_VISIBLE');
        }
        // The sum has to HAVE an entitlement, and that is all this asks.
        //
        // It briefly also demanded that the sum's figure count DIFFER from the
        // answer's, on the reasoning that otherwise the two-step reading and
        // the one-step reading agree. That reasoning was wrong twice over: the
        // two are different QUESTIONS that may share an answer, and requiring
        // them to differ made the shape almost unreachable — three problems in
        // six hundred, which is a case that exists in the type and not in
        // practice. A guarantee that starves a generator is not protecting
        // anybody from anything.
        const sumFigures = solution.at['Gs'];
        if (sumFigures === undefined || sumFigures < 1) broken.push('SIGFIG_RULES_DISAGREE');
        if (!physicallyReal(rawMixed)) broken.push('PHYSICALLY_REAL');

        // THE BACKSTOP, and this shape is the third topic to need it.
        //
        // Rounding the intermediate sum early and applying the wrong rule both
        // amount to carrying fewer digits through the multiplication, so they
        // land on the same number more often than not — twelve collisions in a
        // 10,500-problem sweep the first time this shape was posed. There is no
        // relation between the two that a generator can be told to avoid, only
        // one it has to look for.
        if (sumFigures !== undefined) {
          const earlySum = roundToSigFigs((values[0] as number) + (values[1] as number), sumFigures);
          const rightCandidate = rightMixed === undefined ? rawMixed : roundToSigFigs(rawMixed, rightMixed);
          const candidates = [
            rightCandidate,
            roundToSigFigs(rawMixed, shortcut),
            roundToSigFigs(earlySum * (values[2] as number), rightMixed ?? MAX_ANSWER_SIG_FIGS),
          ];
          const distinct = candidates.filter(
            (v, i) => i === 0 || !indistinguishable(v, candidates[0] as number, rightMixed ?? MAX_ANSWER_SIG_FIGS),
          );
          if (!predictionsSeparated(distinct, rightMixed ?? MAX_ANSWER_SIG_FIGS)) {
            broken.push('PREDICTIONS_SEPARATED');
          }
        }
        return broken;
      }

      const raw =
        problem.operation === 'MULTIPLY'
          ? values.reduce((a, b) => a * b, 1)
          : values.reduce((a, b) => a + b, 0);
      const byMultiply = multiplyDivide(raw, quantities);
      const byAdd = addSubtract(raw, quantities);
      const rightCount = byMultiply.kind === 'measured' ? byMultiply.reading.sigFigs : 0;
      const wrongCount = byAdd.kind === 'measured' ? byAdd.reading.sigFigs : 0;
      // Applying the wrong rule has to produce a different figure count, or
      // the topic has nothing to teach on this problem.
      if (rightCount === wrongCount) broken.push('SIGFIG_RULES_DISAGREE');
      if (rightCount < 1 || wrongCount < 1) broken.push('SIGFIG_RULES_DISAGREE');
      // And the different count has to produce a different NUMBER. Rounding
      // 42.0 to two figures and to three is 42 either way, so a student who
      // got the rule wrong would write the right answer.
      const correctCount = problem.operation === 'MULTIPLY' ? rightCount : wrongCount;
      const otherCount = problem.operation === 'MULTIPLY' ? wrongCount : rightCount;
      if (sameAtPrecision(roundToSigFigs(raw, correctCount), roundToSigFigs(raw, otherCount), MAX_ANSWER_SIG_FIGS + 2)) {
        broken.push('ROUNDING_IS_VISIBLE');
      }
      if (!physicallyReal(raw)) broken.push('PHYSICALLY_REAL');

      // THE BACKSTOP AGAIN, and this is the second and last topic that needs
      // it. Rounding on the way through and applying the wrong rule are two
      // different computations over the same measurements, and where they
      // land relative to each other depends on digits rather than on any
      // relation anybody can write down. One collision in 840 problems, which
      // is what a coincidence looks like — but a coincidence reported to a
      // teacher as a diagnosis is still a guess.
      const roundedEarly = values.map((v) => roundToSigFigs(v, correctCount));
      const earlyRaw =
        problem.operation === 'MULTIPLY'
          ? roundedEarly.reduce((a, b) => a * b, 1)
          : roundedEarly.reduce((a, b) => a + b, 0);
      const candidates = [
        roundToSigFigs(raw, correctCount),
        roundToSigFigs(raw, otherCount),
        roundToSigFigs(earlyRaw, correctCount),
      ];
      // A round-early value that lands on the correct answer is not a
      // collision — it is a prediction that gets DROPPED, because a mistake
      // producing the right number is not something this can attribute. So the
      // pair is only compared where it is genuinely a third value.
      const distinct = candidates.filter(
        (v, i) => i === 0 || !indistinguishable(v, candidates[0] as number, correctCount),
      );
      if (!predictionsSeparated(distinct, correctCount)) broken.push('PREDICTIONS_SEPARATED');
      return broken;
    }
  }
}

/**
 * True where two values are ones a student could write the same answer to.
 *
 * AT THE PROBLEM'S OWN PRECISION, which is the precision everything else is
 * judged at — see the note at the head of `tolerance.ts`. A pair that differs
 * here is a pair the classifier can tell apart; a pair that does not is a
 * collision and a defect.
 */
export function indistinguishable(a: number, b: number, sigFigs: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return sameAtPrecision(a, b, sigFigs);
}

/**
 * The backstop, applied after the structural guarantees have had their say.
 *
 * It compares the predicted values at one stage directly, which is the one
 * shape that can make a collision sweep circular — so it is separate, it is
 * named, and the sweep counts how often it fires. If that count is not small,
 * the structural guarantees are not doing the work and the decomposition needs
 * attention rather than a wider margin.
 */
export function predictionsSeparated(values: readonly number[], sigFigs: number): boolean {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (indistinguishable(values[i] as number, values[j] as number, sigFigs)) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

/** A draw from a band, at a stated precision. */
function drawValue(rng: Rng, min: number, max: number, sigFigs: number): number {
  const span = max - min;
  const steps = 10000;
  const raw = min + (nextInt(rng, 0, steps) / steps) * span;
  return roundToSigFigs(raw, sigFigs);
}

function drawSigFigs(rng: Rng): number {
  return nextInt(rng, MIN_ANSWER_SIG_FIGS, MAX_ANSWER_SIG_FIGS);
}

/** Which guarantee each rejected candidate broke, for the sweep to report. */
export interface GenerationReport {
  readonly attempts: number;
  readonly rejected: Readonly<Record<string, number>>;
}

/**
 * How many generation reports to keep before evicting the oldest.
 *
 * BOUNDED BECAUSE OF THE DRILL. This map is diagnostic only — the sweep reads
 * an entry immediately after generating the problem it belongs to — but it is
 * module-level and it used to grow forever. A single-skill drill is a loop
 * around the generator with nothing recorded, which is exactly what makes it
 * cheap to build; a loop around a generator that leaks 1.4 KB a problem is not
 * cheap, it is a page that gets slower the longer somebody practises. Measured
 * at 2.8 MB over two thousand problems before this bound existed.
 */
const MAX_REPORTS = 4096;

const REPORTS = new Map<string, { attempts: number; rejected: Record<string, number> }>();

/**
 * What the generator threw away on its way to this problem, and why.
 *
 * PRECONDITION: {@link generateProblem} was called with the same arguments,
 * and fewer than {@link MAX_REPORTS} problems have been generated since. Read
 * it straight after generating, which is what the sweep does. Kept for that
 * sweep, which reports rejection counts by guarantee — the number that says
 * whether the structural guarantees or the backstop are doing the separating.
 */
export function generationReport(assignmentKey: string, topic: Topic, tier: number, index: number): GenerationReport {
  const key = `${assignmentKey}|${topic}|${tier}|${index}`;
  const found = REPORTS.get(key);
  return found === undefined ? { attempts: 0, rejected: {} } : { attempts: found.attempts, rejected: found.rejected };
}

/**
 * Generate one problem.
 *
 * PRECONDITION: `topic` is one of {@link TOPICS} and `tier` one of
 * {@link TIERS}. Deterministic: the same arguments always produce the same
 * problem, on every device, which is what lets a teacher write one key on the
 * board and a class of thirty work the same set.
 *
 * Throws {@link GenerationError} rather than lowering a guarantee. A generator
 * that relaxes its own conditions to find something to pose is a generator that
 * poses the problem the guarantee existed to refuse.
 */
export function generateProblem(assignmentKey: string, topic: Topic, tier: number, index: number): Problem {
  const key = `${assignmentKey}|${topic}|${tier}|${index}`;
  const rng = makeRng(key);
  const rejected: Record<string, number> = {};
  let lastBroken: Guarantee[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = draft(rng, topic, tier, key);
    if (candidate === null) continue;
    const broken = checkGuarantees(candidate);
    if (broken.length > 0) {
      lastBroken = broken;
      for (const name of new Set(broken)) rejected[name] = (rejected[name] ?? 0) + 1;
      continue;
    }
    if (REPORTS.size >= MAX_REPORTS) {
      // Oldest first: a Map iterates in insertion order, so the first key is
      // the least recently generated.
      const oldest = REPORTS.keys().next();
      if (!oldest.done) REPORTS.delete(oldest.value);
    }
    REPORTS.set(key, { attempts: attempt + 1, rejected });
    return candidate;
  }
  throw new GenerationError(topic, MAX_GENERATION_ATTEMPTS, `last rejected for ${lastBroken.join(', ') || 'nothing drawable'}`);
}

/** Every problem for one topic and tier, from one key. */
export function generateSet(assignmentKey: string, topic: Topic, tier: number, count: number): Problem[] {
  const out: Problem[] = [];
  for (let i = 0; i < count; i += 1) out.push(generateProblem(assignmentKey, topic, tier, i));
  return out;
}

/** One candidate, before the guarantees have seen it. */
function draft(rng: Rng, topic: Topic, tier: number, seed: string): Problem | null {
  switch (topic) {
    case 'REARRANGE':
      return draftRearrange(rng, tier, seed);
    case 'PROPORTION':
      return draftProportion(rng, tier, seed);
    case 'SCINOT':
      return draftScinot(rng, tier, seed);
    case 'POWERS':
      return draftPowers(rng, tier, seed);
    case 'FRACTIONS':
      return draftFractions(rng, tier, seed);
    case 'UNITS':
      return draftUnits(rng, tier, seed);
    case 'SIGFIGS':
      return draftSigfigs(rng, tier, seed);
  }
}

function draftRearrange(rng: Rng, tier: number, seed: string): Problem | null {
  const available = RELATIONS.filter((r) => r.tier <= tier);
  if (available.length === 0) return null;
  const relation = pick(rng, available);
  const solvable = [...relation.left, ...relation.right].filter(
    (s) => relation.symbols[s]?.constant === undefined,
  );
  const solveFor = pick(rng, solvable);
  const answerSigFigs = drawSigFigs(rng);

  const given: StatedValue[] = [];
  for (const symbol of [...relation.left, ...relation.right]) {
    if (symbol === solveFor) continue;
    const info = relation.symbols[symbol];
    if (info === undefined) return null;
    if (info.constant !== undefined) continue;
    if (info.min === undefined || info.max === undefined) return null;
    const sigFigs = nextInt(rng, MIN_ANSWER_SIG_FIGS + 1, MAX_ANSWER_SIG_FIGS);
    given.push(state(symbol, info.name, drawValue(rng, info.min, info.max, sigFigs), sigFigs, info.unit));
  }

  const info = relation.symbols[solveFor];
  const problem: RearrangeProblem = {
    topic: 'REARRANGE',
    tier,
    seed,
    answerSigFigs,
    relationId: relation.id,
    solveFor,
    given,
    prompt:
      `${relation.written} relates ${relation.about}. ` +
      `Rearrange it for ${solveFor} and work out ${info?.name ?? solveFor}, ` +
      `to ${answerSigFigs} significant figures.`,
  };
  return problem;
}

/** The recipes a proportion problem is built from — every one a real reaction. */
const RECIPES: readonly {
  readonly from: number;
  readonly to: number;
  readonly fromName: string;
  readonly toName: string;
  readonly unit: string;
}[] = [
  { from: 2, to: 3, fromName: 'Fe', toName: 'CO', unit: 'mol' },
  { from: 1, to: 2, fromName: 'N₂', toName: 'NH₃', unit: 'mol' },
  { from: 2, to: 1, fromName: 'H₂O', toName: 'O₂', unit: 'mol' },
  { from: 3, to: 2, fromName: 'H₂', toName: 'NH₃', unit: 'mol' },
  { from: 1, to: 3, fromName: 'CaCO₃', toName: 'O', unit: 'mol' },
  { from: 4, to: 5, fromName: 'NH₃', toName: 'O₂', unit: 'mol' },
  { from: 2, to: 5, fromName: 'C₂H₂', toName: 'O₂', unit: 'mol' },
  { from: 5, to: 2, fromName: 'O₂', toName: 'C₂H₂', unit: 'mol' },
  // ONE TO ONE, and these are here to be REFUSED. A 1:1 ratio is the commonest
  // one a student meets and the generator must never pose it as a proportion
  // problem — using the ratio upside down, ignoring it entirely and getting it
  // right all produce the same number, so a student holding any of the three
  // misconceptions writes what a student holding none of them writes.
  //
  // Leaving them out of the table would have been tidier and would have made
  // `RATIO_NOT_UNITY` a guarantee with nothing to guard: removing it entirely
  // moved no measurement, which is how it was found (hub LESSONS 32).
  { from: 1, to: 1, fromName: 'CaCO₃', toName: 'CO₂', unit: 'mol' },
  { from: 2, to: 2, fromName: 'H₂O', toName: 'H₂', unit: 'mol' },
];

function draftProportion(rng: Rng, tier: number, seed: string): Problem | null {
  const recipe = pick(rng, RECIPES);
  const answerSigFigs = drawSigFigs(rng);
  const haveFigures = tier === 1 ? 3 : nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
  const have = drawValue(rng, tier === 1 ? 0.5 : 0.02, tier === 1 ? 12 : 40, haveFigures);
  const problem: ProportionProblem = {
    topic: 'PROPORTION',
    tier,
    seed,
    answerSigFigs,
    from: stateExact('a', `moles of ${recipe.fromName} in the recipe`, recipe.from, recipe.unit),
    to: stateExact('b', `moles of ${recipe.toName} in the recipe`, recipe.to, recipe.unit),
    have: state('c', `moles of ${recipe.fromName} you have`, have, haveFigures, recipe.unit),
    fromName: recipe.fromName,
    toName: recipe.toName,
    prompt:
      `${recipe.from} mol of ${recipe.fromName} makes ${recipe.to} mol of ${recipe.toName}. ` +
      `You have ${formatSigFigs(have, haveFigures)} mol of ${recipe.fromName}. ` +
      `How many moles of ${recipe.toName}? Give it to ${answerSigFigs} significant figures.`,
  };
  return problem;
}

/** Where a number in scientific notation comes from, for the wording. */
const SCINOT_SUBJECTS: readonly { readonly label: string; readonly unit: string }[] = [
  { label: 'a number of particles', unit: 'particles' },
  { label: 'a concentration', unit: 'mol/L' },
  { label: 'a mass', unit: 'g' },
  { label: 'a volume', unit: 'L' },
  { label: 'a rate', unit: 'mol/(L·s)' },
];

function draftScinot(rng: Rng, tier: number, seed: string): Problem | null {
  const operation = nextInt(rng, 0, 1) === 0 ? 'MULTIPLY' : 'DIVIDE';
  const answerSigFigs = drawSigFigs(rng);
  const mantissaFigures = tier === 1 ? 3 : nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
  const firstMantissa = drawValue(rng, 1.05, 9.9, mantissaFigures);
  const secondMantissa = drawValue(rng, 1.05, 9.9, mantissaFigures);
  const span = tier === 1 ? 6 : tier === 2 ? 12 : MAX_EXPONENT;
  const firstExponent = nextInt(rng, Math.max(MIN_EXPONENT, -span), Math.min(MAX_EXPONENT, span));
  const secondExponent = nextInt(rng, Math.max(MIN_EXPONENT, -span), Math.min(MAX_EXPONENT, span));
  const subject = pick(rng, SCINOT_SUBJECTS);
  const problem: ScinotProblem = {
    topic: 'SCINOT',
    tier,
    seed,
    answerSigFigs,
    operation,
    firstMantissa,
    firstExponent,
    secondMantissa,
    secondExponent,
    firstLabel: subject.label,
    secondLabel: operation === 'MULTIPLY' ? 'the other number' : 'what you are dividing by',
    answerUnit: parseUnit(operation === 'MULTIPLY' ? subject.unit : ''),
    prompt:
      `Work out (${formatSigFigs(firstMantissa, mantissaFigures)} × 10^${firstExponent}) ` +
      `${operation === 'MULTIPLY' ? '×' : '÷'} ` +
      `(${formatSigFigs(secondMantissa, mantissaFigures)} × 10^${secondExponent}), ` +
      `and write it in scientific notation to ${answerSigFigs} significant figures.`,
  };
  return problem;
}

function draftPowers(rng: Rng, tier: number, seed: string): Problem | null {
  const direction = tier >= 2 && nextInt(rng, 0, 2) === 0 ? 'ROOT' : 'POWER';
  const exponent = tier === 1 ? 2 : nextInt(rng, 2, 3);
  const answerSigFigs = drawSigFigs(rng);
  const baseFigures = nextInt(rng, 2, MAX_ANSWER_SIG_FIGS);

  if (direction === 'ROOT') {
    const root = drawValue(rng, 0.002, 0.4, baseFigures);
    const value = roundToSigFigs(root ** exponent, baseFigures + 2);
    const problem: PowersProblem = {
      topic: 'POWERS',
      tier,
      seed,
      answerSigFigs,
      direction: 'ROOT',
      coefficient: null,
      base: state('K', 'the equilibrium constant', value, baseFigures + 2, ''),
      exponent,
      answerUnit: parseUnit('mol/L'),
      baseName: '[A]',
      prompt:
        `K = [A]^${exponent}, and K = ${formatSigFigs(value, baseFigures + 2)}. ` +
        `Work out [A] to ${answerSigFigs} significant figures.`,
    };
    return problem;
  }

  const base = drawValue(rng, 0.004, 0.45, baseFigures);
  const coefficientFigures = nextInt(rng, 2, MAX_ANSWER_SIG_FIGS);
  const coefficient = drawValue(rng, 0.02, 0.4, coefficientFigures);
  const problem: PowersProblem = {
    topic: 'POWERS',
    tier,
    seed,
    answerSigFigs,
    direction: 'POWER',
    coefficient: state('k', 'the rate constant', coefficient, coefficientFigures, 'L/(mol·s)'),
    base: state('[A]', 'the concentration of A', base, baseFigures, 'mol/L'),
    exponent,
    answerUnit: parseUnit('mol/(L·s)'),
    baseName: '[A]',
    prompt:
      `rate = k[A]^${exponent}, with k = ${formatSigFigs(coefficient, coefficientFigures)} ` +
      `and [A] = ${formatSigFigs(base, baseFigures)} mol/L. ` +
      `Work out the rate to ${answerSigFigs} significant figures.`,
  };
  return problem;
}

/** The per-unit quantities a fractions problem is built from. */
const RATES: readonly {
  readonly amountName: string;
  readonly amountUnit: string;
  readonly rateName: string;
  readonly rateUnit: string;
  readonly answerUnit: string;
  readonly min: number;
  readonly max: number;
  readonly rateMin: number;
  readonly rateMax: number;
}[] = [
  {
    amountName: 'moles of solute',
    amountUnit: 'mol',
    rateName: 'the concentration',
    rateUnit: 'mol/L',
    answerUnit: 'L',
    min: 0.02,
    max: 4,
    rateMin: 0.04,
    rateMax: 6,
  },
  {
    amountName: 'the mass',
    amountUnit: 'g',
    rateName: 'the molar mass',
    rateUnit: 'g/mol',
    answerUnit: 'mol',
    min: 0.5,
    max: 900,
    rateMin: 16,
    rateMax: 260,
  },
  {
    amountName: 'the mass',
    amountUnit: 'g',
    rateName: 'the density',
    rateUnit: 'g/mL',
    answerUnit: 'mL',
    min: 2,
    max: 900,
    rateMin: 0.6,
    rateMax: 14,
  },
  {
    amountName: 'the amount of product',
    amountUnit: 'mol',
    rateName: 'the rate',
    rateUnit: 'mol/s',
    answerUnit: 's',
    min: 0.01,
    max: 5,
    rateMin: 0.002,
    rateMax: 0.4,
  },
];

function draftFractions(rng: Rng, tier: number, seed: string): Problem | null {
  const shape = pick(rng, RATES);
  const answerSigFigs = drawSigFigs(rng);
  const amountFigures = nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
  const rateFigures = tier === 1 ? 3 : nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
  const amount = drawValue(rng, shape.min, shape.max, amountFigures);
  const rate = drawValue(rng, shape.rateMin, shape.rateMax, rateFigures);
  const problem: FractionsProblem = {
    topic: 'FRACTIONS',
    tier,
    seed,
    answerSigFigs,
    amount: state('n', shape.amountName, amount, amountFigures, shape.amountUnit),
    rate: state('r', shape.rateName, rate, rateFigures, shape.rateUnit),
    amountName: shape.amountName,
    rateName: shape.rateName,
    answerUnit: parseUnit(shape.answerUnit),
    prompt:
      `You have ${formatSigFigs(amount, amountFigures)} ${shape.amountUnit} — ${shape.amountName}. ` +
      `${shape.rateName[0]?.toUpperCase()}${shape.rateName.slice(1)} is ` +
      `${formatSigFigs(rate, rateFigures)} ${shape.rateUnit}. ` +
      `How many ${shape.answerUnit}? Give it to ${answerSigFigs} significant figures.`,
  };
  return problem;
}

/** The links a conversion chain is built from. */
interface Link {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  /** What the chain must already be carrying for this link to apply. */
  readonly consumes: string;
  /** What it leaves the chain carrying. */
  readonly produces: string;
}

/**
 * The chains, written out as compositions rather than assembled from a bag.
 *
 * THE FIRST VERSION PICKED LINKS AT RANDOM AND ASKED WHAT CAME OUT. It posed
 * "convert 522 mL into L·particles/g" — millilitres to litres, then a molar
 * mass applied to a volume — because nothing required a link to consume what
 * the previous one produced, and the guarantee that was supposed to catch it
 * compared the arrived unit against a `wantedUnit` READ OFF THE SAME RUN. Two
 * expressions of one mistake, agreeing with each other forever (hub LESSONS
 * 7g). The target unit is DECLARED here now, and the guarantee compares the
 * chain's arithmetic against the declaration.
 */
function chainsFor(substance: string, molarMassValue: number, densityValue: number): Link[][] {
  const gramsToMoles: Link = {
    label: `one mole of ${substance} weighs ${molarMassValue} g`,
    value: 1 / molarMassValue,
    unit: 'mol/g',
    consumes: 'g',
    produces: 'mol',
  };
  const molesToParticles: Link = {
    label: 'a mole is 6.022 × 10²³ particles',
    value: 6.022e23,
    unit: 'particles/mol',
    consumes: 'mol',
    produces: 'particles',
  };
  const molesToLitres: Link = {
    label: 'a mole of gas fills 22.414 L at STP',
    value: 22.414,
    unit: 'L/mol',
    consumes: 'mol',
    produces: 'L',
  };
  const kilogramsToGrams: Link = {
    label: 'a kilogram is 1000 g',
    value: 1000,
    unit: 'g/kg',
    consumes: 'kg',
    produces: 'g',
  };
  const millilitresToGrams: Link = {
    label: `${substance} has a density of ${densityValue} g/mL`,
    value: densityValue,
    unit: 'g/mL',
    consumes: 'mL',
    produces: 'g',
  };
  return [
    [gramsToMoles, molesToParticles],
    [gramsToMoles, molesToLitres],
    [kilogramsToGrams, gramsToMoles, molesToParticles],
    [kilogramsToGrams, gramsToMoles, molesToLitres],
    [millilitresToGrams, gramsToMoles, molesToParticles],
    [millilitresToGrams, gramsToMoles, molesToLitres],
  ];
}

/** Substances with a molar mass, for the conversion chains. */
const SUBSTANCES: readonly {
  readonly name: string;
  readonly molarMass: number;
  readonly density: number;
}[] = [
  { name: 'NaCl', molarMass: 58.44, density: 2.16 },
  { name: 'CO₂', molarMass: 44.01, density: 1.98 },
  { name: 'H₂O', molarMass: 18.02, density: 0.998 },
  { name: 'C₆H₁₂O₆', molarMass: 180.2, density: 1.54 },
  { name: 'KClO₃', molarMass: 122.5, density: 2.32 },
  { name: 'Fe₂O₃', molarMass: 159.7, density: 5.24 },
  { name: 'NH₃', molarMass: 17.03, density: 0.696 },
  { name: 'CaCO₃', molarMass: 100.1, density: 2.71 },
];

function draftUnits(rng: Rng, tier: number, seed: string): Problem | null {
  const substance = pick(rng, SUBSTANCES);
  const answerSigFigs = drawSigFigs(rng);
  const all = chainsFor(substance.name, substance.molarMass, substance.density);
  // Tier is chain LENGTH, which is the thing that actually gets harder: every
  // extra link is another place to put a factor upside down.
  const wantedLength = tier === 1 ? 2 : 3;
  const candidates = all.filter((chain) => chain.length === wantedLength);
  if (candidates.length === 0) return null;
  const chain = pick(rng, candidates);

  const startUnit = (chain[0] as Link).consumes;
  const startFigures = nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
  const band = START_BANDS[startUnit];
  if (band === undefined) return null;
  const startValue = drawValue(rng, band[0], band[1], startFigures);
  const factors: Factor[] = chain.map((link) => ({
    label: link.label,
    value: link.value,
    unit: parseUnit(link.unit),
  }));
  // DECLARED, not read back off the run. See `chainsFor`.
  const wantedUnit = parseUnit((chain[chain.length - 1] as Link).produces);
  const problem: UnitsProblem = {
    topic: 'UNITS',
    tier,
    seed,
    answerSigFigs,
    start: state('start', `what you are given, in ${startUnit}`, startValue, startFigures, startUnit),
    factors,
    wantedUnit,
    substance: substance.name,
    prompt:
      `Convert ${formatUnambiguous(startValue, startFigures)} ${startUnit} of ${substance.name} ` +
      `into ${formatUnit(wantedUnit)}, cancelling the units as you go. ` +
      `Give the answer to ${answerSigFigs} significant figures.`,
  };
  return problem;
}

/** What a chain may start from, and how much of it. A laboratory's amounts. */
const START_BANDS: Readonly<Record<string, readonly [number, number]>> = {
  g: [0.5, 400],
  kg: [0.02, 4],
  mL: [1, 250],
};

/** What a significant-figures problem combines. */
const SIGFIG_SHAPES: readonly {
  readonly operation: 'MULTIPLY' | 'ADD' | 'ADD_THEN_MULTIPLY';
  readonly labels: readonly string[];
  readonly units: readonly string[];
  readonly answerUnit: string;
  readonly bands: readonly (readonly [number, number])[];
}[] = [
  {
    operation: 'MULTIPLY',
    labels: ['the volume', 'the concentration'],
    units: ['L', 'mol/L'],
    answerUnit: 'mol',
    bands: [
      [0.05, 4],
      [0.02, 6],
    ],
  },
  {
    operation: 'MULTIPLY',
    labels: ['the mass', 'the specific heat capacity', 'the temperature change'],
    units: ['g', 'J/(g·K)', 'K'],
    answerUnit: 'J',
    bands: [
      [4, 600],
      [0.12, 4.2],
      [2, 95],
    ],
  },
  {
    operation: 'ADD',
    labels: ['the first mass', 'the second mass'],
    units: ['g', 'g'],
    answerUnit: 'g',
    bands: [
      [1, 400],
      [0.02, 40],
    ],
  },
  {
    operation: 'ADD',
    labels: ['the volume in the flask', 'the volume added'],
    units: ['mL', 'mL'],
    answerUnit: 'mL',
    bands: [
      [20, 500],
      [0.5, 40],
    ],
  },
  // ADD THEN MULTIPLY — the case with the highest reported failure rate, and
  // the one the type used to forbid. Both are sequences somebody actually
  // performs at a bench: pour, top up, then take the concentration; weigh, add
  // a second portion, then take the specific heat.
  {
    operation: 'ADD_THEN_MULTIPLY',
    labels: ['the volume in the flask', 'the volume added', 'the concentration'],
    units: ['L', 'L', 'mol/L'],
    answerUnit: 'mol',
    bands: [
      [0.05, 2],
      [0.005, 0.4],
      [0.02, 6],
    ],
  },
  {
    operation: 'ADD_THEN_MULTIPLY',
    labels: ['the first mass', 'the second mass', 'the specific heat capacity'],
    units: ['g', 'g', 'J/(g·K)'],
    answerUnit: 'J/K',
    bands: [
      [4, 400],
      [0.2, 40],
      [0.12, 4.2],
    ],
  },
];

function draftSigfigs(rng: Rng, tier: number, seed: string): Problem | null {
  // Tier 1 is the single-rule shapes; the mixed one is where two rules apply in
  // order and is the hardest case in the topic, so it starts at tier 2.
  const shape = pick(
    rng,
    SIGFIG_SHAPES.filter((s) =>
      tier === 1 ? s.operation !== 'ADD_THEN_MULTIPLY' && s.bands.length === 2 : true,
    ),
  );
  const operands: StatedValue[] = shape.bands.map((band, i) => {
    const figures = nextInt(rng, 2, MAX_ANSWER_SIG_FIGS + 1);
    return state(
      `x${i + 1}`,
      shape.labels[i] as string,
      drawValue(rng, band[0], band[1], figures),
      figures,
      shape.units[i] as string,
    );
  });
  const problem: SigfigsProblem = {
    topic: 'SIGFIGS',
    tier,
    seed,
    // Filled in by `solve`. The problem does not state a figure count, because
    // WORKING OUT the figure count is the thing being asked.
    answerSigFigs: MAX_ANSWER_SIG_FIGS,
    operation: shape.operation,
    operands,
    answerUnit: parseUnit(shape.answerUnit),
    prompt:
      shape.operation === 'ADD_THEN_MULTIPLY'
        ? `Add ${operands[0]?.written} ${formatUnit(operands[0]?.unit ?? parseUnit(''))} and ` +
          `${operands[1]?.written} ${formatUnit(operands[1]?.unit ?? parseUnit(''))}, ` +
          `then multiply by ${operands[2]?.written} ${formatUnit(operands[2]?.unit ?? parseUnit(''))}. ` +
          `Two rules apply, in that order. Round ONCE, at the end.`
        : `${shape.operation === 'MULTIPLY' ? 'Multiply' : 'Add'} ` +
          operands.map((o) => `${o.written} ${formatUnit(o.unit)}`).join(shape.operation === 'MULTIPLY' ? ' × ' : ' + ') +
          `. Round ONCE, at the end, to the figures the measurements entitle you to.`,
  };
  return problem;
}

/* ------------------------------------------------------------------ */
/* Reading a problem back                                              */
/* ------------------------------------------------------------------ */

/** The unit the final answer must carry. */
export function answerUnitFor(problem: Problem, solution: Solution): UnitExpr {
  return solution.answerUnit;
}

/** The precision an intermediate is entitled to, or null where nothing sets one. */
export function precisionAt(solution: Solution, stageId: string): Quantity | null {
  return solution.precisionAt[stageId] ?? null;
}

/** Every stated value in a problem, whatever its topic, for the tests. */
export function statedValues(problem: Problem): readonly StatedValue[] {
  switch (problem.topic) {
    case 'REARRANGE':
      return problem.given;
    case 'PROPORTION':
      return [problem.from, problem.to, problem.have];
    case 'POWERS':
      return problem.coefficient === null ? [problem.base] : [problem.coefficient, problem.base];
    case 'FRACTIONS':
      return [problem.amount, problem.rate];
    case 'UNITS':
      return [problem.start];
    case 'SIGFIGS':
      return problem.operands;
    case 'SCINOT':
      return [];
  }
}

/** Re-exported so the tests and the harness read one definition of each. */
export {
  DIMENSIONLESS,
  divideUnits,
  formatUnit,
  multiplyUnits,
  parseUnit,
  sameUnit,
  lastPlaceOf,
  sigFigsFrom,
  type Factor,
  type UnitExpr,
};
