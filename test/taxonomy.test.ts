/**
 * taxonomy.test.ts — THE test. Everything else in this directory supports it.
 *
 * Two questions, and they are the two numbers this session exists to produce:
 *
 *   1. Do any two error classes predict something a student could not tell
 *      apart? The answer must be none, over at least ten thousand generated
 *      problems, and the count is printed WITH the number of problems it was
 *      measured over — a zero from a sweep of ten and a zero from a sweep of
 *      ten thousand are different claims.
 *
 *   2. What fraction of deliberately wrong entries can the taxonomy not
 *      account for? That is the E-UNCLASSIFIED rate, and it is REPORTED rather
 *      than suppressed, because it is the number that says whether the
 *      decomposition is any good.
 *
 * And a third that keeps the first two honest: how often did the generator
 * reject a candidate, and under which guarantee? A structural guarantee
 * rejecting the occasional degenerate draw is the decomposition working. The
 * declared BACKSTOP doing most of the rejecting would mean the sweep is
 * measuring the generator's own separation test and could not report anything
 * else (hub LESSONS 141), so the count is printed beside the collisions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  TOPICS,
  checkGuarantees,
  generateProblem,
  generationReport,
  indistinguishable,
  solve,
  type Problem,
  type Topic,
} from '../src/engine/problem.ts';
import {
  CLASS_MEANINGS,
  COUNTER_SKILLS,
  ERROR_CLASSES,
  choiceOptionsFor,
  classify,
  collisionsFor,
  correctEntryFor,
  predictionsFor,
  readEntry,
  remediesFor,
  requiredSigFigs,
  stagesFor,
  type Collision,
  type ErrorClass,
  type Prediction,
  type Stage,
} from '../src/engine/taxonomy.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';
import { formatSigFigs, formatUnambiguous, measured } from '../src/num/sigfig.ts';
import { formatUnit } from '../src/num/units.ts';

/**
 * How many problems per topic and tier the collision sweep runs over.
 *
 * 500 x 7 topics x 3 tiers is 10,500, which clears the ten thousand the
 * specification asks for with the number written here rather than implied by
 * an arithmetic somebody has to do.
 */
const SWEEP_PER_SET = 500;

/** Write a value the way a student would type it at this stage. */
function entryText(stage: Stage, value: number, sigFigs: number): string {
  const text = stage.gradesSigFigs ? formatUnambiguous(value, sigFigs) : formatSigFigs(value, sigFigs);
  if (stage.kind === 'COUNT') return String(Math.round(value));
  return stage.needsUnit ? `${text} ${formatUnit(stage.unit)}` : text;
}

test('no two error classes predict something a student could not tell apart', () => {
  const collisions: Collision[] = [];
  const rejections: Record<string, number> = {};
  let problems = 0;
  let predictions = 0;

  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < SWEEP_PER_SET; index += 1) {
        const problem = generateProblem('COLLISION-SWEEP', topic, tier, index);
        const solution = solve(problem);
        problems += 1;
        for (const stage of stagesFor(problem)) {
          predictions += predictionsFor(problem, solution, stage).predictions.length;
        }
        collisions.push(...collisionsFor(problem, solution));
        for (const [name, count] of Object.entries(
          generationReport('COLLISION-SWEEP', topic, tier, index).rejected,
        )) {
          rejections[name] = (rejections[name] ?? 0) + count;
        }
      }
    }
  }

  const byGuarantee = Object.entries(rejections)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `    ${name.padEnd(28)} ${count}`)
    .join('\n');
  const backstop = rejections['PREDICTIONS_SEPARATED'] ?? 0;
  const total = Object.values(rejections).reduce((a, b) => a + b, 0);

  console.log(
    `\n  COLLISION CHECK: ${collisions.length} collisions across ${problems} problems ` +
      `and ${predictions} predicted wrong values.\n` +
      `\n  Candidates the generator refused, by guarantee:\n${byGuarantee}\n` +
      `\n  Of ${total} refusals, ${backstop} were the declared backstop ` +
      `(${total === 0 ? '0.0' : ((backstop / total) * 100).toFixed(1)}%). ` +
      `The rest are structural conditions on the problem's own stated values.\n`,
  );

  assert.deepEqual(
    collisions.slice(0, 10),
    [],
    'a collision means the DECOMPOSITION is wrong — fix it or stop posing the problem, never add a tiebreak',
  );
  assert.equal(collisions.length, 0);
  assert.ok(problems >= 10000, `the sweep must cover at least ten thousand problems, not ${problems}`);
});

