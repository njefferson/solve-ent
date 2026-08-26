/**
 * problem.test.ts — the generator, and what it refuses to ask.
 *
 * The two things this file is really about: a set is the same set on every
 * device from the same key, and every problem in it is one somebody could
 * actually be set. The second is the one that goes wrong silently, because a
 * problem asking for a kilogram of propane is a perfectly CORRECT problem and
 * nothing but a person reading it will object.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  TOPICS,
  checkGuarantees,
  countSigFigs,
  generateProblem,
  generateSet,
  generationReport,
  normalise,
  rearrangeParts,
  relationById,
  solve,
  statedValues,
  type Problem,
} from '../src/engine/problem.ts';
import { MAX_ANSWER_SIG_FIGS, MIN_ANSWER_SIG_FIGS } from '../src/engine/tolerance.ts';
import { hashString, makeRng, nextInt, pick } from '../src/engine/rng.ts';
import { stagesFor } from '../src/engine/taxonomy.ts';
import { formatUnit, runChain, sameUnit } from '../src/num/units.ts';

test('the same key produces the same set, every time', () => {
  const once = generateSet('CHEM-7B', 'REARRANGE', 2, 8);
  const again = generateSet('CHEM-7B', 'REARRANGE', 2, 8);
  assert.deepEqual(once, again);
  const different = generateSet('CHEM-7C', 'REARRANGE', 2, 8);
  assert.notDeepEqual(once, different, 'two keys produced the same set');
});

test('the generator is not Math.random wearing a hat', () => {
  // A stream pinned by its first draws, so a change to the generator is a
  // change somebody has to notice rather than a set of problems that quietly
  // becomes a different set of problems for a class already working on it.
  const rng = makeRng('PIN');
  const draws = [rng(), rng(), rng(), rng()];
  const again = makeRng('PIN');
  assert.deepEqual([again(), again(), again(), again()], draws);
  assert.equal(hashString('PIN'), hashString('PIN'));
  assert.notEqual(hashString('PIN'), hashString('PIM'));

  // Rejection sampling rather than a modulo fold: a fold makes the low values
  // fractionally likelier, which over ten thousand problems is a visible bias
  // in which problems a class sees.
  const counts = new Map<number, number>();
  const spread = makeRng('SPREAD');
  for (let i = 0; i < 60000; i += 1) {
    const draw = nextInt(spread, 0, 6);
    counts.set(draw, (counts.get(draw) ?? 0) + 1);
  }
  for (const [value, count] of counts) {
    assert.ok(Math.abs(count - 60000 / 7) < 900, `${value} came up ${count} times in 60000`);
  }
  assert.throws(() => pick(makeRng('X'), []), RangeError);
});

test('every problem is one somebody could actually be set', () => {
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 120; index += 1) {
        const problem = generateProblem('REAL', topic, tier, index);
        const solution = solve(problem);
        assert.ok(Number.isFinite(solution.answer), `${topic} #${index} has no answer`);
        assert.ok(problem.prompt.length > 30, `${topic} #${index} asks almost nothing`);
        assert.ok(
          problem.answerSigFigs >= MIN_ANSWER_SIG_FIGS && problem.answerSigFigs <= MAX_ANSWER_SIG_FIGS,
          `${topic} #${index} asks for ${problem.answerSigFigs} figures`,
        );
        for (const stated of statedValues(problem)) {
          assert.ok(Number.isFinite(stated.quantity.value), `${topic} #${index} states a non-number`);
          assert.ok(stated.written.length > 0, `${topic} #${index} states a value with nothing written`);
          if (stated.quantity.kind !== 'exact') {
            assert.ok(countSigFigs(stated) >= 2, `${topic} #${index} states a one-figure measurement`);
          }
        }
      }
    }
  }
});

test('a problem carries no answer, and no intermediate', () => {
  // THE TYPE IS THE WALL. Checked over the serialised problem rather than by
  // reading the type, because what a screen gets handed is the object.
  for (const topic of TOPICS) {
    const problem = generateProblem('WALL', topic, 2, 0);
    const solution = solve(problem);
    const serialised = JSON.stringify(problem);
    // SCOPED TO THE STAGES THE PROBLEM ACTUALLY HAS. A value in `at` for a
    // stage nobody is asked is not an answer that could leak — and the first
    // version of this check, walking the whole map, reported one that was
    // simply a stated value under another name.
    const asked = new Set(stagesFor(problem).map((stage) => stage.id));
    for (const [stageId, value] of Object.entries(solution.at)) {
      if (!asked.has(stageId)) continue;
      if (!Number.isFinite(value) || value === 0) continue;
      for (const figures of [3, 4, 5, 6]) {
        const written = value.toPrecision(figures);
        assert.ok(
          !serialised.includes(written),
          `${topic}: the problem carries ${stageId}'s value (${written}) where a screen can read it`,
        );
      }
    }
    // And the working, which is what a reveal shows, is on the SOLUTION.
    assert.ok(solution.working.length > 0, `${topic} has no working to show after an attempt`);
  }
});

test('the answer to a rearrangement is what the relation says it is', () => {
  // Recomputed from the relation's own definition rather than from `solve`,
  // which is the function under test.
  for (const tier of TIERS) {
    for (let index = 0; index < 150; index += 1) {
      const problem = generateProblem('REARR', 'REARRANGE', tier, index);
      if (problem.topic !== 'REARRANGE') throw new Error('unreachable');
      const relation = relationById(problem.relationId);
      assert.ok(relation !== undefined);
      const solution = solve(problem);
      if (relation.shape === 'OFFSET') {
        const onLeft = relation.left.includes(problem.solveFor);
        const other = (onLeft ? relation.right : relation.left)[0] as string;
        const otherValue = problem.given.find((g) => g.symbol === other)?.quantity.value as number;
        const expected = onLeft ? otherValue + (relation.offset ?? 0) : otherValue - (relation.offset ?? 0);
        assert.ok(Math.abs(solution.answer - expected) < 1e-9, `${problem.relationId} #${index}`);
        continue;
      }
      const { rest, otherProduct } = rearrangeParts(problem);
      const expected = otherProduct / rest.reduce((a, r) => a * r.value, 1);
      assert.ok(
        Math.abs(solution.answer - expected) / Math.abs(expected) < 1e-12,
        `${problem.relationId} #${index}: ${solution.answer} against ${expected}`,
      );
    }
  }
});

test('a conversion chain composes, and ends where the problem says it does', () => {
  // THE CHECK THAT COULD NOT FAIL, until it could. The first version compared
  // the chain's arrived unit against a `wantedUnit` read off the same run —
  // two expressions of one computation, agreeing forever, while the generator
  // posed "convert 522 mL into L·particles/g". The target is declared by the
  // chain now and this compares the arithmetic against the declaration.
  for (const tier of TIERS) {
    for (let index = 0; index < 120; index += 1) {
      const problem = generateProblem('CHAIN', 'UNITS', tier, index);
      if (problem.topic !== 'UNITS') throw new Error('unreachable');
      const ran = runChain(problem.start.quantity.value, problem.start.unit, problem.factors);
      assert.ok(
        sameUnit(ran.unit, problem.wantedUnit),
        `chain #${index} ends in ${formatUnit(ran.unit)}, asked for ${formatUnit(problem.wantedUnit)}`,
      );
      // A single unit on top and nothing underneath. A chain ending in a
      // compound has not converted anything, it has stirred.
      assert.equal(ran.unit.num.length, 1, `chain #${index} ends in ${formatUnit(ran.unit)}`);
      assert.equal(ran.unit.den.length, 0, `chain #${index} ends in ${formatUnit(ran.unit)}`);
      assert.ok(problem.factors.length >= 2, `chain #${index} has ${problem.factors.length} link`);
    }
  }
});

test('scientific notation normalises to a front number between one and ten', () => {
  for (const value of [1234.5, 0.00456, 6.022e23, 1, 9.999e-13]) {
    const { mantissa, exponent } = normalise(value);
    assert.ok(Math.abs(mantissa) >= 1 && Math.abs(mantissa) < 10, `${value} normalised to ${mantissa}`);
    assert.ok(Math.abs(mantissa * 10 ** exponent - value) / value < 1e-12);
  }
  assert.deepEqual(normalise(0), { mantissa: 0, exponent: 0 });
});

test('the generator refuses candidates, and says which guarantee refused them', () => {
  // A generator that never refuses anything has no guarantees worth the name,
  // and one whose report is empty cannot be read to find out which condition
  // is doing the work.
  let refusals = 0;
  const named = new Set<string>();
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 60; index += 1) {
        generateProblem('REFUSALS', topic, tier, index);
        const report = generationReport('REFUSALS', topic, tier, index);
        assert.ok(report.attempts >= 1, `${topic} #${index} reports no attempts`);
        for (const [name, count] of Object.entries(report.rejected)) {
          refusals += count;
          named.add(name);
        }
      }
    }
  }
  assert.ok(refusals > 100, `only ${refusals} candidates were ever refused`);
  assert.ok(named.size >= 8, `only ${named.size} distinct guarantees ever fired: ${[...named].join(', ')}`);
});

test('a guarantee refuses a candidate that breaks it', () => {
  // PLANTED, because a guarantee that has never been seen to refuse anything
  // is a hypothesis. Each of these is a real degenerate case built by hand.
  const oneToOne = generateProblem('PLANT', 'PROPORTION', 1, 0);
  if (oneToOne.topic !== 'PROPORTION') throw new Error('unreachable');
  const flat: Problem = { ...oneToOne, to: { ...oneToOne.to, quantity: oneToOne.from.quantity } };
  assert.ok(
    checkGuarantees(flat).includes('RATIO_NOT_UNITY'),
    'a one-to-one ratio was accepted, and it makes three misconceptions one answer',
  );

  const chain = generateProblem('PLANT', 'UNITS', 1, 0);
  if (chain.topic !== 'UNITS') throw new Error('unreachable');
  const inert: Problem = {
    ...chain,
    factors: chain.factors.map((f, i) => (i === 0 ? { ...f, value: 1 } : f)),
  };
  assert.ok(
    checkGuarantees(inert).includes('NO_FACTOR_NEAR_UNITY'),
    'a conversion factor of one was accepted, and leaving it out is not a mistake',
  );

  const gas = generateProblem('PLANT', 'SCINOT', 2, 0);
  if (gas.topic !== 'SCINOT') throw new Error('unreachable');
  const flatExponent: Problem = { ...gas, firstExponent: 0 };
  assert.ok(
    checkGuarantees(flatExponent).includes('EXPONENTS_NOT_DEGENERATE'),
    'an exponent of zero was accepted, and it makes adding and multiplying them the same',
  );
});

test('a topic the generator cannot satisfy says so rather than lowering a guarantee', () => {
  // The failure mode being refused here is a generator that relaxes its own
  // conditions to find something to pose — which is a generator that poses the
  // problem the guarantee existed to refuse.
  assert.throws(
    () => generateProblem('IMPOSSIBLE', 'REARRANGE', 0, 0),
    (error: unknown) => error instanceof Error && error.name === 'GenerationError',
    'tier 0 has no relations in it and should have been refused',
  );
});
