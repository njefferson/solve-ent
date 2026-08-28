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
  RELATIONS,
  shownSymbol,
  TIERS,
  laddersFor,
  posesTier,
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
  type StatedValue,
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
      if (!posesTier(topic, tier)) continue;
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
    // EVERY DIFFICULTY THE TOPIC HAS, not a tier number written here. This read
    // `generateProblem('WALL', topic, 2, 0)` — and two topics no longer have a
    // tier 2, so the wall would have gone unchecked at the difficulty they do
    // have.
    for (const difficulty of laddersFor(topic)) {
      const problem = generateProblem('WALL', topic, difficulty.tier, 0);
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
            `${topic} ${difficulty.name}: the problem carries ${stageId}'s value (${written}) where a screen can read it`,
          );
        }
      }
      // And the working, which is what a reveal shows, is on the SOLUTION.
      assert.ok(solution.working.length > 0, `${topic} has no working to show after an attempt`);
    }
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
      if (!posesTier(topic, tier)) continue;
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

test('the mixed significant-figures shape is posed often enough to exist', () => {
  // THE STARVATION CHECK, and it is here because the first version of this
  // shape's guarantees left three problems in six hundred. A case that exists
  // in the type and not in practice has been deleted while appearing to be
  // kept, and nothing else in the suite would have said so — every other test
  // asks whether the problems it GETS are correct.
  let mixed = 0;
  let total = 0;
  for (const tier of [2, 3]) {
    for (let index = 0; index < 200; index += 1) {
      const problem = generateProblem('MIXED', 'SIGFIGS', tier, index);
      if (problem.topic !== 'SIGFIGS') throw new Error('unreachable');
      total += 1;
      if (problem.operation === 'ADD_THEN_MULTIPLY') mixed += 1;
    }
  }
  assert.ok(mixed / total > 0.1, `only ${mixed} of ${total} were the mixed shape`);

  // And tier 1 is the single-rule shapes, deliberately.
  for (let index = 0; index < 60; index += 1) {
    const problem = generateProblem('MIXED', 'SIGFIGS', 1, index);
    if (problem.topic !== 'SIGFIGS') throw new Error('unreachable');
    assert.notEqual(problem.operation, 'ADD_THEN_MULTIPLY', 'the hardest case reached tier 1');
  }
});

test('the mixed shape applies BOTH rules, in order, and rounds once', () => {
  // Recomputed here from the written forms rather than from the engine's
  // precision machinery, which is the function under test.
  const written = (text: string): number => {
    const mantissa = text.split(/[eE]/)[0] as string;
    return Math.max(1, mantissa.replace('-', '').replace('.', '').replace(/^0+/, '').length);
  };
  const lastPlace = (text: string): number => {
    const point = text.indexOf('.');
    return point === -1 ? 0 : -(text.length - point - 1);
  };

  let checked = 0;
  for (const tier of [2, 3]) {
    for (let index = 0; index < 200; index += 1) {
      const problem = generateProblem('MIXED-RULE', 'SIGFIGS', tier, index);
      if (problem.topic !== 'SIGFIGS' || problem.operation !== 'ADD_THEN_MULTIPLY') continue;
      const solution = solve(problem);
      const [a, b, c] = problem.operands as [StatedValue, StatedValue, StatedValue];

      // Step one: the ADDITION rule limits the last decimal place.
      const sum = a.quantity.value + b.quantity.value;
      const coarsest = Math.max(lastPlace(a.written), lastPlace(b.written));
      const sumMagnitude = Number(Math.abs(sum).toExponential().split('e')[1]);
      const sumFigures = Math.max(1, sumMagnitude - coarsest + 1);
      assert.equal(solution.at['Gs'], sumFigures, `#${index}: the sum's entitlement`);

      // Step two: the MULTIPLICATION rule takes the fewest figures.
      assert.equal(
        solution.at['G2'],
        Math.min(sumFigures, written(c.written)),
        `#${index}: the answer's entitlement`,
      );

      // ROUNDED ONCE, from the truth. The sum enters the multiplication whole.
      assert.ok(
        Math.abs(solution.answer - Number((sum * c.quantity.value).toPrecision(solution.at['G2'] as number))) <
          Math.abs(solution.answer) * 1e-12,
        `#${index}: the sum was rounded before it was multiplied`,
      );

      // The stage asking about the sum is a COUNT and never grades figures —
      // asking for the sum ROUNDED would demand the intermediate be rounded,
      // which is the mistake this topic exists to teach against.
      const sumStage = stagesFor(problem).find((stage) => stage.id === 'Gs');
      assert.ok(sumStage !== undefined, `#${index}: no stage asks about the sum`);
      assert.equal(sumStage?.kind, 'COUNT');
      assert.equal(sumStage?.gradesSigFigs, false);
      checked += 1;
    }
  }
  assert.ok(checked > 30, `only ${checked} mixed problems were checked`);
});

test('a difficulty a topic does not pose is refused rather than quietly served', () => {
  // THIS USED TO ASK FOR TIER 0 and expect a `GenerationError`: no relation
  // sits at tier 0, so the draft came back empty six hundred times and the
  // generator gave up. That route is gone — difficulty is per topic now and the
  // ladder is checked before anything is drafted, so an unposed difficulty is
  // named and refused instead of being searched for.
  //
  // The claim the old name made — that a generator says so rather than
  // relaxing its own conditions — is carried by 'every generated problem keeps
  // every guarantee it was generated under', which re-checks the guarantees on
  // what came back rather than trusting that they ran.
  assert.throws(
    () => generateProblem('IMPOSSIBLE', 'REARRANGE', 0, 0),
    /REARRANGE has no tier 0/,
    'tier 0 is not a difficulty any topic declares',
  );
  assert.throws(
    () => generateProblem('IMPOSSIBLE', 'FRACTIONS', 3, 0),
    /FRACTIONS has no tier 3/,
    'fractions has two difficulties; the third must not fall back to one that exists',
  );
});