test('a stage where nothing can be attributed is counted, because the sweep cannot see it', () => {
  // THE SWEEP'S BLIND SPOT, found by planting a fault it did not notice.
  //
  // Dropping the RATIO_NOT_UNITY guarantee — which lets the generator pose a
  // one-to-one proportion, where using the ratio upside down and ignoring it
  // entirely both produce the RIGHT answer — moved the collision count by
  // exactly nothing. It could not: predictions that land on the correct answer
  // are dropped before the collision check ever sees them, so a problem where
  // every misconception is invisible reports as clean.
  //
  // A plant that does not move the measurement is telling you the path is dead
  // (hub LESSONS 32). So the number that WOULD have moved is measured here: how
  // many numeric stages have no attributable prediction left at all. A wrong
  // answer at one of those can only ever come back as an arithmetic slip or
  // E-UNCLASSIFIED, whatever the student actually did.
  let numeric = 0;
  let blind = 0;
  let kept = 0;
  let dropped = 0;
  const blindByTopic: Record<string, number> = {};

  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 150; index += 1) {
        const problem = generateProblem('BLIND', topic, tier, index);
        const solution = solve(problem);
        for (const stage of stagesFor(problem)) {
          const predicted = predictionsFor(problem, solution, stage);
          kept += predicted.predictions.length;
          dropped += predicted.dropped.length;
          if (stage.kind === 'CHOICE') continue;
          numeric += 1;
          const attributable = predicted.predictions.filter((p) => p.sigFigs === undefined);
          if (attributable.length === 0) {
            blind += 1;
            blindByTopic[topic] = (blindByTopic[topic] ?? 0) + 1;
          }
        }
      }
    }
  }

  const rate = blind / numeric;
  const summary = Object.entries(blindByTopic)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `    ${name.padEnd(12)} ${count}`)
    .join('\n');
  console.log(
    `\n  ATTRIBUTION BLIND SPOTS: ${blind} of ${numeric} numeric stages (${(rate * 100).toFixed(2)}%) ` +
      `have no attributable prediction left.\n  ${dropped} predictions were dropped as ` +
      `indistinguishable from the correct answer, against ${kept} kept. By topic:\n${summary}\n`,
  );

  assert.ok(rate < 0.15, `${(rate * 100).toFixed(2)}% of numeric stages can diagnose nothing`);
});

