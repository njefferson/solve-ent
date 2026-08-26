#!/usr/bin/env node
/**
 * verify-algebra.mjs — the algebra is right, checked from OUTSIDE the engine.
 *
 *   node tools/verify-algebra.mjs
 *
 * ## Why this is not another test
 *
 * `npm test` is thorough and it is self-referential in one specific way: it
 * asks the engine whether the engine agrees with itself. `solve()` produces the
 * answer, `correctEntryFor` writes it down, and `classify` accepts it. All
 * three could share one mistake and the suite would stay green.
 *
 * So this recomputes the algebra INDEPENDENTLY, and the strongest check here is
 * the first one: rather than working a rearrangement out again the same way,
 * it SUBSTITUTES THE APP'S ANSWER BACK INTO THE RELATION and asks whether both
 * sides balance. That cannot share a mistake with the solver, because it is not
 * doing the same operation — a solver that divides where it should multiply
 * produces an answer that does not satisfy the equation, whatever it believes.
 *
 * The published constants are typed in BY HAND from their sources, because
 * everything else in this repository derives from the same table the engine
 * uses, and a wrong constant would be invisible to all of it.
 *
 * ## A trap this file has to avoid
 *
 * Checking a rounded answer against the CARRIED value re-rounded is DOUBLE
 * ROUNDING: 0.0148497 carried at five figures is 0.01485, and rounding that to
 * three gives 0.0149 where the true value gives 0.0148. That is the exact
 * mistake E-SIG-ROUND-EARLY exists to diagnose, committed by the thing auditing
 * the catcher. Round from the truth, once.
 */

import { TIERS, TOPICS, generateProblem, posesTier, relationById, solve } from '../src/engine/problem.ts';
import { correctEntryFor, requiredSigFigs, stagesFor } from '../src/engine/taxonomy.ts';
import { runChain } from '../src/num/units.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';

let failures = 0;
const fail = (message) => {
  console.log(`  FAIL  ${message}`);
  failures += 1;
};
const ok = (message) => console.log(`  ok    ${message}`);

console.log('\n=== the algebra, checked from outside the engine · Solve-ent ===\n');

/* ------------------------------------------------------------------ */
/* 1. published constants, typed by hand                               */
/* ------------------------------------------------------------------ */

// FROM PUBLISHED SOURCES, typed here rather than imported. This is the only
// check in the repository that can see a wrong molar mass or a wrong
// conversion factor, because everything else derives from the same table the
// engine does.
//
// Molar masses computed from the IUPAC conventional atomic weights; the
// Avogadro constant is the SI defining value; the molar volume at STP is
// 22.414 L/mol at 273.15 K and 1 atm.
const PUBLISHED_MOLAR_MASSES = [
  ['NaCl', 58.44],
  ['CO₂', 44.01],
  ['H₂O', 18.02],
  ['C₆H₁₂O₆', 180.16],
  ['KClO₃', 122.55],
  ['Fe₂O₃', 159.69],
  ['NH₃', 17.03],
  ['CaCO₃', 100.09],
];
const PUBLISHED_AVOGADRO = 6.02214076e23;
const PUBLISHED_MOLAR_VOLUME_L = 22.414;
const PUBLISHED_GRAMS_PER_KG = 1000;

// 0.1 g/mol absorbs which published table a value was taken from and how many
// figures the engine's own table carries; a real mistake in a molar mass is
// far larger than that.
const MASS_TOLERANCE = 0.1;
// The Avogadro constant appears in the engine to four figures, so a relative
// comparison is the only honest one.
const CONSTANT_TOLERANCE = 1e-3;

/** Every distinct conversion factor the generator can put in a chain. */
function chainFactorsSeen() {
  const byLabel = new Map();
  for (const tier of TIERS) {
    if (!posesTier('UNITS', tier)) continue;
    for (let index = 0; index < 300; index += 1) {
      const problem = generateProblem('VERIFY', 'UNITS', tier, index);
      for (const factor of problem.factors) byLabel.set(factor.label, factor.value);
    }
  }
  return byLabel;
}