test('every symbol a relation names appears in the relation as written', () => {
  // A QUESTION THAT ASKS FOR A LETTER NOT IN THE EQUATION. IDEAL_GAS was
  // written `PV = nRT` and its symbols were keyed `Vg` and `ng`, so the prompt
  // read "Rearrange it for ng" and the step read "ng has to be separated from R
  // and T". The suffix was never needed — `symbols` is per-relation and three
  // other relations use a plain V — and nothing keyed off it. It had shipped
  // since the first release and was found by a drill on that exact move, which
  // is the first surface that ever showed the step on its own.
  //
  // Matched on the WRITTEN form with word-ish boundaries rather than by
  // substring, or `n` would be satisfied by the `n` inside `nRT`... which it
  // legitimately is. So: the symbol must appear, and a MULTI-CHARACTER symbol
  // must appear as a run rather than accidentally across two others.
  for (const relation of RELATIONS) {
    const written = relation.written;
    for (const symbol of Object.keys(relation.symbols)) {
      const info = relation.symbols[symbol];
      // A declared constant is not something a reader is asked to find in the
      // equation — R is in `PV = nRT`, but a relation may legitimately carry a
      // constant it does not print.
      if (info !== undefined && info.constant !== undefined) continue;
      const shown = shownSymbol(relation, symbol);
      assert.ok(
        written.includes(shown),
        `${relation.id} is written "${written}" and names a symbol shown as "${shown}" that is not in it — ` +
          'a question would ask a reader to rearrange for a letter they cannot see',
      );
    }
  }
});

test('and the symbol a problem asks for is one of that relation\'s own', () => {
  for (let i = 0; i < 300; i += 1) {
    const problem = generateProblem('symbols', 'REARRANGE', 3, i);
    // Narrowed rather than asserted: `Problem` is a union and only the
    // rearrangement arm has a relation, which is the type doing its job.
    if (problem.topic !== 'REARRANGE') continue;
    const relation = RELATIONS.find((r) => r.id === problem.relationId);
    assert.notEqual(relation, undefined, `${problem.relationId} is not a relation`);
    if (relation === undefined) continue;
    assert.ok(
      Object.keys(relation.symbols).includes(problem.solveFor),
      `${relation.id} asks for ${problem.solveFor}, which it does not define`,
    );
    assert.ok(
      problem.prompt.includes(relation.written),
      'the question does not show the relation it is asking about',
    );
  }
});

/**
 * A question has to carry the numbers it is asking about.
 *
 * ## Why this exists
 *
 * `statedValues` has existed since the engine did, and `tools/cli.ts` prints
 * it. **Nothing on the screen rendered it.** A rearranging question reached a
 * reader as "n × M = m relates moles, molar mass and mass. Rearrange it for n
 * and work out moles, to 3 significant figures" and then asked them to work out
 * moles — with no value for m or M anywhere on the page. Not hard: not
 * answerable, by anybody.
 *
 * **Every gate was green**, because the walk gets its answers from the engine
 * rather than off the screen, so it could always answer what a reader could
 * not.
 *
 * This is the engine half — that what a reader is shown contains everything a
 * step needs. `tools/walk.mjs` holds the other half, that the screen actually
 * renders it.
 */
test('everything a step needs is in the question or in the values beside it', () => {
  for (const topic of TOPICS) {
    for (const difficulty of laddersFor(topic)) {
      for (let index = 0; index < 12; index += 1) {
        let problem;
        try {
          problem = generateProblem('TEST-SHOWN', topic, difficulty.tier, index);
        } catch {
          continue;
        }
        const stated = statedValues(problem);
        const shown = [
          problem.prompt,
          ...stated.map((value) => `${value.symbol} ${value.written} ${formatUnit(value.unit)} ${value.label}`),
        ].join(' ');

        // A NUMBER TO WORK WITH. A question whose prompt states no figure at all
        // is relying entirely on the values beside it, and if there are none
        // there is nothing to compute from.
        assert.ok(
          /\d/.test(problem.prompt) || stated.length > 0,
          `${topic} tier ${String(difficulty.tier)} index ${String(index)} shows no number anywhere: ${problem.prompt}`,
        );

        // AND THE UNIT IT WANTS HAS A SOURCE. Not the whole unit as written —
        // deriving g/mL from a mass in g and a volume in mL is the skill — but
        // every FACTOR of it has to be somewhere a reader can see by then.
        //
        // WHAT THEY CAN SEE INCLUDES THE STEPS BEHIND THEM. A conversion chain
        // names its first factor in step one ("one mole of H₂O weighs 18.02 g")
        // and asks for moles in step two; the working log keeps step one on the
        // screen. Reading only the question would call that unanswerable and it
        // is not — the first version of this check did exactly that, on a topic
        // whose whole point is carrying a unit forward.
        const stages = stagesFor(problem);
        for (const [at, stage] of stages.entries()) {
          const unit = formatUnit(stage.unit);
          if (!stage.needsUnit || unit === '') continue;
          const bySoFar = [shown, ...stages.slice(0, at + 1).map((earlier) => earlier.prompt)].join(' ');
          for (const part of unit.split(/[/()·]/).map((piece) => piece.trim()).filter((piece) => piece !== '')) {
            assert.ok(
              bySoFar.includes(part),
              `${topic} tier ${String(difficulty.tier)} wants "${unit}" at ${stage.id} and a reader is never shown "${part}": ${problem.prompt}`,
            );
          }
        }
      }
    }
  }
});