test('two predictions that land on the same number are REPORTED, never picked between', () => {
  // THE RULE THIS WHOLE REPOSITORY IS UNDER, and until this test it was prose.
  // Changing the classifier to take the first of several matches — a tiebreak,
  // which is exactly what is forbidden — broke nothing in the suite.
  //
  // The fixture is built BY HAND and is deliberately degenerate: with an amount
  // of 2 and a rate of 4, writing the answer upside down (rate ÷ amount) and
  // never using the rate at all (the amount) both come to 2, while the correct
  // answer is 0.5. `checkGuarantees` refuses to generate it, which is the right
  // behaviour and is why it has to be constructed here.
  const real = generateProblem('TIEBREAK', 'FRACTIONS', 1, 0);
  if (real.topic !== 'FRACTIONS') throw new Error('unreachable');
  const degenerate: Problem = {
    ...real,
    answerSigFigs: 3,
    amount: { ...real.amount, quantity: measured(2, 3), written: '2.00' },
    rate: { ...real.rate, quantity: measured(4, 3), written: '4.00' },
  };
  assert.ok(
    checkGuarantees(degenerate).length > 0,
    'the generator would have posed this, and it is a problem two misconceptions answer the same way',
  );

  const solution = solve(degenerate);
  const stage = stagesFor(degenerate).find((s) => s.id === 'F2') as Stage;
  const values = predictionsFor(degenerate, solution, stage)
    .predictions.filter((p) => p.sigFigs === undefined)
    .map((p) => p.value as number);
  assert.ok(values.filter((v) => Math.abs(v - 2) < 1e-9).length === 2, 'the fixture no longer collides');

  const result = classify(degenerate, solution, stage, {
    kind: 'text',
    text: `2.00 ${formatUnit(stage.unit)}`,
  });
  assert.equal(result.collision, true, 'the classifier picked a winner instead of saying it could not tell');
  assert.equal(result.errorClass, null, 'a collision has no single class — that is what makes it a collision');
  assert.equal(result.matched.length, 2, `matched ${result.matched.join(', ')}`);
});

test('the generator does most of its separating structurally, not by comparing predictions', () => {
  // THE CIRCULARITY CHECK, and it is a real one. A generator that refused every
  // candidate whose predictions collide would make the sweep above report zero
  // because it could not report anything else. The backstop is allowed to
  // exist — two topics have class pairs with no algebraic separator — but if it
  // were doing most of the work, the sweep's zero would be worth very little.
  const rejections: Record<string, number> = {};
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 120; index += 1) {
        generateProblem('CIRCULARITY', topic, tier, index);
        for (const [name, count] of Object.entries(generationReport('CIRCULARITY', topic, tier, index).rejected)) {
          rejections[name] = (rejections[name] ?? 0) + count;
        }
      }
    }
  }
  const total = Object.values(rejections).reduce((a, b) => a + b, 0);
  const backstop = rejections['PREDICTIONS_SEPARATED'] ?? 0;
  assert.ok(total > 0, 'a generator that never refuses anything has no guarantees worth the name');
  assert.ok(
    backstop / total < 0.5,
    `the backstop accounted for ${backstop} of ${total} refusals — the structural guarantees have stopped working`,
  );
});

test('every predicted wrong value classifies as its own class and no other', () => {
  const covered = new Set<ErrorClass>();
  let exercised = 0;
  const wrong: string[] = [];

  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 80; index += 1) {
        const problem = generateProblem('FIXTURES', topic, tier, index);
        const solution = solve(problem);
        for (const stage of stagesFor(problem)) {
          const predicted = predictionsFor(problem, solution, stage);
          for (const prediction of predicted.predictions) {
            // The precision class is not a value and is fed back in below, by
            // writing the RIGHT number to the wrong number of figures.
            if (prediction.sigFigs !== undefined) continue;
            const entry =
              prediction.choice !== undefined
                ? ({ kind: 'choice', option: prediction.choice } as const)
                : ({
                    kind: 'text',
                    // AT THE PRECISION THE STAGE ASKS FOR, not at the
                    // problem's declared one — for the significant-figures
                    // topic those are different numbers, and writing a
                    // prediction to fewer figures than it needs erases the
                    // digit that made it a distinct prediction. The first
                    // version of this line did exactly that and reported the
                    // engine for it.
                    text: entryText(stage, prediction.value as number, requiredSigFigs(problem, solution)),
                  } as const);
            const result = classify(problem, solution, stage, entry);
            exercised += 1;
            if (result.correct || result.errorClass !== prediction.errorClass || result.matched.length !== 1) {
              if (wrong.length < 5) {
                wrong.push(
                  `${topic} tier ${tier} #${index} ${stage.id}: expected ${prediction.errorClass}, ` +
                    `got ${result.errorClass ?? 'CORRECT'} (matched ${result.matched.join('+')})`,
                );
              }
            } else {
              covered.add(prediction.errorClass);
            }
          }
        }
      }
    }
  }

  assert.deepEqual(wrong, [], `${exercised} predicted values were fed back in`);
  console.log(
    `\n  PREDICTION SWEEP: ${exercised} predicted wrong values, each classified as exactly one class.\n`,
  );

  // Which classes the predictions alone cover. The rest are reached by their
  // own fixtures below, and the test after this one insists every class is
  // reached by one route or the other.
  for (const predicted of [
    'E-REARR-MULTIPLIED', 'E-REARR-INVERTED', 'E-REARR-PARTIAL', 'E-REARR-SIGN',
    'E-PROP-INVERTED', 'E-PROP-ADDED', 'E-PROP-DROPPED',
    'E-SCI-EXP-OP', 'E-SCI-EXP-SIGN', 'E-SCI-MANTISSA-OP', 'E-SCI-NORMALISE',
    'E-POW-MULTIPLIED', 'E-POW-INVERTED', 'E-POW-SWAPPED', 'E-POW-COEFF',
    'E-FRAC-INVERTED', 'E-FRAC-RECIPROCAL', 'E-FRAC-RATE-IGNORED',
    'E-UNIT-FACTOR-INVERTED', 'E-UNIT-DROPPED', 'E-UNIT-CHAIN-INVERTED',
    'E-SIG-WRONG-RULE', 'E-SIG-ROUND-EARLY',
  ] as const) {
    assert.ok(covered.has(predicted), `no problem in the sweep predicted ${predicted}`);
  }
});