{
  const seen = chainFactorsSeen();
  let worst = 0;
  let worstName = '';
  const check = (name, got, published) => {
    const off = Math.abs(got - published) / Math.abs(published);
    if (off > worst) {
      worst = off;
      worstName = name;
    }
    if (off > CONSTANT_TOLERANCE) {
      fail(`${name}: the engine uses ${got}, published is ${published} — off by ${(off * 100).toFixed(3)}%`);
    }
  };

  for (const [label, value] of seen) {
    if (label.includes('6.022')) check('the Avogadro constant', value, PUBLISHED_AVOGADRO);
    else if (label.includes('22.414')) check('the molar volume at STP', value, PUBLISHED_MOLAR_VOLUME_L);
    else if (label.includes('kilogram')) check('grams in a kilogram', value, PUBLISHED_GRAMS_PER_KG);
    else if (label.includes('weighs')) {
      // "one mole of NaCl weighs 58.44 g" — the factor is 1/M, so M is 1/value.
      const substance = label.split(' ')[3];
      const published = PUBLISHED_MOLAR_MASSES.find(([name]) => name === substance);
      if (published === undefined) {
        fail(`${substance} has no hand-typed molar mass to check against`);
        continue;
      }
      const got = 1 / value;
      const off = Math.abs(got - published[1]);
      if (off > MASS_TOLERANCE) {
        fail(`${substance}: the engine uses ${got.toFixed(3)} g/mol, published is ${published[1]}`);
      }
    }
  }
  if (failures === 0) {
    ok(
      `${seen.size} conversion factors match values typed by hand from published sources ` +
        `(worst: ${worstName || 'none'}, off by ${(worst * 100).toFixed(4)}%)`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* 2. every rearrangement satisfies its own relation                   */
/* ------------------------------------------------------------------ */

// THE STRONGEST CHECK IN THIS FILE, because it is not the same operation. The
// answer goes back INTO the equation and both sides are compared. A solver
// that divides where it should multiply cannot pass this however consistent it
// is with itself.
{
  let checked = 0;
  let worst = 0;
  for (const tier of TIERS) {
    if (!posesTier('REARRANGE', tier)) continue;
    for (let index = 0; index < 400; index += 1) {
      const problem = generateProblem('VERIFY', 'REARRANGE', tier, index);
      const relation = relationById(problem.relationId);
      const solution = solve(problem);
      const valueOf = (symbol) => {
        if (symbol === problem.solveFor) return solution.answer;
        const info = relation.symbols[symbol];
        if (info?.constant !== undefined) return info.constant;
        const stated = problem.given.find((g) => g.symbol === symbol);
        if (stated === undefined) throw new Error(`${problem.relationId} states no ${symbol}`);
        return stated.quantity.value;
      };

      if (relation.shape === 'OFFSET') {
        const left = valueOf(relation.left[0]);
        const right = valueOf(relation.right[0]) + relation.offset;
        const off = Math.abs(left - right);
        if (off > 1e-9) fail(`${problem.relationId} #${index}: ${left} against ${right}`);
        worst = Math.max(worst, off);
      } else {
        const left = relation.left.reduce((a, s) => a * valueOf(s), 1);
        const right = relation.right.reduce((a, s) => a * valueOf(s), 1);
        const off = Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right));
        if (off > 1e-12) {
          fail(`${problem.relationId} #${index}: ${relation.written} gives ${left} against ${right}`);
        }
        worst = Math.max(worst, off);
      }
      checked += 1;
    }
  }
  if (failures === 0) {
    ok(`${checked} rearranged answers substituted back into their own relation, all balancing (worst ${worst.toExponential(2)})`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. every other topic's answer, worked out here                      */
/* ------------------------------------------------------------------ */

{
  let checked = 0;
  const relative = (a, b) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)));

  for (const tier of TIERS) {
    for (let index = 0; index < 300; index += 1) {
      /* proportions — the mole ratio, worked by hand */
      if (posesTier('PROPORTION', tier)) {
        const problem = generateProblem('VERIFY', 'PROPORTION', tier, index);
        const expected =
          (problem.have.quantity.value / problem.from.quantity.value) * problem.to.quantity.value;
        const got = solve(problem).answer;
        if (relative(expected, got) > 1e-12) fail(`PROPORTION #${index}: by hand ${expected}, the app says ${got}`);
        checked += 1;
      }

      /* scientific notation — plain arithmetic, no notation involved */
      if (posesTier('SCINOT', tier)) {
        const problem = generateProblem('VERIFY', 'SCINOT', tier, index);
        const first = problem.firstMantissa * 10 ** problem.firstExponent;
        const second = problem.secondMantissa * 10 ** problem.secondExponent;
        const expected = problem.operation === 'MULTIPLY' ? first * second : first / second;
        const got = solve(problem).answer;
        if (relative(expected, got) > 1e-9) fail(`SCINOT #${index}: by hand ${expected}, the app says ${got}`);
        // And the normalised form has to be normalised.
        const solution = solve(problem);
        const shownExponent = solution.at['N3'];
        const mantissa = solution.answer / 10 ** shownExponent;
        if (!(Math.abs(mantissa) >= 1 && Math.abs(mantissa) < 10)) {
          fail(`SCINOT #${index}: normalised to ${mantissa} × 10^${shownExponent}`);
        }
        checked += 1;
      }

      /* powers and roots */
      if (posesTier('POWERS', tier)) {
        const problem = generateProblem('VERIFY', 'POWERS', tier, index);
        const base = problem.base.quantity.value;
        const expected =
          problem.direction === 'ROOT'
            ? Math.pow(base, 1 / problem.exponent)
            : problem.coefficient.quantity.value * Math.pow(base, problem.exponent);
        const got = solve(problem).answer;
        if (relative(expected, got) > 1e-12) fail(`POWERS #${index}: by hand ${expected}, the app says ${got}`);
        checked += 1;
      }

      /* fractions — dividing by a rate */
      if (posesTier('FRACTIONS', tier)) {
        const problem = generateProblem('VERIFY', 'FRACTIONS', tier, index);
        // BOTH WAYS UP, worked out here rather than asked for. Where the
        // question states the reciprocal, dividing by what it printed is the
        // mistake — the answer multiplies by it.
        const expected = problem.upsideDown
          ? problem.amount.quantity.value * problem.rate.quantity.value
          : problem.amount.quantity.value / problem.rate.quantity.value;
        const got = solve(problem).answer;
        if (relative(expected, got) > 1e-12) fail(`FRACTIONS #${index}: by hand ${expected}, the app says ${got}`);
        checked += 1;
      }

      /* dimensional analysis — the chain, multiplied out here */
      if (posesTier('UNITS', tier)) {
        const problem = generateProblem('VERIFY', 'UNITS', tier, index);
        let expected = problem.start.quantity.value;
        for (const factor of problem.factors) expected *= factor.value;
        const got = solve(problem).answer;
        if (relative(expected, got) > 1e-12) fail(`UNITS #${index}: by hand ${expected}, the app says ${got}`);
        // AND EVERY INTERMEDIATE, worked out here link by link. The final
        // answer being right says nothing about what the stages in between
        // are graded against — `solve` handed the whole chain's value to the
        // stage that asks for the first link's, and every test agreed with it
        // because every test read the same field.
        const solution = solve(problem);
        const afterFirst = problem.start.quantity.value * problem.factors[0].value;
        if (relative(afterFirst, solution.at['U2']) > 1e-12) {
          fail(`UNITS #${index}: after the first link by hand ${afterFirst}, the app grades U2 against ${solution.at['U2']}`);
        }
        // And the units have to cancel to what the problem asks for.
        const ran = runChain(problem.start.quantity.value, problem.start.unit, problem.factors);
        const wanted = problem.wantedUnit;
        const same =
          ran.unit.num.join('·') === wanted.num.join('·') && ran.unit.den.join('·') === wanted.den.join('·');
        if (!same) fail(`UNITS #${index}: the chain ends in a unit the problem does not ask for`);
        checked += 1;
      }

      /* significant figures — both rules, applied here */
      if (posesTier('SIGFIGS', tier)) {
        const problem = generateProblem('VERIFY', 'SIGFIGS', tier, index);
        const values = problem.operands.map((o) => o.quantity.value);

        // THE MIXED SHAPE, worked here from the WRITTEN forms rather than from
        // the engine's precision machinery — which is the point of this file.
        // Add first: the coarsest last decimal place among the two addends
        // limits the sum, and how many significant figures that leaves depends
        // on where the sum's leading digit lands. Then multiply: the fewest
        // significant figures between that sum and the last measurement.
        if (problem.operation === 'ADD_THEN_MULTIPLY') {
          const solution = solve(problem);
          const sum = values[0] + values[1];
          const coarsest = Math.max(
            lastPlaceWritten(problem.operands[0].written),
            lastPlaceWritten(problem.operands[1].written),
          );
          const sumMagnitude = Number(Math.abs(sum).toExponential().split('e')[1]);
          const sumFigures = Math.max(1, sumMagnitude - coarsest + 1);
          if (sumFigures !== solution.at['Gs']) {
            fail(`SIGFIGS #${index} mixed: by hand the sum carries ${sumFigures} figures, the app says ${solution.at['Gs']}`);
          }
          const answerFigures = Math.min(sumFigures, sigFigsWritten(problem.operands[2].written));
          if (answerFigures !== solution.at['G2']) {
            fail(`SIGFIGS #${index} mixed: by hand the answer carries ${answerFigures}, the app says ${solution.at['G2']}`);
          }
          // FROM THE TRUTH, ONCE — the sum goes in unrounded.
          const expectedMixed = Number((sum * values[2]).toPrecision(answerFigures));
          if (relative(expectedMixed, solution.answer) > 1e-12) {
            fail(`SIGFIGS #${index} mixed: by hand ${expectedMixed}, the app says ${solution.answer}`);
          }
          checked += 1;
          continue;
        }

        const raw =
          problem.operation === 'MULTIPLY'
            ? values.reduce((a, b) => a * b, 1)
            : values.reduce((a, b) => a + b, 0);
        const solution = solve(problem);
        const figures = solution.at['G2'];
        // FROM THE TRUTH, ONCE. Re-rounding the app's own rounded answer would
        // be the double rounding this file's header warns about.
        const expected = Number(raw.toPrecision(figures));
        if (relative(expected, solution.answer) > 1e-12) {
          fail(`SIGFIGS #${index}: by hand ${expected} at ${figures} figures, the app says ${solution.answer}`);
        }
        // The figure count itself, worked out here from the operands' own
        // precisions rather than read off the engine.
        const expectedFigures =
          problem.operation === 'MULTIPLY'
            ? Math.min(...problem.operands.map((o) => sigFigsWritten(o.written)))
            : sigFigsOfSum(problem.operands, raw);
        if (expectedFigures !== figures) {
          fail(`SIGFIGS #${index}: by hand ${expectedFigures} figures, the app says ${figures}`);
        }
        checked += 1;
      }
    }
  }
  if (failures === 0) ok(`${checked} answers recomputed by hand across six topics, all matching`);
}

/** How many significant figures a written number writes. */
function sigFigsWritten(text) {
  const mantissa = String(text).split(/[eE]/)[0];
  const digits = mantissa.replace('-', '').replace('.', '').replace(/^0+/, '');
  return Math.max(1, digits.length);
}

/** Where the last significant digit of a written number sits. */
function lastPlaceWritten(text) {
  const raw = String(text);
  const [mantissa, exponentText] = raw.split(/[eE]/);
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const point = mantissa.indexOf('.');
  if (point === -1) return exponent;
  return exponent - (mantissa.length - point - 1);
}

/** The figure count an addition is entitled to, from the coarsest last place. */
function sigFigsOfSum(operands, raw) {
  let coarsest = -Infinity;
  for (const operand of operands) coarsest = Math.max(coarsest, lastPlaceWritten(operand.written));
  const magnitude = Number(Math.abs(raw).toExponential().split('e')[1]);
  return Math.max(1, magnitude - coarsest + 1);
}

/* ------------------------------------------------------------------ */
/* 4. every written answer writes the figures it claims                */
/* ------------------------------------------------------------------ */

{
  let written = 0;
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      if (!posesTier(topic, tier)) continue;
      for (let index = 0; index < 120; index += 1) {
        const problem = generateProblem('VERIFY', topic, tier, index);
        const solution = solve(problem);
        const required = requiredSigFigs(problem, solution);
        for (const stage of stagesFor(problem)) {
          if (!stage.gradesSigFigs) continue;
          const entry = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
          const numberPart = entry.text.match(/^[+-]?[\d.,]+(?:[eE][+-]?\d+)?/)[0];
          const claims = sigFigsWritten(numberPart.replace(/\.$/, ''));
          if (claims !== required) {
            fail(`${topic} #${index} ${stage.id}: writes "${entry.text}", which is ${claims} figures where ${required} were asked`);
          }
          // FROM THE TRUTH, ONCE.
          const truth = solution.at[stage.id];
          const want = Number(truth.toPrecision(required));
          const got = Number(numberPart.replace(/,/g, '').replace(/\.$/, ''));
          if (Math.abs(want - got) > Math.abs(want) * 1e-12) {
            fail(`${topic} #${index} ${stage.id}: writes ${got}, but ${truth} at ${required} figures is ${want}`);
          }
          written += 1;
        }
      }
    }
  }
  if (failures === 0) ok(`${written} written answers write the figures they claim, rounded from the truth`);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s). The algebra is what this app is for.\n`);
  process.exit(1);
}
console.log('\nThe algebra holds, checked without asking the engine to mark its own work.\n');
