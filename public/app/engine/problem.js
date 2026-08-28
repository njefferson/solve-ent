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
import { addSubtract, exact, formatSigFigs, formatUnambiguous, lastPlaceOf, magnitudeOf, measured, multiplyDivide, roundToSigFigs, sigFigsFrom, } from '../num/sigfig.js';
import { DIMENSIONLESS, divideUnits, formatUnit, invertUnits, multiplyUnits, parseUnit, runChain, sameUnit, } from '../num/units.js';
import { makeRng, nextInt, pick } from './rng.js';
import { FACTOR_SEPARATION, MAX_ANSWER_SIG_FIGS, MAX_EVERYDAY, MAX_EXPONENT, MAX_GENERATION_ATTEMPTS, MIN_ANSWER_SIG_FIGS, MIN_EVERYDAY, MIN_EXPONENT, RATIO_MARGIN, UNITY_MARGIN, } from './tolerance.js';
/** Every topic, in the order a course would meet them. */
export const TOPICS = [
    'REARRANGE',
    'PROPORTION',
    'SCINOT',
    'POWERS',
    'FRACTIONS',
    'UNITS',
    'SIGFIGS',
];
/** What each topic is, in the words a student would use. */
export const TOPIC_NAMES = {
    REARRANGE: 'rearranging a formula',
    PROPORTION: 'proportions and cross-multiplying',
    SCINOT: 'scientific notation',
    POWERS: 'powers and roots',
    FRACTIONS: 'fractions and reciprocals',
    UNITS: 'cancelling units',
    SIGFIGS: 'significant figures',
};
/**
 * The difficulties each topic has, easiest first.
 *
 * **NOT THREE EVERYWHERE, and that is a measurement rather than a preference.**
 * This was `TIERS = [1, 2, 3]` for every topic since the first release, and
 * every screen opened at tier 1, so nothing ever posed the other two. The first
 * run of `tiers.test.ts` measured all fourteen steps and found six of them
 * changed nothing a reader could tell — two topics were flat from end to end.
 *
 * A difficulty that poses what the one below it poses is the collision rule
 * wearing different clothes: a control that does nothing is worse than a
 * control that is missing, because its presence answers "is difficulty handled
 * here" for everybody afterwards. So a topic declares what it has. Five have
 * three; `FRACTIONS` has two; `PROPORTION` has one.
 *
 * `PROPORTION` having one is not a gap waiting to be filled quietly. Bigger
 * numbers and an awkward ratio are the only things that separated its tiers,
 * and neither is a different question. The step that would be real is a second
 * reaction in sequence — moles of A to moles of B to moles of C — and that is a
 * question shape this application has never posed, so it is the teacher's to
 * ask for. `NOTES.md` carries it.
 */
export const LADDERS = {
    REARRANGE: [
        { tier: 1, name: 'Two things multiplied' },
        { tier: 2, name: 'A product on both sides' },
        { tier: 3, name: 'Three or more factors' },
    ],
    PROPORTION: [{ tier: 1, name: 'One ratio' }],
    SCINOT: [
        { tier: 1, name: 'Exponents within 6' },
        { tier: 2, name: 'Exponents within 12' },
        { tier: 3, name: 'The whole range' },
    ],
    POWERS: [
        { tier: 1, name: 'Squares' },
        { tier: 2, name: 'Cubes and roots' },
        { tier: 3, name: 'Past a cube' },
    ],
    FRACTIONS: [
        { tier: 1, name: 'The rate the right way up' },
        { tier: 2, name: 'The rate upside down' },
    ],
    UNITS: [
        { tier: 1, name: 'Two steps' },
        { tier: 2, name: 'Three steps' },
        { tier: 3, name: 'Four steps' },
    ],
    SIGFIGS: [
        { tier: 1, name: 'One rule' },
        { tier: 2, name: 'Either rule' },
        { tier: 3, name: 'Two rules in order' },
    ],
};
/** The difficulties a topic has, easiest first. Never empty. */
export const laddersFor = (topic) => LADDERS[topic];
/**
 * Whether a topic poses this difficulty at all.
 *
 * For a sweep that walks topics against tiers. `PROPORTION` has one difficulty
 * and `FRACTIONS` two, so nine of the twenty-one squares are not questions this
 * application poses and generating one throws.
 */