/** The first problem of a topic for which a predicate holds. */
function findProblem(topic: Topic, holds: (problem: Problem) => boolean): Problem {
  for (const tier of TIERS) {
    for (let index = 0; index < 400; index += 1) {
      const problem = generateProblem('CASES', topic, tier, index);
      if (holds(problem)) return problem;
    }
  }
  throw new Error(`no ${topic} problem in 1200 satisfied the fixture`);
}

test('a number with no unit is its own diagnosis, and so is the wrong unit', () => {
  const problem = findProblem('FRACTIONS', () => true);
  const solution = solve(problem);
  const stage = stagesFor(problem).find((s) => s.needsUnit) as Stage;
  const value = solution.at[stage.id] as number;

  const bare = classify(problem, solution, stage, {
    kind: 'text',
    text: formatUnambiguous(value, problem.answerSigFigs),
  });
  assert.equal(bare.errorClass, 'E-UNIT-MISSING');

  const wrong = classify(problem, solution, stage, {
    kind: 'text',
    text: `${formatUnambiguous(value, problem.answerSigFigs)} furlongs`,
  });
  assert.equal(wrong.errorClass, 'E-UNIT-WRONG');
});

test('the right number written to the wrong precision is its own class', () => {
  const problem = findProblem('PROPORTION', (p) => p.answerSigFigs >= 3);
  const solution = solve(problem);
  const stage = stagesFor(problem).find((s) => s.gradesSigFigs) as Stage;
  const value = solution.at[stage.id] as number;

  const short = classify(problem, solution, stage, {
    kind: 'text',
    text: `${formatUnambiguous(value, problem.answerSigFigs - 1)} ${formatUnit(stage.unit)}`,
  });
  assert.equal(short.errorClass, 'E-SIG-FIGURES', 'a value right to two figures where three were asked');

  const exact = classify(problem, solution, stage, {
    kind: 'text',
    text: `${formatUnambiguous(value, problem.answerSigFigs)} ${formatUnit(stage.unit)}`,
  });
  assert.equal(exact.correct, true);
});

test('counting the zeros that only hold the decimal point in place', () => {
  const problem = findProblem('SIGFIGS', (p) => {
    if (p.topic !== 'SIGFIGS') return false;
    const first = p.operands[0];
    return first !== undefined && Math.abs(first.quantity.value) < 0.1;
  });
  const solution = solve(problem);
  const stage = stagesFor(problem).find((s) => s.id === 'G1') as Stage;
  const predicted = predictionsFor(problem, solution, stage);
  const zeros = predicted.predictions.find((p) => p.errorClass === 'E-SIG-COUNT-ZEROS');
  assert.ok(zeros !== undefined, 'a value below a tenth has leading zeros to miscount');
  const result = classify(problem, solution, stage, { kind: 'text', text: String(zeros.value) });
  assert.equal(result.errorClass, 'E-SIG-COUNT-ZEROS');
});

