/**
 * tolerance.ts — every numeric tolerance in the engine, named, with the
 * judgement behind it written beside it.
 *
 * No inline literals anywhere else. A tolerance buried in an expression is a
 * decision nobody can find later, and every one of these encodes a judgement
 * about what a student meant or about what this app will refuse to ask.
 *
 * PURE data. No I/O, no globals, no clock.
 */

/**
 * Float slop allowed after both sides have been rounded to the same number of
 * significant figures. Not a grading tolerance — it exists because 0.1 + 0.2 is
 * not 0.3 — so it is as tight as the arithmetic permits.
 */
export const FLOAT_SLOP_RELATIVE = 1e-9;

/**
 * How far apart two candidate values must be before the classifier will treat
 * them as telling different stories. Predictions closer than this at the
 * student's own precision are INDISTINGUISHABLE, and the classifier says so
 * rather than picking one.
 */
export const DISTINGUISHABLE_RELATIVE = 1e-6;

/**
 * An unmatched entry within this many orders of magnitude of correct is an
 * arithmetic slip; beyond that it is E-UNCLASSIFIED, which is COUNTED, because
 * the unclassified rate is the metric that says whether the taxonomy needs
 * work.
 */
export const ORDER_OF_MAGNITUDE_LIMIT = 1;

/**
 * How far out a COUNTED answer can be and still be called near.
 *
 * **A COUNT STAGE MUST NOT BE MEASURED IN ORDERS OF MAGNITUDE.** An exponent
 * and a number of significant figures are already counts; taking a log ratio of
 * one against another asks how many times bigger a count is than a count, which
 * is not a question about the step. It also throws the sign away, so on a step
 * whose correct answer was -9 the entries -10 and 10 came back with the SAME
 * distance, and 1 came back inside an order of magnitude of -9. Practically
 * every whole number in either sign read as near.
 *
 * Two, because a count is wrong by one when a digit is miscounted or an
 * exponent is off by a step, and by two when that happens at both ends. Beyond
 * that a different move was used, and this must not pretend to know which.
 */
export const COUNT_NEAR_LIMIT = 2;

/**
 * An arithmetic slip bigger than about a factor of three is a decimal-place
 * mistake rather than a miscount, and gets the magnitude help rather than the
 * "check your arithmetic" help. Below E-UNCLASSIFIED's cutoff by construction.
 */
export const SCINOT_TRIGGER_LOG10 = 0.5;

/** Final answers carry between this many significant figures... */
export const MIN_ANSWER_SIG_FIGS = 2;
/** ...and this many. */
export const MAX_ANSWER_SIG_FIGS = 4;

/** How many PRNG draws a generator may reject before it admits it is stuck. */
export const MAX_GENERATION_ATTEMPTS = 600;

/* ------------------------------------------------------------------ */
/* The separation margins the generation guarantees are stated in       */
/* ------------------------------------------------------------------ */

/**
 * How far apart two MEASURED quantities have to sit before turning one of them
 * upside down is a different question. Stated as a fraction: |a/b - 1| must be
 * at least this.
 *
 * MEASURED, and that word is doing work. A mole ratio is COUNTED — its two
 * numbers are coefficients from a balanced equation — so the condition there
 * is exact equality and a tolerance has nothing to absorb. Used with one, this
 * band refused the perfectly good 4:5 recipe, and refused it by a
 * floating-point hair: |0.8 - 1| computes as 0.19999999999999996.
 */
export const RATIO_MARGIN = 0.2;

/**
 * How far a stated quantity has to sit from 1 before multiplying by it and
 * dividing by it are different questions.
 *
 * Multiplying by a rate and dividing by it agree exactly when the rate is 1.
 * That is not a near-miss, it is an identity — so the generator refuses to pose
 * a per-unit problem whose rate sits inside this band of it.
 */
export const UNITY_MARGIN = 0.25;

/**
 * How far apart, as a ratio, two conversion factors in one chain must sit.
 *
 * Dropping factor A and dropping factor B produce the same answer when the two
 * factors are equal, so the chain would be attributing a specific dropped link
 * to a number that names two of them. Also stated as a fraction of the larger.
 */
export const FACTOR_SEPARATION = 0.25;

/**
 * ONE PRECISION GOVERNS EVERYTHING, and this is the note that says why there
 * is not a second one.
 *
 * A first version read a student's entry at the precision they wrote, floored
 * at two figures, while judging CORRECTNESS at the problem's own precision.
 * Two readings of one entry, and the gap between them is a misdiagnosis: an
 * answer written to two figures in a four-figure problem failed the
 * correctness check at four and then matched a predicted mistake at two, so a
 * student who had the right value and rounded it badly was told they held a
 * misconception they did not.
 *
 * So diagnosis and grading are both done at no less than the problem's own
 * precision. The cost is a MISSED diagnosis rather than a wrong one — an entry
 * too coarse to attribute comes back E-UNCLASSIFIED, which is counted and
 * reported. That is the right way round: attribution is the product, and a
 * guess reported as a diagnosis is worth less than nothing.
 *
 * There is no separate floor constant, because {@link MIN_ANSWER_SIG_FIGS} is
 * already the coarsest precision any problem is graded to.
 */

/**
 * The smallest and largest magnitude a stated everyday quantity may take.
 *
 * These are the limits of a school laboratory rather than the limits of
 * arithmetic. MoleBridge's generator posed a kilogram of propane because its
 * range came from what a float can hold, and every one of those problems was
 * correct — which is why no test objected. A quantity has to be one somebody
 * could actually weigh, pour or read off a gauge.
 */
export const MIN_EVERYDAY = 1e-3;
/** The largest ordinary stated quantity. */
export const MAX_EVERYDAY = 5e3;

/**
 * The exponent range scientific-notation problems draw from.
 *
 * Wide enough that the notation is doing real work — a student who can write
 * 6.02e23 without understanding it will not survive 10^-7 — and narrow enough
 * that the numbers are ones chemistry actually produces.
 */
export const MIN_EXPONENT = -12;
/** The largest exponent posed. */
export const MAX_EXPONENT = 24;

/**
 * How many significant figures the reveal and the worked lines carry.
 *
 * Two GUARD DIGITS beyond the answer's own precision, which is the rule a
 * course teaches anyway. Showing an intermediate at exactly its significant
 * figures is right, and a student who types that into the next step has
 * rounded early — E-SIG-ROUND-EARLY predicts precisely that value, so the app
 * would diagnose a student for doing what it had just told them.
 */
export const REVEAL_GUARD_DIGITS = 2;

/**
 * The precision the simulated student carries.
 *
 * This exists to DRIVE a session — the tests and the harness submit its result
 * — and a simulated student has to carry full precision or it trips
 * E-SIG-ROUND-EARLY by accident. Twelve figures is load-bearing here and is
 * not a number to show a person.
 */
export const SCRATCH_SIG_FIGS = 12;