export const posesTier = (topic, tier) => laddersFor(topic).some((difficulty) => difficulty.tier === tier);
/** Every tier any topic poses. For a sweep that wants the whole space. */
export const TIERS = [1, 2, 3];
function state(symbol, label, value, sigFigs, unit) {
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
function stateExact(symbol, label, value, unit) {
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
/**
 * How a symbol is written where a reader sees it.
 *
 * The key otherwise. Exported because the stage prompts live in `taxonomy.ts`
 * and there must be exactly one answer to this question.
 */
export function shownSymbol(relation, symbol) {
    return relation.symbols[symbol]?.shown ?? symbol;
}
/**
 * The relations, all of them from the course this is for.
 *
 * The ranges are a school laboratory's rather than arithmetic's. A generator
 * whose bounds come from what a float can hold poses a kilogram of propane,
 * and every one of those problems is correct — which is why no test objects.
 */
/**
 * Exported so a test can hold every relation to its own written form.
 *
 * Not part of what a screen uses — a screen renders a `Problem`, which carries
 * the relation already written out. This is here because the alternative was a
 * test that re-read the source as text, and a symbol that is not in the
 * equation it belongs to is a defect worth checking against the real table.
 */
export const RELATIONS = [
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
        // `M`, and it used to be `Mm`. Same defect as IDEAL_GAS's `ng`, found by the
        // same check: the relation is written `n × M = m` and named a symbol the
        // reader cannot see, so the choices read `n = m ÷ (Mm)`. Distinct from the
        // lowercase `m` for mass, which is what the written form already relies on.
        left: ['n', 'M'],
        right: ['m'],
        written: 'n × M = m',
        about: 'moles, molar mass and mass',
        tier: 1,
        symbols: {
            n: { name: 'moles', unit: 'mol', min: 0.01, max: 6 },
            M: { name: 'molar mass', unit: 'g/mol', min: 16, max: 260 },
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
            TK: { name: 'temperature in kelvin', unit: 'K', min: 220, max: 620, shown: 'T(K)' },
            TC: { name: 'temperature in Celsius', unit: '°C', min: -50, max: 350, shown: 'T(°C)' },
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
            P1: { shown: 'P₁', name: 'the first pressure', unit: 'atm', min: 0.4, max: 6 },
            V1: { shown: 'V₁', name: 'the first volume', unit: 'L', min: 0.5, max: 30 },
            P2: { shown: 'P₂', name: 'the second pressure', unit: 'atm', min: 0.4, max: 6 },
            V2: { shown: 'V₂', name: 'the second volume', unit: 'L', min: 0.5, max: 30 },
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
            C1: { shown: 'C₁', name: 'the stock concentration', unit: 'mol/L', min: 0.5, max: 12 },
            Vd1: { shown: 'V₁', name: 'the volume taken', unit: 'mL', min: 2, max: 250 },
            C2: { shown: 'C₂', name: 'the final concentration', unit: 'mol/L', min: 0.01, max: 4 },
            Vd2: { shown: 'V₂', name: 'the final volume', unit: 'mL', min: 10, max: 2000 },
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
            dT: { shown: 'ΔT', name: 'the temperature change', unit: 'K', min: 2, max: 95 },
        },
    },
    {
        id: 'IDEAL_GAS',
        shape: 'PRODUCT',
        // PLAIN `V` AND `n`, and they used to be `Vg` and `ng`.
        //
        // Every symbol here reaches a reader: the question says "Rearrange it for
        // n", the step says "n has to be separated from R and T", and the choices
        // are written symbolically. The suffixed keys made this relation ask a
        // student to rearrange `PV = nRT` for a letter that is not in it.
        //
        // `symbols` is per-relation, so the suffix was never needed for uniqueness —
        // three other relations use a plain `V` and two use a plain `n`, in their
        // own tables. `problem.test.ts` holds every symbol to appearing in the
        // relation as written, which is the general form of this defect.
        left: ['P', 'V'],
        right: ['n', 'R', 'T'],
        written: 'PV = nRT',
        about: 'a gas at one set of conditions',
        tier: 3,
        symbols: {
            P: { name: 'pressure', unit: 'atm', min: 0.4, max: 6 },
            V: { name: 'volume', unit: 'L', min: 0.4, max: 40 },
            n: { name: 'moles', unit: 'mol', min: 0.02, max: 6 },
            R: { name: 'the gas constant', unit: 'L·atm/(mol·K)', constant: 0.082057 },
            T: { name: 'temperature', unit: 'K', min: 240, max: 520 },
        },
    },
];
/** A relation by id, for the tests and the harness. */
export function relationById(id) {
    return RELATIONS.find((r) => r.id === id);
}
/**
 * The symbol for the rate the right way up.
 *
 * ALWAYS `r`, whichever way the question stated it. Where the question states
 * the reciprocal, the stated value is `p` and `r` is what the first stage asks
 * for — so a reader never meets `r` in a question before the question that
 * defines it.
 */
export const FLIPPED_RATE_SYMBOL = 'r';
/** A generator that ran out of draws. */
export class GenerationError extends Error {
    topic;
    attempts;
    constructor(topic, attempts, detail) {
        super(`${topic}: gave up after ${attempts} attempts — ${detail}`);
        this.name = 'GenerationError';
        this.topic = topic;
        this.attempts = attempts;
    }
}
const productOf = (values) => values.reduce((a, b) => a * b, 1);
/** The value a stated symbol holds, by symbol name. */
function givenValue(problem, symbol) {
    const found = problem.given.find((g) => g.symbol === symbol);
    if (found === undefined)
        throw new RangeError(`${problem.relationId} states no ${symbol}`);
    return found.quantity.value;
}
/** The quantities of the stated values, for propagating precision. */
function givenQuantities(problem) {
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
export function rearrangeParts(problem) {
    const relation = relationById(problem.relationId);
    if (relation === undefined)
        throw new RangeError(`no relation ${problem.relationId}`);
    const onLeft = relation.left.includes(problem.solveFor);
    const same = onLeft ? relation.left : relation.right;
    const other = onLeft ? relation.right : relation.left;
    const rest = same
        .filter((s) => s !== problem.solveFor)
        .map((s) => ({ symbol: s, value: symbolValue(problem, relation, s) }));
    const otherProduct = productOf(other.map((s) => symbolValue(problem, relation, s)));
    return { rest, restProduct: productOf(rest.map((r) => r.value)), otherProduct, relation };
}
function symbolValue(problem, relation, symbol) {
    const info = relation.symbols[symbol];
    if (info?.constant !== undefined)
        return info.constant;
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
export function solve(problem) {
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
function unitOfSolveFor(problem) {
    const relation = relationById(problem.relationId);
    return parseUnit(relation?.symbols[problem.solveFor]?.unit ?? '');
}
function solveRearrange(problem) {
    const { relation, rest, restProduct, otherProduct } = rearrangeParts(problem);
    const unit = unitOfSolveFor(problem);
    if (relation.shape === 'OFFSET') {
        const offset = relation.offset ?? 0;
        const onLeft = relation.left.includes(problem.solveFor);
        const other = (onLeft ? relation.right : relation.left)[0];
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
                `${shownSymbol(relation, problem.solveFor)} = ${shownSymbol(relation, other)} ${onLeft ? '+' : '−'} ${offset}`,
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
    const at = rest.length >= 2 ? { R2: restProduct, R3: answer } : { R3: answer };
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
            `${shownSymbol(relation, problem.solveFor)} = ${otherProduct} ÷ ${rest.map((r) => shownSymbol(relation, r.symbol)).join(' ÷ ')}`,
        ],
    };
}
function quantityOfSymbol(problem, symbol) {
    const found = problem.given.find((g) => g.symbol === symbol);
    if (found !== undefined)
        return found.quantity;
    const relation = relationById(problem.relationId);
    const constant = relation?.symbols[symbol]?.constant;
    // A published constant is quoted to more figures than any measurement in the
    // problem, so it is not what limits the answer. Treating it as exact is the
    // ordinary rule, and it is why the gas constant never sets the precision.
    return exact(constant ?? 1);
}
function solveProportion(problem) {
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
export function normalise(value) {
    if (value === 0)
        return { mantissa: 0, exponent: 0 };
    const exponent = magnitudeOf(value);
    return { mantissa: value / 10 ** exponent, exponent };
}
function solveScinot(problem) {
    const rawMantissa = problem.operation === 'MULTIPLY'
        ? problem.firstMantissa * problem.secondMantissa
        : problem.firstMantissa / problem.secondMantissa;
    const rawExponent = problem.operation === 'MULTIPLY'
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
function sigFigsOfMantissa(mantissa) {
    const text = String(mantissa);
    const digits = text.replace('-', '').replace('.', '').replace(/^0+/, '');
    return Math.max(1, digits.length);
}
function solvePowers(problem) {
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
function solveFractions(problem) {
    const amount = problem.amount.quantity.value;
    const stated = problem.rate.quantity.value;
    // The rate the right way up. Where the question stated the reciprocal, this
    // is what F1 asks for and F2 divides by.
    const rate = problem.upsideDown ? 1 / stated : stated;
    // MULTIPLIED, NOT DIVIDED BY THE FLIP. `amount / (1 / stated)` is the same
    // number in arithmetic and not always the same in floating point, and the
    // stated value is the one the reader has in front of them.
    const answer = problem.upsideDown ? amount * stated : amount / stated;
    return {
        topic: 'FRACTIONS',
        answer,
        answerUnit: problem.answerUnit,
        at: problem.upsideDown ? { F0: rate, F2: answer } : { F2: answer },
        precisionAt: { F2: multiplyDivide(answer, [problem.amount.quantity, problem.rate.quantity]) },
        working: problem.upsideDown
            ? [
                `1 ÷ ${problem.rate.written} = ${rate}`,
                `${problem.amount.written} × ${problem.rate.written} = ${answer}`,
            ]
            : [`${problem.amount.written} ÷ ${problem.rate.written} = ${answer}`],
    };
}
function solveUnits(problem) {
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
    const at = { U2: afterFirst, U3: ran.value };
    const measuredOperands = [problem.start.quantity, ...problem.factors.map(() => exact(1))];
    return {
        topic: 'UNITS',
        answer: ran.value,
        answerUnit: ran.unit,
        at,
        precisionAt: { U3: multiplyDivide(ran.value, measuredOperands) },
        working: problem.factors.map((f) => `× ${f.value} ${formatUnit(f.unit)} — ${f.label}`),
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
function solveSigfigs(problem) {
    const values = problem.operands.map((o) => o.quantity.value);
    const quantities = problem.operands.map((o) => o.quantity);
    // THE MIXED SHAPE, and its precision is set in TWO steps: the sum's last
    // decimal place first, then the fewest significant figures between that sum
    // and the thing it multiplies. Neither step alone gives the right answer, and
    // taking the fewest figures among all three operands — the obvious shortcut —
    // is the misconception this shape exists to catch.
    if (problem.operation === 'ADD_THEN_MULTIPLY') {
        const first = quantities[0];
        const second = quantities[1];
        const third = quantities[2];
        const sumValue = values[0] + values[1];
        const sum = addSubtract(sumValue, [first, second]);
        const sumFigures = sum.kind === 'measured' ? sum.reading.sigFigs : problem.answerSigFigs;
        const mixedRaw = sumValue * values[2];
        // CARRIED, NOT ROUNDED. The sum enters the multiplication at full
        // precision; rounding it here would be E-SIG-ROUND-EARLY committed by the
        // grader itself.
        const mixedPrecision = multiplyDivide(mixedRaw, [sum, third]);
        const mixedFigures = mixedPrecision.kind === 'measured' ? mixedPrecision.reading.sigFigs : problem.answerSigFigs;
        return {
            topic: 'SIGFIGS',
            answer: roundToSigFigs(mixedRaw, mixedFigures),
            answerUnit: problem.answerUnit,
            at: {
                G1: countSigFigs(problem.operands[0]),
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
    const raw = problem.operation === 'MULTIPLY'
        ? values.reduce((a, b) => a * b, 1)
        : values.reduce((a, b) => a + b, 0);
    const precision = problem.operation === 'MULTIPLY' ? multiplyDivide(raw, quantities) : addSubtract(raw, quantities);
    const figures = precision.kind === 'measured' ? precision.reading.sigFigs : problem.answerSigFigs;
    const answer = roundToSigFigs(raw, figures);
    return {
        topic: 'SIGFIGS',
        answer,
        answerUnit: problem.answerUnit,
        at: { G1: countSigFigs(problem.operands[0]), G2: figures, G3: answer },
        precisionAt: { G3: precision },
        working: [
            `${problem.operation === 'MULTIPLY' ? 'the product' : 'the sum'} is ${raw}`,
            `it is entitled to ${figures} significant figures`,
        ],
    };
}
/** How many significant figures a stated value carries. */
export function countSigFigs(value) {
    const q = value.quantity;
    if (q.kind === 'measured')
        return q.reading.sigFigs;
    if (q.kind === 'ambiguous')
        return q.low.sigFigs;
    return 0;
}
const nearUnity = (value, margin) => Math.abs(Math.abs(value) - 1) < margin;
/** True where two positive values are within a margin of each other, as a ratio. */
function withinRatio(a, b, margin) {
    if (a === 0 || b === 0)
        return a === b;
    const ratio = Math.abs(a / b);
    return Math.abs(ratio - 1) < margin;
}
/** True where two values would round to the same thing at `sigFigs`. */
export function sameAtPrecision(a, b, sigFigs) {
    if (a === b)
        return true;
    if (!Number.isFinite(a) || !Number.isFinite(b))
        return false;
    return roundToSigFigs(a, sigFigs) === roundToSigFigs(b, sigFigs);
}
/** True where a value is one somebody could measure in a school laboratory. */
function physicallyReal(value) {
    if (!Number.isFinite(value))
        return false;
    const magnitude = Math.abs(value);
    return magnitude >= MIN_EVERYDAY && magnitude <= MAX_EVERYDAY;
}
/**
 * Every guarantee this problem breaks. An empty list is a problem worth posing.
 *
 * PRECONDITION: none. Safe to call on a candidate that has not been accepted —
 * which is the whole of what it is for.
 */
export function checkGuarantees(problem) {
    const broken = [];
    const sf = problem.answerSigFigs;
    switch (problem.topic) {
        case 'REARRANGE': {
            const relation = relationById(problem.relationId);
            if (relation === undefined)
                return ['PHYSICALLY_REAL'];
            if (relation.shape === 'OFFSET') {
                const solution = solve(problem);
                const other = (relation.left.includes(problem.solveFor) ? relation.right : relation.left)[0];
                const otherValue = givenValue(problem, other);
                const offset = relation.offset ?? 0;
                const wrongWay = relation.left.includes(problem.solveFor) ? otherValue - offset : otherValue + offset;
                // The sign error has to produce a different number. It does unless the
                // offset is zero, but a temperature that lands both ways inside one
                // rounding step is still a problem that cannot teach the direction.
                if (sameAtPrecision(solution.answer, wrongWay, sf))
                    broken.push('OFFSET_DIRECTIONS_SEPARATE');
                if (!Number.isFinite(solution.answer))
                    broken.push('PHYSICALLY_REAL');
                const info = relation.symbols[problem.solveFor];
                if (info?.min !== undefined && info.max !== undefined) {
                    if (solution.answer < info.min || solution.answer > info.max)
                        broken.push('PHYSICALLY_REAL');
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
            if (!Number.isFinite(answer) || answer <= 0)
                return ['PHYSICALLY_REAL'];
            if (nearUnity(restProduct, UNITY_MARGIN))
                broken.push('NO_DEGENERATE_PRODUCT');
            if (nearUnity(answer, UNITY_MARGIN))
                broken.push('NO_DEGENERATE_PRODUCT');
            if (nearUnity(otherProduct, UNITY_MARGIN))
                broken.push('NO_DEGENERATE_PRODUCT');
            for (const factor of rest) {
                if (nearUnity(factor.value, UNITY_MARGIN))
                    broken.push('NO_DEGENERATE_PRODUCT');
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
                    if (withinRatio(rest[i].value, rest[j].value, FACTOR_SEPARATION)) {
                        broken.push('FACTORS_SEPARATED');
                    }
                }
            }
            if (!physicallyReal(answer))
                broken.push('PHYSICALLY_REAL');
            const info = relation.symbols[problem.solveFor];
            if (info?.min !== undefined && info.max !== undefined) {
                if (answer < info.min || answer > info.max)
                    broken.push('PHYSICALLY_REAL');
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
            if (from === to)
                broken.push('RATIO_NOT_UNITY');
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
            if (indistinguishable(have + to - from, answer, sf))
                broken.push('SCALE_NOT_RECIPE');
            // And rounding the scale on the way through sits within a rounding step
            // of the correct answer, so it needs the same separation from the
            // additive one that the correct answer does.
            const earlyScale = roundToSigFigs(have / from, sf);
            if (indistinguishable(have + to - from, roundToSigFigs(earlyScale * to, sf), sf)) {
                broken.push('SCALE_NOT_RECIPE');
            }
            // THE SCALING STAGE MUST ASK FOR SOMETHING THE QUESTION DOES NOT PRINT.
            // "How many times the recipe is that?" has the answer c when a = 1 — the
            // number is already on the page, so the stage teaches copying and
            // attributes nothing to anybody who copies it. The same happens at
            // c = a² (the scale is a) and c = ab (the scale is b).
            //
            // A CONDITION ON THE STATED VALUES, like every guarantee here: those
            // three equalities are what "the scale is one of the printed numbers"
            // means, worked out rather than compared for.
            //
            // Found by widening the no-leak check to every difficulty a topic has:
            // it had only ever looked at tier 2, and `PROPORTION` no longer has one.
            // Two recipes take one mole — N₂ to NH₃ and CaCO₃ to O — and they stay in
            // the table to be refused, like the one-to-one pair above them.
            const scale = have / from;
            if (nearUnity(from, UNITY_MARGIN))
                broken.push('SCALE_IS_WORK');
            if (withinRatio(scale, from, RATIO_MARGIN) || withinRatio(scale, to, RATIO_MARGIN)) {
                broken.push('SCALE_IS_WORK');
            }
            if (!physicallyReal(answer))
                broken.push('PHYSICALLY_REAL');
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
            if (e1 === 0 || e2 === 0)
                broken.push('EXPONENTS_NOT_DEGENERATE');
            if (Math.abs(e1) === 2 && Math.abs(e2) === 2)
                broken.push('EXPONENTS_NOT_DEGENERATE');
            // AND A MARGIN OF TWO, not one, because renormalising moves the answer's
            // exponent by one either way. Requiring only that the product differ
            // from the sum lets "multiplied the exponents" land exactly where
            // "shifted the decimal point without moving the exponent" lands — twelve
            // times in a forty-problem sweep, at the last stage, where every mistake
            // in the topic shows up at once.
            const combined = problem.operation === 'MULTIPLY' ? e1 + e2 : e1 - e2;
            if (Math.abs(e1 * e2 - combined) < 2)
                broken.push('EXPONENTS_NOT_DEGENERATE');
            const rawMantissa = problem.operation === 'MULTIPLY'
                ? problem.firstMantissa * problem.secondMantissa
                : problem.firstMantissa / problem.secondMantissa;
            // Renormalising is a step, and a step that sometimes is not there cannot
            // be graded. A raw mantissa sitting right on 10 or right on 1 makes
            // "does this need shifting" a coin toss rather than a reading.
            if (withinRatio(rawMantissa, 10, UNITY_MARGIN / 2))
                broken.push('NORMALISATION_DECIDABLE');
            if (withinRatio(rawMantissa, 1, UNITY_MARGIN / 2))
                broken.push('NORMALISATION_DECIDABLE');
            // Doing to the front numbers what belongs to the exponents lands on the
            // right front number exactly when m1·m2 = m1+m2 — which has real
            // solutions, so it is drawn against rather than reasoned away.
            const wrongMantissa = problem.operation === 'MULTIPLY'
                ? problem.firstMantissa + problem.secondMantissa
                : problem.firstMantissa - problem.secondMantissa;
            if (withinRatio(wrongMantissa, rawMantissa, RATIO_MARGIN))
                broken.push('MANTISSA_OPS_SEPARATE');
            const value = rawMantissa * 10 ** combined;
            if (!Number.isFinite(value) || value === 0)
                broken.push('PHYSICALLY_REAL');
            return broken;
        }
        case 'POWERS': {
            const base = problem.base.quantity.value;
            const k = problem.coefficient?.quantity.value ?? 1;
            // Raising the coefficient as well as the base gives k^n·x^n where k·x^n
            // is wanted, and those agree exactly when k = 1.
            if (problem.direction === 'POWER' && nearUnity(k, UNITY_MARGIN))
                broken.push('COEFFICIENT_NOT_UNITY');
            // A base of 1 is every power and every root of itself.
            if (nearUnity(base, UNITY_MARGIN))
                broken.push('BASE_NOT_UNITY');
            if (problem.exponent < 2)
                broken.push('BASE_NOT_UNITY');
            const solution = solve(problem);
            if (!Number.isFinite(solution.answer) || solution.answer <= 0)
                broken.push('PHYSICALLY_REAL');
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
            const withCoefficient = problem.direction === 'POWER'
                ? [
                    solution.answer,
                    k * base * problem.exponent,
                    k * base ** (1 / problem.exponent),
                    k * problem.exponent ** base,
                    (k * base) ** problem.exponent,
                ]
                : [solution.answer, base / problem.exponent, base ** problem.exponent];
            const bare = problem.direction === 'POWER'
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
            // Both hold whichever way up the question stated it: where it stated the
            // reciprocal, a stated 1 flips to 1.
            if (nearUnity(rate, UNITY_MARGIN))
                broken.push('RATE_NOT_UNITY');
            if (problem.upsideDown) {
                // WORKED OUT BY HAND from the flipped shape, where the correct answer
                // is amount·p and the rate the right way up is r = 1/p:
                //
                //   "wrote it upside down" (r/amount) meets the correct answer where
                //   amount·p = 1, and meets "never used the rate" (amount) where
                //   p = 1/amount².
                //
                // The other three pairings all reduce to p = 1 or amount = 1, which the
                // two checks above already refuse.
                //
                // ONE PAIRING IS DELIBERATELY ABSENT. A reader who never turns the rate
                // over divides by p and gets amount/p, which is exactly what a reader
                // who turned it over and then multiplied gets — two misconceptions, one
                // number. The DECOMPOSITION is what separates them rather than a
                // tiebreak: F0 asks for the flip on its own, so by the time the answer
                // is asked for, whether it was turned over is already known and is not
                // a thing to guess at. That is why the flip is a stage.
                const answer = amount * rate;
                if (nearUnity(answer, UNITY_MARGIN))
                    broken.push('FLIP_SEPARATES');
                if (withinRatio(rate, 1 / (amount * amount), RATIO_MARGIN))
                    broken.push('FLIP_SEPARATES');
                if (!physicallyReal(answer))
                    broken.push('PHYSICALLY_REAL');
                return broken;
            }
            // Taking the reciprocal of the answer gives rate/amount where
            // amount/rate is wanted; the two agree when amount = rate.
            if (withinRatio(amount, rate, RATIO_MARGIN))
                broken.push('AMOUNT_NOT_RATE');
            // Writing the answer upside down and never using the rate at all are the
            // same number when rate = amount²; multiplying by the rate and writing
            // the answer upside down are the same when amount = 1. Both worked out
            // by hand from `rate/amount = amount` and `amount·rate = rate/amount`.
            if (withinRatio(rate, amount * amount, RATIO_MARGIN))
                broken.push('AMOUNT_NOT_RATE');
            if (nearUnity(amount, UNITY_MARGIN))
                broken.push('AMOUNT_NOT_RATE');
            const answer = amount / rate;
            if (!physicallyReal(answer))
                broken.push('PHYSICALLY_REAL');
            return broken;
        }
        case 'UNITS': {
            const factors = problem.factors;
            for (const factor of factors) {
                // A link whose value is 1 converts nothing, so leaving it out is not a
                // mistake and turning it upside down is not either.
                if (nearUnity(factor.value, UNITY_MARGIN))
                    broken.push('NO_FACTOR_NEAR_UNITY');
            }
            for (let i = 0; i < factors.length; i += 1) {
                for (let j = i + 1; j < factors.length; j += 1) {
                    const a = factors[i].value;
                    const b = factors[j].value;
                    // Dropping A and dropping B are the same number when A = B, so the
                    // diagnosis would name two links and mean one.
                    if (withinRatio(a, b, FACTOR_SEPARATION))
                        broken.push('FACTORS_SEPARATED');
                    // Dropping A and inverting B are the same number when A = B².
                    if (withinRatio(a, b * b, FACTOR_SEPARATION))
                        broken.push('FACTORS_SEPARATED');
                    if (withinRatio(b, a * a, FACTOR_SEPARATION))
                        broken.push('FACTORS_SEPARATED');
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
            if (nearUnity(chainProduct, UNITY_MARGIN))
                broken.push('CHAIN_PRODUCT_NOT_UNITY');
            // AND THE SAME MISTAKE MEETS ONE LINK BEING UPSIDE DOWN. Inverting the
            // whole chain divides by (∏f)², inverting link i divides by f_i², so the
            // two are one number exactly when the OTHER links multiply to one.
            //
            // On a two-link chain that means the other link is 1, which the check at
            // the top of this block already refuses — which is why this was not here.
            // Four-link chains reach it honestly: no single link is near one and
            // three of them together still can be. Found by the collision sweep the
            // day the fourth link arrived.
            for (let i = 0; i < factors.length; i += 1) {
                const withoutOne = factors.reduce((a, f, j) => (j === i ? a : a * f.value), 1);
                if (nearUnity(withoutOne, UNITY_MARGIN))
                    broken.push('CHAIN_PRODUCT_NOT_UNITY');
            }
            const ran = runChain(problem.start.quantity.value, problem.start.unit, factors);
            if (!sameUnit(ran.unit, problem.wantedUnit))
                broken.push('PHYSICALLY_REAL');
            if (!Number.isFinite(ran.value) || ran.value === 0)
                broken.push('PHYSICALLY_REAL');
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
                const rawMixed = (values[0] + values[1]) * values[2];
                if (rightMixed === undefined || rightMixed < 1)
                    broken.push('SIGFIG_RULES_DISAGREE');
                else if (rightMixed === shortcut)
                    broken.push('SIGFIG_RULES_DISAGREE');
                else if (sameAtPrecision(roundToSigFigs(rawMixed, rightMixed), roundToSigFigs(rawMixed, shortcut), MAX_ANSWER_SIG_FIGS + 2)) {
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
                if (sumFigures === undefined || sumFigures < 1)
                    broken.push('SIGFIG_RULES_DISAGREE');
                if (!physicallyReal(rawMixed))
                    broken.push('PHYSICALLY_REAL');
                // THE BACKSTOP, and this shape is the third topic to need it.
                //
                // Rounding the intermediate sum early and applying the wrong rule both
                // amount to carrying fewer digits through the multiplication, so they
                // land on the same number more often than not — twelve collisions in a
                // 10,500-problem sweep the first time this shape was posed. There is no
                // relation between the two that a generator can be told to avoid, only
                // one it has to look for.
                if (sumFigures !== undefined) {
                    const earlySum = roundToSigFigs(values[0] + values[1], sumFigures);
                    const rightCandidate = rightMixed === undefined ? rawMixed : roundToSigFigs(rawMixed, rightMixed);
                    const candidates = [
                        rightCandidate,
                        roundToSigFigs(rawMixed, shortcut),
                        roundToSigFigs(earlySum * values[2], rightMixed ?? MAX_ANSWER_SIG_FIGS),
                    ];
                    const distinct = candidates.filter((v, i) => i === 0 || !indistinguishable(v, candidates[0], rightMixed ?? MAX_ANSWER_SIG_FIGS));
                    if (!predictionsSeparated(distinct, rightMixed ?? MAX_ANSWER_SIG_FIGS)) {
                        broken.push('PREDICTIONS_SEPARATED');
                    }
                }
                return broken;
            }
            const raw = problem.operation === 'MULTIPLY'
                ? values.reduce((a, b) => a * b, 1)
                : values.reduce((a, b) => a + b, 0);
            const byMultiply = multiplyDivide(raw, quantities);
            const byAdd = addSubtract(raw, quantities);
            const rightCount = byMultiply.kind === 'measured' ? byMultiply.reading.sigFigs : 0;
            const wrongCount = byAdd.kind === 'measured' ? byAdd.reading.sigFigs : 0;
            // Applying the wrong rule has to produce a different figure count, or
            // the topic has nothing to teach on this problem.
            if (rightCount === wrongCount)
                broken.push('SIGFIG_RULES_DISAGREE');
            if (rightCount < 1 || wrongCount < 1)
                broken.push('SIGFIG_RULES_DISAGREE');
            // And the different count has to produce a different NUMBER. Rounding
            // 42.0 to two figures and to three is 42 either way, so a student who
            // got the rule wrong would write the right answer.
            const correctCount = problem.operation === 'MULTIPLY' ? rightCount : wrongCount;
            const otherCount = problem.operation === 'MULTIPLY' ? wrongCount : rightCount;
            if (sameAtPrecision(roundToSigFigs(raw, correctCount), roundToSigFigs(raw, otherCount), MAX_ANSWER_SIG_FIGS + 2)) {
                broken.push('ROUNDING_IS_VISIBLE');
            }
            if (!physicallyReal(raw))
                broken.push('PHYSICALLY_REAL');
            // THE BACKSTOP AGAIN, and this is the second and last topic that needs
            // it. Rounding on the way through and applying the wrong rule are two
            // different computations over the same measurements, and where they
            // land relative to each other depends on digits rather than on any
            // relation anybody can write down. One collision in 840 problems, which
            // is what a coincidence looks like — but a coincidence reported to a
            // teacher as a diagnosis is still a guess.
            const roundedEarly = values.map((v) => roundToSigFigs(v, correctCount));
            const earlyRaw = problem.operation === 'MULTIPLY'
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
            const distinct = candidates.filter((v, i) => i === 0 || !indistinguishable(v, candidates[0], correctCount));
            if (!predictionsSeparated(distinct, correctCount))
                broken.push('PREDICTIONS_SEPARATED');
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
export function indistinguishable(a, b, sigFigs) {
    if (!Number.isFinite(a) || !Number.isFinite(b))
        return false;
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
export function predictionsSeparated(values, sigFigs) {
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            if (indistinguishable(values[i], values[j], sigFigs))
                return false;
        }
    }
    return true;
}
/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */
/** A draw from a band, at a stated precision. */
function drawValue(rng, min, max, sigFigs) {
    const span = max - min;
    const steps = 10000;
    const raw = min + (nextInt(rng, 0, steps) / steps) * span;
    return roundToSigFigs(raw, sigFigs);
}
function drawSigFigs(rng) {
    return nextInt(rng, MIN_ANSWER_SIG_FIGS, MAX_ANSWER_SIG_FIGS);
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
const REPORTS = new Map();
/**
 * What the generator threw away on its way to this problem, and why.
 *
 * PRECONDITION: {@link generateProblem} was called with the same arguments,
 * and fewer than {@link MAX_REPORTS} problems have been generated since. Read
 * it straight after generating, which is what the sweep does. Kept for that
 * sweep, which reports rejection counts by guarantee — the number that says
 * whether the structural guarantees or the backstop are doing the separating.
 */
export function generationReport(assignmentKey, topic, tier, index) {
    const key = `${assignmentKey}|${topic}|${tier}|${index}`;
    const found = REPORTS.get(key);
    return found === undefined ? { attempts: 0, rejected: {} } : { attempts: found.attempts, rejected: found.rejected };
}
/**
 * Generate one problem.
 *
 * PRECONDITION: `topic` is one of {@link TOPICS} and `tier` one the topic
 * declares in {@link LADDERS}. Deterministic: the same arguments always produce
 * the same problem, on every device, which is what lets a teacher write one key
 * on the board and a class of thirty work the same set.
 *
 * **A tier the topic does not declare is refused, not clamped.** Clamping would
 * hand back tier 1 and let a caller believe it had asked for something harder,
 * which is how `PROPORTION` served the same questions under three labels for
 * eleven releases.
 *
 * Throws {@link GenerationError} rather than lowering a guarantee. A generator
 * that relaxes its own conditions to find something to pose is a generator that
 * poses the problem the guarantee existed to refuse.
 */
export function generateProblem(assignmentKey, topic, tier, index) {
    if (!laddersFor(topic).some((difficulty) => difficulty.tier === tier)) {
        throw new RangeError(`${topic} has no tier ${String(tier)}`);
    }
    const key = `${assignmentKey}|${topic}|${tier}|${index}`;
    const rng = makeRng(key);
    const rejected = {};
    let lastBroken = [];
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const candidate = draft(rng, topic, tier, key);
        if (candidate === null)
            continue;
        const broken = checkGuarantees(candidate);
        if (broken.length > 0) {
            lastBroken = broken;
            for (const name of new Set(broken))
                rejected[name] = (rejected[name] ?? 0) + 1;
            continue;
        }
        if (REPORTS.size >= MAX_REPORTS) {
            // Oldest first: a Map iterates in insertion order, so the first key is
            // the least recently generated.
            const oldest = REPORTS.keys().next();
            if (!oldest.done)
                REPORTS.delete(oldest.value);
        }
        REPORTS.set(key, { attempts: attempt + 1, rejected });
        return candidate;
    }
    throw new GenerationError(topic, MAX_GENERATION_ATTEMPTS, `last rejected for ${lastBroken.join(', ') || 'nothing drawable'}`);
}
/** Every problem for one topic and tier, from one key. */
export function generateSet(assignmentKey, topic, tier, count) {
    const out = [];
    for (let i = 0; i < count; i += 1)
        out.push(generateProblem(assignmentKey, topic, tier, i));
    return out;
}
/** One candidate, before the guarantees have seen it. */
function draft(rng, topic, tier, seed) {
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
function draftRearrange(rng, tier, seed) {
    const available = RELATIONS.filter((r) => r.tier <= tier);
    if (available.length === 0)
        return null;
    const relation = pick(rng, available);
    const solvable = [...relation.left, ...relation.right].filter((s) => relation.symbols[s]?.constant === undefined);
    const solveFor = pick(rng, solvable);
    const answerSigFigs = drawSigFigs(rng);
    const given = [];
    for (const symbol of [...relation.left, ...relation.right]) {
        if (symbol === solveFor)
            continue;
        const info = relation.symbols[symbol];
        if (info === undefined)
            return null;
        if (info.constant !== undefined)
            continue;
        if (info.min === undefined || info.max === undefined)
            return null;
        const sigFigs = nextInt(rng, MIN_ANSWER_SIG_FIGS + 1, MAX_ANSWER_SIG_FIGS);
        given.push(state(symbol, info.name, drawValue(rng, info.min, info.max, sigFigs), sigFigs, info.unit));
    }
    const info = relation.symbols[solveFor];
    const problem = {
        topic: 'REARRANGE',
        tier,
        seed,
        answerSigFigs,
        relationId: relation.id,
        solveFor,
        given,
        prompt: `${relation.written} relates ${relation.about}. ` +
            `Rearrange it for ${shownSymbol(relation, solveFor)} and work out ${info?.name ?? solveFor}, ` +
            `to ${answerSigFigs} significant figures.`,
    };
    return problem;
}
/** The recipes a proportion problem is built from — every one a real reaction. */
const RECIPES = [
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
function draftProportion(rng, tier, seed) {
    const answerSigFigs = drawSigFigs(rng);
    // THE RECIPE, not only the number. Both branches here were `tier === 1 ? … : …`,
    // so tiers 2 and 3 drew identically and the topic had one difficulty step
    // wearing two labels. What makes a proportion harder is the ratio being
    // further from something a reader can do in their head, so tier 3 draws from
    // the recipes whose two coefficients are furthest apart.
    const spread = (r) => Math.max(r.from, r.to) / Math.min(r.from, r.to);
    const awkward = RECIPES.filter((r) => spread(r) >= 2);
    const recipeFor = tier < 3 || awkward.length === 0 ? RECIPES : awkward;
    const haveFigures = tier === 1 ? 3 : nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
    const recipe = pick(rng, recipeFor);
    const have = drawValue(rng, tier === 1 ? 0.5 : 0.02, tier === 1 ? 12 : tier === 2 ? 40 : 400, haveFigures);
    const problem = {
        topic: 'PROPORTION',
        tier,
        seed,
        answerSigFigs,
        from: stateExact('a', `moles of ${recipe.fromName} in the recipe`, recipe.from, recipe.unit),
        to: stateExact('b', `moles of ${recipe.toName} in the recipe`, recipe.to, recipe.unit),
        have: state('c', `moles of ${recipe.fromName} you have`, have, haveFigures, recipe.unit),
        fromName: recipe.fromName,
        toName: recipe.toName,
        prompt: `${recipe.from} mol of ${recipe.fromName} makes ${recipe.to} mol of ${recipe.toName}. ` +
            `You have ${formatSigFigs(have, haveFigures)} mol of ${recipe.fromName}. ` +
            `How many moles of ${recipe.toName}? Give it to ${answerSigFigs} significant figures.`,
    };
    return problem;
}
/** Where a number in scientific notation comes from, for the wording. */
/**
 * What the first number IS, so the unit the last step wants has a source.
 *
 * **THE LABEL WAS DRAWN AND THEN DROPPED.** A subject was picked, its unit was
 * attached to the answer, and the prompt was built as bare arithmetic — "Work
 * out (3.02 × 10^-2) × (4.88 × 10^6)". The final step then asked for the answer
 * in particles. **Thirty-five of sixty problems demanded a unit the question
 * never mentioned**, which cannot be answered except by guessing, and a guess
 * is then attributed to the reader as a units error.
 *
 * `countable` is the second half of the same honesty. A mass, a volume, a
 * concentration and a rate are fine at any magnitude; a NUMBER OF PARTICLES is
 * not, and "3.02 × 10^-2 particles" is not a quantity anybody has. A countable
 * subject is only drawn where the number it labels is at least one.
 */
const SCINOT_SUBJECTS = [
    { label: 'A number of particles', unit: 'particles', countable: true },
    { label: 'A concentration', unit: 'mol/L', countable: false },
    { label: 'A mass', unit: 'g', countable: false },
    { label: 'A volume', unit: 'L', countable: false },
    { label: 'A rate', unit: 'mol/(L·s)', countable: false },
];
function draftScinot(rng, tier, seed) {
    const operation = nextInt(rng, 0, 1) === 0 ? 'MULTIPLY' : 'DIVIDE';
    const answerSigFigs = drawSigFigs(rng);
    const mantissaFigures = tier === 1 ? 3 : nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
    const firstMantissa = drawValue(rng, 1.05, 9.9, mantissaFigures);
    const secondMantissa = drawValue(rng, 1.05, 9.9, mantissaFigures);
    const span = tier === 1 ? 6 : tier === 2 ? 12 : MAX_EXPONENT;
    const firstExponent = nextInt(rng, Math.max(MIN_EXPONENT, -span), Math.min(MAX_EXPONENT, span));
    const secondExponent = nextInt(rng, Math.max(MIN_EXPONENT, -span), Math.min(MAX_EXPONENT, span));
    // A COUNT CANNOT BE A FRACTION OF ONE. Drawn from the subjects this magnitude
    // can honestly carry, rather than drawn and hoped for.
    const subject = pick(rng, SCINOT_SUBJECTS.filter((candidate) => !candidate.countable || firstExponent >= 0));
    const problem = {
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
        // THE QUANTITY IS NAMED, so the unit the last step asks for has a source in
        // the question. Multiplying by a bare number keeps the unit; dividing two of
        // the same thing cancels it, which is why only one of them names one.
        prompt: operation === 'MULTIPLY'
            ? `${subject.label} of ${formatSigFigs(firstMantissa, mantissaFigures)} × 10^${firstExponent} ${subject.unit} ` +
                `is multiplied by ${formatSigFigs(secondMantissa, mantissaFigures)} × 10^${secondExponent}. ` +
                `Give the answer in scientific notation, to ${answerSigFigs} significant figures, with its unit.`
            : `${subject.label} of ${formatSigFigs(firstMantissa, mantissaFigures)} × 10^${firstExponent} ${subject.unit} ` +
                `is divided by ${formatSigFigs(secondMantissa, mantissaFigures)} × 10^${secondExponent} ${subject.unit}. ` +
                `The units cancel, so the answer is a bare number. ` +
                `Give it in scientific notation, to ${answerSigFigs} significant figures.`,
    };
    return problem;
}
function draftPowers(rng, tier, seed) {
    const direction = tier >= 2 && nextInt(rng, 0, 2) === 0 ? 'ROOT' : 'POWER';
    // Tier 3 goes past a cube, which is where the exponent stops being a shape
    // somebody recognises and becomes something they have to work. It read
    // `tier === 1 ? 2 : nextInt(rng, 2, 3)`, so tiers 2 and 3 drew from the same
    // two values.
    const exponent = tier === 1 ? 2 : tier === 2 ? nextInt(rng, 2, 3) : nextInt(rng, 3, 4);
    const answerSigFigs = drawSigFigs(rng);
    const baseFigures = nextInt(rng, 2, MAX_ANSWER_SIG_FIGS);
    if (direction === 'ROOT') {
        const root = drawValue(rng, 0.002, 0.4, baseFigures);
        const value = roundToSigFigs(root ** exponent, baseFigures + 2);
        const problem = {
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
            // THE UNIT HAS TO HAVE A SOURCE. This asked for [A] in mol/L while naming
            // neither mol nor L anywhere — the same defect as scientific notation,
            // found by the gate written for that one. `[A]` is a concentration, so
            // the question says so.
            prompt: `[A] is a concentration, in mol/L. ` +
                `K = [A]^${exponent}, and K = ${formatSigFigs(value, baseFigures + 2)}. ` +
                `Work out [A] to ${answerSigFigs} significant figures, with its unit.`,
        };
        return problem;
    }
    const base = drawValue(rng, 0.004, 0.45, baseFigures);
    const coefficientFigures = nextInt(rng, 2, MAX_ANSWER_SIG_FIGS);
    const coefficient = drawValue(rng, 0.02, 0.4, coefficientFigures);
    const problem = {
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
        prompt: `rate = k[A]^${exponent}, with k = ${formatSigFigs(coefficient, coefficientFigures)} ` +
            `and [A] = ${formatSigFigs(base, baseFigures)} mol/L. ` +
            `Work out the rate to ${answerSigFigs} significant figures.`,
    };
    return problem;
}
/** The per-unit quantities a fractions problem is built from. */
const RATES = [
    {
        amountName: 'moles of solute',
        amountUnit: 'mol',
        rateName: 'the concentration',
        flippedName: 'the volume one mole takes up',
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
        flippedName: 'the moles in one gram',
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
        flippedName: 'the volume one gram takes up',
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
        flippedName: 'the time one mole takes',
        rateUnit: 'mol/s',
        answerUnit: 's',
        min: 0.01,
        max: 5,
        rateMin: 0.002,
        rateMax: 0.4,
    },
];
function draftFractions(rng, tier, seed) {
    const shape = pick(rng, RATES);
    const answerSigFigs = drawSigFigs(rng);
    const amountFigures = nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
    const rateFigures = nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
    const amount = drawValue(rng, shape.min, shape.max, amountFigures);
    const upsideDown = tier === 2;
    const flippedUnit = invertUnits(parseUnit(shape.rateUnit));
    // THE STATED VALUE IS THE ONE DRAWN, whichever way up it is. Drawing the rate
    // and then stating its reciprocal would state a rounded number and grade
    // against the unrounded one it came from, so the correct answer would carry a
    // rounding the question never showed — which is the mistake `E-ROUND-EARLY`
    // exists to name, committed by the generator.
    const stated = upsideDown
        ? drawValue(rng, 1 / shape.rateMax, 1 / shape.rateMin, rateFigures)
        : drawValue(rng, shape.rateMin, shape.rateMax, rateFigures);
    const rate = state(upsideDown ? 'p' : FLIPPED_RATE_SYMBOL, upsideDown ? shape.flippedName : shape.rateName, stated, rateFigures, upsideDown ? formatUnit(flippedUnit) : shape.rateUnit);
    const problem = {
        topic: 'FRACTIONS',
        tier,
        seed,
        answerSigFigs,
        amount: state('n', shape.amountName, amount, amountFigures, shape.amountUnit),
        rate,
        upsideDown,
        flippedUnit: parseUnit(shape.rateUnit),
        amountName: shape.amountName,
        rateName: shape.rateName,
        answerUnit: parseUnit(shape.answerUnit),
        prompt: `You have ${formatSigFigs(amount, amountFigures)} ${shape.amountUnit} — ${shape.amountName}. ` +
            (upsideDown
                ? `${shape.flippedName[0]?.toUpperCase()}${shape.flippedName.slice(1)} is ` +
                    `${rate.written} ${formatUnit(flippedUnit)}. `
                : `${shape.rateName[0]?.toUpperCase()}${shape.rateName.slice(1)} is ` +
                    `${rate.written} ${shape.rateUnit}. `) +
            `How many ${shape.answerUnit}? Give it to ${answerSigFigs} significant figures.`,
    };
    return problem;
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
function chainsFor(substance, molarMassValue, densityValue) {
    const gramsToMoles = {
        label: `one mole of ${substance} weighs ${molarMassValue} g`,
        value: 1 / molarMassValue,
        unit: 'mol/g',
        consumes: 'g',
        produces: 'mol',
    };
    const molesToParticles = {
        label: 'a mole is 6.022 × 10²³ particles',
        value: 6.022e23,
        unit: 'particles/mol',
        consumes: 'mol',
        produces: 'particles',
    };
    const molesToLitres = {
        label: 'a mole of gas fills 22.414 L at STP',
        value: 22.414,
        unit: 'L/mol',
        consumes: 'mol',
        produces: 'L',
    };
    const kilogramsToGrams = {
        label: 'a kilogram is 1000 g',
        value: 1000,
        unit: 'g/kg',
        consumes: 'kg',
        produces: 'g',
    };
    const millilitresToGrams = {
        label: `${substance} has a density of ${densityValue} g/mL`,
        value: densityValue,
        unit: 'g/mL',
        consumes: 'mL',
        produces: 'g',
    };
    const litresToMillilitres = {
        label: 'a litre is 1000 mL',
        value: 1000,
        unit: 'mL/L',
        consumes: 'L',
        produces: 'mL',
    };
    // EVERY CHAIN IS AN EXPLICIT COMPOSITION, never links picked at random and
    // asked what comes out — that is how the generator once posed "convert 522 mL
    // into L·particles/g".
    //
    // The four-link chains exist because the third difficulty asked for a length
    // the table did not have and the generator starved: six hundred attempts,
    // "nothing drawable". Both are real chemistry — a volume of liquid weighed,
    // turned into moles, and then into particles or into the volume it fills as a
    // gas, which is the second one's whole point.
    return [
        [gramsToMoles, molesToParticles],
        [gramsToMoles, molesToLitres],
        [kilogramsToGrams, gramsToMoles, molesToParticles],
        [kilogramsToGrams, gramsToMoles, molesToLitres],
        [millilitresToGrams, gramsToMoles, molesToParticles],
        [millilitresToGrams, gramsToMoles, molesToLitres],
        [litresToMillilitres, millilitresToGrams, gramsToMoles, molesToParticles],
        [litresToMillilitres, millilitresToGrams, gramsToMoles, molesToLitres],
    ];
}
/** Substances with a molar mass, for the conversion chains. */
const SUBSTANCES = [
    { name: 'NaCl', molarMass: 58.44, density: 2.16 },
    { name: 'CO₂', molarMass: 44.01, density: 1.98 },
    { name: 'H₂O', molarMass: 18.02, density: 0.998 },
    { name: 'C₆H₁₂O₆', molarMass: 180.2, density: 1.54 },
    { name: 'KClO₃', molarMass: 122.5, density: 2.32 },
    { name: 'Fe₂O₃', molarMass: 159.7, density: 5.24 },
    { name: 'NH₃', molarMass: 17.03, density: 0.696 },
    { name: 'CaCO₃', molarMass: 100.1, density: 2.71 },
];
function draftUnits(rng, tier, seed) {
    const substance = pick(rng, SUBSTANCES);
    const answerSigFigs = drawSigFigs(rng);
    const all = chainsFor(substance.name, substance.molarMass, substance.density);
    // Tier is chain LENGTH, which is the thing that actually gets harder: every
    // extra link is another place to put a factor upside down.
    //
    // THREE BRANCHES, NOT TWO. This read `tier === 1 ? 2 : 3`, so tier 3 posed the
    // same three-link chains as tier 2 and the third difficulty existed only in
    // the constant. `tiers.test.ts` measures every step against the one below.
    const wantedLength = tier === 1 ? 2 : tier === 2 ? 3 : 4;
    const candidates = all.filter((chain) => chain.length === wantedLength);
    if (candidates.length === 0)
        return null;
    const chain = pick(rng, candidates);
    const startUnit = chain[0].consumes;
    const startFigures = nextInt(rng, 3, MAX_ANSWER_SIG_FIGS);
    const band = START_BANDS[startUnit];
    // A CHAIN WHOSE START HAS NO BAND IS A DEFECT IN THE TABLE, NOT AN UNDRAWABLE
    // DRAW. This returned null, so the fourth link's arrival — starting from L,
    // which START_BANDS did not carry — spent six hundred attempts and reported
    // "nothing drawable", which names neither the unit nor the table.
    if (band === undefined)
        throw new RangeError(`no starting band for ${startUnit}`);
    const startValue = drawValue(rng, band[0], band[1], startFigures);
    const factors = chain.map((link) => ({
        label: link.label,
        value: link.value,
        unit: parseUnit(link.unit),
    }));
    // DECLARED, not read back off the run. See `chainsFor`.
    const wantedUnit = parseUnit(chain[chain.length - 1].produces);
    const problem = {
        topic: 'UNITS',
        tier,
        seed,
        answerSigFigs,
        start: state('start', `what you are given, in ${startUnit}`, startValue, startFigures, startUnit),
        factors,
        wantedUnit,
        substance: substance.name,
        prompt: `Convert ${formatUnambiguous(startValue, startFigures)} ${startUnit} of ${substance.name} ` +
            `into ${formatUnit(wantedUnit)}, cancelling the units as you go. ` +
            `Give the answer to ${answerSigFigs} significant figures.`,
    };
    return problem;
}
/** What a chain may start from, and how much of it. A laboratory's amounts. */
const START_BANDS = {
    g: [0.5, 400],
    kg: [0.02, 4],
    mL: [1, 250],
    L: [0.02, 2],
};
/** What a significant-figures problem combines. */
const SIGFIG_SHAPES = [
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
function draftSigfigs(rng, tier, seed) {
    // Tier 1 is the single-rule shapes; the mixed one is where two rules apply in
    // order and is the hardest case in the topic, so it starts at tier 2.
    //
    // AND TIER 3 IS THAT CASE RATHER THAN MERELY ALLOWING IT. The filter read
    // `tier === 1 ? … : true`, so tier 3 drew from exactly the same pool as tier 2
    // and landed on the mixed shape only by chance. A difficulty that might be
    // harder is not a difficulty.
    const allowed = SIGFIG_SHAPES.filter((s) => {
        if (tier === 1)
            return s.operation !== 'ADD_THEN_MULTIPLY' && s.bands.length === 2;
        if (tier === 2)
            return true;
        return s.operation === 'ADD_THEN_MULTIPLY' || s.bands.length > 2;
    });
    const shape = pick(rng, allowed.length > 0 ? allowed : SIGFIG_SHAPES);
    const operands = shape.bands.map((band, i) => {
        const figures = nextInt(rng, 2, MAX_ANSWER_SIG_FIGS + 1);
        return state(`x${i + 1}`, shape.labels[i], drawValue(rng, band[0], band[1], figures), figures, shape.units[i]);
    });
    const problem = {
        topic: 'SIGFIGS',
        tier,
        seed,
        // Filled in by `solve`. The problem does not state a figure count, because
        // WORKING OUT the figure count is the thing being asked.
        answerSigFigs: MAX_ANSWER_SIG_FIGS,
        operation: shape.operation,
        operands,
        answerUnit: parseUnit(shape.answerUnit),
        prompt: shape.operation === 'ADD_THEN_MULTIPLY'
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
export function answerUnitFor(problem, solution) {
    return solution.answerUnit;
}
/** The precision an intermediate is entitled to, or null where nothing sets one. */
export function precisionAt(solution, stageId) {
    return solution.precisionAt[stageId] ?? null;
}
/** Every stated value in a problem, whatever its topic, for the tests. */
export function statedValues(problem) {
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
export { DIMENSIONLESS, divideUnits, formatUnit, multiplyUnits, parseUnit, sameUnit, lastPlaceOf, sigFigsFrom, };