test('an entry too far out to account for is E-UNCLASSIFIED, and is counted', () => {
  const problem = findProblem('REARRANGE', () => true);
  const solution = solve(problem);
  const stage = stagesFor(problem).find((s) => s.kind === 'NUMERIC') as Stage;
  const value = solution.at[stage.id] as number;
  const wild = classify(problem, solution, stage, {
    kind: 'text',
    text: entryText(stage, value * 1e6, 4),
  });
  assert.equal(wild.errorClass, 'E-UNCLASSIFIED');

  const nonsense = classify(problem, solution, stage, { kind: 'text', text: 'no idea' });
  assert.equal(nonsense.errorClass, 'E-UNCLASSIFIED');

  // A choice where a number was asked for is a defect in whatever called this,
  // and it shows up in the unclassified count rather than ending a session.
  const shaped = classify(problem, solution, stage, { kind: 'choice', option: 0 });
  assert.equal(shaped.errorClass, 'E-UNCLASSIFIED');
});

test('a small slip with the right method is an arithmetic slip, not a misconception', () => {
  const problem = findProblem('UNITS', () => true);
  const solution = solve(problem);
  const stage = stagesFor(problem).find((s) => s.id === 'U3') as Stage;
  const value = solution.at[stage.id] as number;
  const slip = classify(problem, solution, stage, {
    kind: 'text',
    text: `${formatUnambiguous(value * 1.04, problem.answerSigFigs)} ${formatUnit(stage.unit)}`,
  });
  assert.equal(slip.errorClass, 'E-ARITH');
});

test('every class has a fixture somewhere in this file', () => {
  const namedHere = new Set<ErrorClass>([
    'E-REARR-MULTIPLIED', 'E-REARR-INVERTED', 'E-REARR-PARTIAL', 'E-REARR-SIGN',
    'E-PROP-INVERTED', 'E-PROP-ADDED', 'E-PROP-DROPPED',
    'E-SCI-EXP-OP', 'E-SCI-EXP-SIGN', 'E-SCI-MANTISSA-OP', 'E-SCI-NORMALISE',
    'E-POW-MULTIPLIED', 'E-POW-INVERTED', 'E-POW-SWAPPED', 'E-POW-COEFF',
    'E-FRAC-INVERTED', 'E-FRAC-RECIPROCAL', 'E-FRAC-RATE-IGNORED',
    'E-UNIT-FACTOR-INVERTED', 'E-UNIT-DROPPED', 'E-UNIT-CHAIN-INVERTED',
    'E-UNIT-MISSING', 'E-UNIT-WRONG',
    'E-SIG-FIGURES', 'E-SIG-WRONG-RULE', 'E-SIG-COUNT-ZEROS', 'E-SIG-ROUND-EARLY',
    'E-ARITH', 'E-UNCLASSIFIED',
  ]);
  for (const errorClass of ERROR_CLASSES) {
    assert.ok(namedHere.has(errorClass), `${errorClass} has no fixture`);
  }
  assert.equal(namedHere.size, ERROR_CLASSES.length, 'this list has grown a class the taxonomy does not have');
});

test('every class means something, routes somewhere, and gives away no number', () => {
  for (const errorClass of ERROR_CLASSES) {
    const meaning = CLASS_MEANINGS[errorClass];
    assert.ok(meaning.length > 10, `${errorClass} has nothing written about it`);
    // NO DIGITS, ANYWHERE. Attribution is worth nothing if the sentence is the
    // last word — but a sentence that carries a value is a sentence that hands
    // over the answer, and at an intermediate stage nothing grades figures, so
    // the grader would then accept it typed back in.
    assert.ok(!/\d/.test(meaning), `${errorClass}'s meaning contains a digit: "${meaning}"`);
    if (errorClass === 'E-ARITH') continue;
    assert.ok(
      remediesFor(errorClass, null).length > 0,
      `${errorClass} is a diagnosis that leads nowhere — which is the failure this app exists to fix`,
    );
  }
  // An arithmetic slip big enough to be a decimal place in the wrong spot gets
  // the magnitude help; a mistyped digit gets nothing, because there is
  // nothing to teach about it.
  assert.deepEqual(remediesFor('E-ARITH', null), []);
  assert.deepEqual(remediesFor('E-ARITH', 0.9), ['A4-MAGNITUDE']);
});

test('the unclassified rate over a sweep of realistic wrong answers', () => {
  // Every predicted wrong value, plus the slips a student actually makes: a
  // percent or two out, a tenth out, a whole factor of ten.
  let entries = 0;
  let unclassified = 0;
  const byClass: Record<string, number> = {};

  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 120; index += 1) {
        const problem = generateProblem('RATE', topic, tier, index);
        const solution = solve(problem);
        for (const stage of stagesFor(problem)) {
          if (stage.kind !== 'NUMERIC') continue;
          const predicted = predictionsFor(problem, solution, stage);
          const correct = predicted.correctValue;
          if (correct === null) continue;
          const candidates = [
            ...predicted.predictions.filter((p) => p.sigFigs === undefined).map((p) => (p as Prediction).value as number),
            correct * 1.02,
            correct * 0.97,
            correct * 1.1,
            correct * 10,
          ];
          for (const value of candidates) {
            if (!Number.isFinite(value)) continue;
            const result = classify(problem, solution, stage, {
              kind: 'text',
              text: entryText(stage, value, 6),
            });
            if (result.correct) continue;
            entries += 1;
            const name = result.collision ? 'COLLISION' : (result.errorClass as string);
            byClass[name] = (byClass[name] ?? 0) + 1;
            if (name === 'E-UNCLASSIFIED') unclassified += 1;
          }
        }
      }
    }
  }

  const rate = unclassified / entries;
  const summary = Object.entries(byClass)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `    ${name.padEnd(24)} ${count}`)
    .join('\n');
  console.log(
    `\n  E-UNCLASSIFIED RATE: ${unclassified} of ${entries} wrong entries ` +
      `(${(rate * 100).toFixed(2)}%). By class:\n${summary}\n`,
  );

  assert.equal(byClass['COLLISION'], undefined, 'no entry may match two classes');
  // A QUARTER OF THIS SWEEP IS A FACTOR OF TEN OUT and is unclassified by
  // definition, so the floor for this particular set of entries is around a
  // quarter rather than zero. The assertion is a ceiling on the rate, and the
  // NUMBER is what gets reported — a rate that starts climbing is the signal
  // the taxonomy has stopped keeping up with the topics.
  assert.ok(rate < 0.35, `the unclassified rate is ${(rate * 100).toFixed(2)}%`);
  assert.ok(entries > 5000, `the rate was measured over only ${entries} entries`);
});

test('a session answered correctly is never marked wrong', () => {
  // THE FLOOR UNDER EVERYTHING ELSE. A grader that refuses its own answer is a
  // grader nobody can use, and no amount of attribution rescues it.
  let checked = 0;
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 60; index += 1) {
        const problem = generateProblem('CORRECT', topic, tier, index);
        const solution = solve(problem);
        for (const stage of stagesFor(problem)) {
          const entry = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
          const result = classify(problem, solution, stage, entry);
          checked += 1;
          assert.equal(
            result.correct,
            true,
            `${topic} tier ${tier} #${index} ${stage.id}: the grader refused its own answer — ${result.why}`,
          );
        }
      }
    }
  }
  console.log(`\n  ${checked} correct entries, none of them refused.\n`);
});

test('every generated problem keeps every guarantee it was generated under', () => {
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 100; index += 1) {
        const problem = generateProblem('GUARANTEES', topic, tier, index);
        assert.deepEqual(
          checkGuarantees(problem),
          [],
          `${topic} tier ${tier} #${index} was generated breaking a guarantee`,
        );
      }
    }
  }
});

test('a stage that grades figures is the last one, and only one does', () => {
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      const problem = generateProblem('STAGES', topic, tier, 0);
      const stages = stagesFor(problem);
      assert.ok(stages.length >= 2, `${topic} has only ${stages.length} stage`);
      const graded = stages.filter((s) => s.gradesSigFigs);
      assert.equal(graded.length, 1, `${topic} grades figures at ${graded.length} stages`);
      assert.equal(graded[0]?.id, stages[stages.length - 1]?.id, `${topic} grades figures before the end`);
      for (const stage of stages) {
        assert.ok(COUNTER_SKILLS.includes(stage.counter), `${stage.id} reports into ${stage.counter}`);
        assert.ok(stage.prompt.length > 20, `${stage.id} asks nothing`);
        if (stage.kind === 'CHOICE') {
          assert.ok((stage.options ?? []).length >= 2, `${stage.id} is a choice of one`);
        }
      }
    }
  }
});

test('a choice stage and the grader read ONE derivation of the options', () => {
  // THE HAND-TYPED MAP THAT WAS A COIN TOSS. `optionsFor` used to dispatch on
  // (topic, stage id) with a fallback returning an empty set, so a choice stage
  // whose id it did not recognise reported `correct: 0` while the screen showed
  // the real options — the FIRST option graded correct whatever it said, which
  // on a rearrangement is the upside-down answer. Nothing failed, because
  // `correctEntryFor` submitted option 0 and `classify` compared against the
  // same broken lookup.
  //
  // The derivation is keyed on the TOPIC now, so there is no id to get wrong.
  // This checks the assumption that keying rests on, and checks the two readers
  // agree.
  for (const topic of TOPICS) {
    for (const tier of TIERS) {
      for (let index = 0; index < 40; index += 1) {
        const problem = generateProblem('ONE-DERIVATION', topic, tier, index);
        const solution = solve(problem);
        const choices = stagesFor(problem).filter((stage) => stage.kind === 'CHOICE');

        // AT MOST ONE. The day a topic gains a second choice stage, keying on
        // the topic silently answers about the first — so the assumption fails
        // here rather than in a student's session.
        assert.ok(choices.length <= 1, `${topic} has ${choices.length} choice stages, and the options are keyed by topic`);

        const derived = choiceOptionsFor(problem);
        if (choices.length === 0) {
          assert.equal(derived, null, `${topic} declares options for a choice stage it does not build`);
          continue;
        }
        const stage = choices[0] as Stage;
        assert.ok(derived !== null, `${topic} builds a choice stage and declares no options`);
        assert.deepEqual(
          [...(stage.options ?? [])],
          [...derived.items],
          `${topic}: the options shown are not the options graded`,
        );

        // And the correct one is a real index into what is shown — not 0 by
        // default, which is what the old fallback returned.
        const predicted = predictionsFor(problem, solution, stage);
        assert.ok(
          predicted.correctChoice !== null &&
            predicted.correctChoice >= 0 &&
            predicted.correctChoice < (stage.options ?? []).length,
          `${topic}: correctChoice is ${predicted.correctChoice} of ${(stage.options ?? []).length}`,
        );
        // Every wrong option attributes to exactly one class. An option nobody
        // predicts is an option a student can pick and be told nothing about.
        const attributed = new Set(predicted.predictions.map((p) => p.choice));
        for (let option = 0; option < (stage.options ?? []).length; option += 1) {
          if (option === predicted.correctChoice) continue;
          assert.ok(attributed.has(option), `${topic}: option ${option + 1} is shown and attributes to nothing`);
        }
      }
    }
  }
});

test('a choice stage the grader has never heard of still resolves to the right options', () => {
  // THE CHECK THAT WOULD HAVE GONE RED, and the first version of it was not.
  //
  // Asserting that the two readers agree today cannot catch this, because the
  // defect only exists once somebody ADDS a stage — every id in the tree is one
  // the old map already knew. Re-planting the id-keyed map changed nothing in a
  // test that drives only real stages.
  //
  // So the failure mode is exercised directly: a choice stage carrying an id
  // nothing recognises. Under the old map that reported `correct: 0` with zero
  // predictions, and `classify` accepted option 0 — the upside-down
  // rearrangement — as correct. Keyed on the topic there is no id to miss.
  for (const topic of ['REARRANGE', 'POWERS', 'FRACTIONS', 'UNITS'] as const) {
    const problem = generateProblem('ORPHAN', topic, 2, 0);
    const solution = solve(problem);
    const real = stagesFor(problem).find((stage) => stage.kind === 'CHOICE') as Stage;
    const orphan: Stage = { ...real, id: `${real.id}-NEVER-SEEN` };

    const asReal = predictionsFor(problem, solution, real);
    const asOrphan = predictionsFor(problem, solution, orphan);
    assert.equal(
      asOrphan.correctChoice,
      asReal.correctChoice,
      `${topic}: an unfamiliar stage id changed which option is correct`,
    );
    assert.equal(
      asOrphan.predictions.length,
      asReal.predictions.length,
      `${topic}: an unfamiliar stage id lost every prediction`,
    );

    // And the wrong option is still refused. Under the old map, option 0 on a
    // rearrangement was the upside-down answer and came back correct.
    const wrong = asReal.correctChoice === 0 ? 1 : 0;
    assert.equal(
      classify(problem, solution, orphan, { kind: 'choice', option: wrong }).correct,
      false,
      `${topic}: option ${wrong + 1} was graded correct on a stage the grader did not recognise`,
    );
  }
});

test('the correct choice is not always the first one', () => {
  // A rotation from the problem's own seed, so it is the same on every device
  // — and so a set does not teach "the answer is the top one".
  const positions = new Set<number>();
  for (const tier of TIERS) {
    for (let index = 0; index < 60; index += 1) {
      const problem = generateProblem('ROTATION', 'REARRANGE', tier, index);
      const solution = solve(problem);
      const stage = stagesFor(problem).find((s) => s.kind === 'CHOICE') as Stage;
      const at = predictionsFor(problem, solution, stage).correctChoice;
      if (at !== null) positions.add(at);
    }
  }
  assert.ok(positions.size >= 2, `the correct option was always at position ${[...positions].join(',')}`);
});

test('reading what a student typed', () => {
  assert.equal(readEntry('12.30 mol')?.quantity.value, 12.3);
  assert.equal(readEntry('1.20e3 g')?.quantity.value, 1200);
  assert.equal(readEntry('1.20 x 10^3')?.quantity.value, 1200);
  assert.equal(readEntry('  4.5  ')?.unit, null);
  assert.equal(readEntry('no idea'), null);
  assert.equal(readEntry(''), null);
  // Two units is not a reading this can make, and it says so rather than
  // guessing which one was meant.
  assert.equal(readEntry('5 g/mol/L')?.unit, null);
});

test('two values a student could write the same answer to are indistinguishable', () => {
  // The check the sweep is measured at: two values are the same observable
  // when they round to the same thing at the precision the problem is graded
  // to. It is the same reading `classify` grades and diagnoses at, and that
  // is not a coincidence — see the note at the head of `tolerance.ts`.
  assert.equal(indistinguishable(2.13, 2.14, 2), true, 'one number at two figures');
  assert.equal(indistinguishable(2.13, 2.14, 3), false, 'two numbers at three');
  assert.equal(indistinguishable(2.13, 2.94, 3), false);
  assert.equal(indistinguishable(1, 1000, 4), false);
});
