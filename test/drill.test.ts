/**
 * drill.test.ts — the cadence, and the sentence that must not be said unless it
 * is true.
 *
 * The rule this file holds: what replaces praise is CHANGE. So the interesting
 * assertions are not that the right words appear — they are that the
 * *you were getting these wrong and now you are not* sentence appears ONLY
 * where the run actually shows that, and that the all-wrong run does not get
 * the general sentence with a zero in it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAME_DURING_RUN_AT,
  NAME_IN_CLOSING_AT,
  STOPPED_AFTER_CLEAN,
  readRun,
  type Attempt,
} from '../src/report/drill.ts';
import { CLASS_MEANINGS, REMEDIES, type ErrorClass } from '../src/engine/taxonomy.ts';

const wrong = (errorClass: ErrorClass): Attempt => ({ skill: 'SCALE', errorClass });
const right = (): Attempt => ({ skill: 'SCALE', errorClass: null });

test('once is not a pattern and is never named', () => {
  const outcome = readRun([wrong('E-PROP-INVERTED'), right(), right(), right()]);
  assert.deepEqual(outcome.notes, [], 'a single mistake was named during the run');
  // ASSERTED AGAINST THE VALUE, not against a phrase typed here. The first
  // version of this looked for the words "upside down", which are not the words
  // `CLASS_MEANINGS` actually uses — a check on the wording passes or fails on
  // whoever last edited the copy rather than on the behaviour.
  assert.ok(
    !outcome.closing.some((line) => line.includes(CLASS_MEANINGS['E-PROP-INVERTED'])),
    `a single mistake reached the closing: ${outcome.closing.join(' / ')}`,
  );
});

test('twice goes in the closing and is not said during the run', () => {
  const outcome = readRun([wrong('E-PROP-INVERTED'), right(), wrong('E-PROP-INVERTED'), right()]);
  assert.deepEqual(outcome.notes, [], 'twice was named mid-run, which is one telling too early');
  assert.equal(outcome.closing.length, 1);
  assert.ok(
    (outcome.closing[0] as string).includes(CLASS_MEANINGS['E-PROP-INVERTED']),
    `the closing did not name the repeated mistake: ${outcome.closing[0]}`,
  );
  assert.equal(NAME_IN_CLOSING_AT, 2);
});

test('three times is said during the run, once, with what fixes it — and never again', () => {
  const run: Attempt[] = [
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
  ];
  const outcome = readRun(run);
  assert.equal(outcome.notes.length, 1, `said ${outcome.notes.length} times, and once is the whole rule`);
  const note = outcome.notes[0];
  assert.equal(note?.afterAttempt, NAME_DURING_RUN_AT - 1, 'said at the wrong point in the run');
  assert.equal(note?.errorClass, 'E-PROP-INVERTED');
  assert.ok((note?.text ?? '').includes('third time'), 'the note does not say what it is about');
  // WHAT TO DO, not what the mistake is called. This asserted the phrase
  // "What fixes it", which the note carried in front of the remedy's NAME —
  // and a name is the topic a mistake belongs to rather than a way out of it.
  assert.ok(
    (note?.text ?? '').includes(REMEDIES['A2-PROPORTION'].how),
    'the note names a mistake and no way out of it',
  );
});

test('the change sentence is said ONLY where the run shows the change', () => {
  const changed = 'You were getting these wrong the same way';

  // Repeated, then two clean attempts at the same skill. That is the claim
  // being earned.
  const stopped = readRun([
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    right(),
    right(),
  ]);
  assert.ok(
    stopped.closing.some((line) => line.startsWith(changed)),
    `the change was earned and not reported: ${stopped.closing.join(' / ')}`,
  );

  // Repeated, then only ONE clean attempt. One clean answer after a run of
  // wrong ones is as likely to be a guess as a change.
  const tooSoon = readRun([wrong('E-PROP-INVERTED'), wrong('E-PROP-INVERTED'), right()]);
  assert.ok(
    !tooSoon.closing.some((line) => line.startsWith(changed)),
    `one clean attempt was reported as a change: ${tooSoon.closing.join(' / ')}`,
  );
  assert.equal(STOPPED_AFTER_CLEAN, 2);

  // Repeated, cleared, then made again. Nothing stopped.
  const relapsed = readRun([
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    right(),
    right(),
    wrong('E-PROP-INVERTED'),
  ]);
  assert.ok(
    !relapsed.closing.some((line) => line.startsWith(changed)),
    `a mistake made again was reported as stopped: ${relapsed.closing.join(' / ')}`,
  );
});

test('clean attempts at a DIFFERENT skill do not earn the change sentence', () => {
  // The claim is about one move. Getting a different move right says nothing
  // about the one that kept going wrong.
  const outcome = readRun([
    { skill: 'SCALE', errorClass: 'E-PROP-INVERTED' },
    { skill: 'SCALE', errorClass: 'E-PROP-INVERTED' },
    { skill: 'PRECISION', errorClass: null },
    { skill: 'PRECISION', errorClass: null },
  ]);
  assert.ok(
    !outcome.closing.some((line) => line.startsWith('You were getting these wrong the same way')),
    `another skill's clean run was counted as the change: ${outcome.closing.join(' / ')}`,
  );
});

test('the all-wrong run is written by hand, and carries no count', () => {
  // "4 questions, and 0 of them were right" is accurate and is the exact
  // reading that person does not need.
  const sameWay = readRun([
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
    wrong('E-PROP-INVERTED'),
  ]);
  const text = sameWay.closing.join(' ');
  assert.ok(text.includes('one move to fix'), `the all-wrong branch did not run: ${text}`);
  assert.ok(!/\d/.test(text), `the all-wrong closing carries a number: ${text}`);
  assert.ok(!/\b0\b|none right|nothing right/i.test(text), `it reports the zero: ${text}`);

  // All wrong, no pattern. Still no count, and still something to do next.
  const scattered = readRun([
    wrong('E-PROP-INVERTED'),
    wrong('E-SIG-ROUND-EARLY'),
    wrong('E-UNIT-DROPPED'),
  ]);
  const scatteredText = scattered.closing.join(' ');
  assert.ok(!/\d/.test(scatteredText), `a number reached the scattered all-wrong case: ${scatteredText}`);
  assert.ok(scatteredText.length > 40, 'the scattered all-wrong case says almost nothing');
});

test('no run of any shape produces a score, a fraction or a congratulation', () => {
  // WALKED OVER EVERY SHAPE rather than argued. The type has no field for a
  // count, so this is checking that none is assembled into a sentence.
  const classes: ErrorClass[] = [
    'E-PROP-INVERTED', 'E-SIG-ROUND-EARLY', 'E-UNIT-DROPPED', 'E-ARITH', 'E-UNCLASSIFIED',
  ];
  const banned = /\b\d+\s*(?:\/|out of)\s*\d+\b|\bstreak\b|\bbadge\b|\bscore\b|\bpoints\b|great job|well done|keep it up/i;
  let shapes = 0;
  for (const errorClass of classes) {
    for (let wrongCount = 0; wrongCount <= 5; wrongCount += 1) {
      for (let rightCount = 0; rightCount <= 4; rightCount += 1) {
        if (wrongCount + rightCount === 0) continue;
        const run: Attempt[] = [
          ...Array.from({ length: wrongCount }, () => wrong(errorClass)),
          ...Array.from({ length: rightCount }, () => right()),
        ];
        const outcome = readRun(run);
        const all = [...outcome.closing, ...outcome.notes.map((n) => n.text)].join(' ');
        assert.ok(!banned.test(all), `${errorClass} ${wrongCount}w${rightCount}r produced: ${all}`);
        assert.ok(all.trim().length > 0, `${errorClass} ${wrongCount}w${rightCount}r said nothing at all`);
        shapes += 1;
      }
    }
  }
  console.log(`\n  ${shapes} run shapes, none of which produced a score, a fraction or a congratulation.\n`);
});

test('a slip and an unreadable answer are never called a pattern', () => {
  // E-ARITH is a slip with the right method; E-UNCLASSIFIED means the app could
  // not tell. Telling somebody they keep making a mistake the app could not
  // identify is telling them nothing they can act on.
  for (const errorClass of ['E-ARITH', 'E-UNCLASSIFIED'] as const) {
    const outcome = readRun([wrong(errorClass), wrong(errorClass), wrong(errorClass), wrong(errorClass)]);
    assert.deepEqual(outcome.notes, [], `${errorClass} was named mid-run as a pattern`);
    assert.ok(
      !outcome.closing.some((line) => line.startsWith('This one kept happening')),
      `${errorClass} was reported as a repeated misconception`,
    );
  }
});

test('an empty run says nothing rather than something cheerful', () => {
  const outcome = readRun([]);
  assert.deepEqual(outcome.notes, []);
  assert.deepEqual(outcome.closing, ['Nothing in those went wrong the same way twice.']);
});

test('the outcome has nowhere to put a count', () => {
  // THE STRUCTURAL HALF, and the reason it is a type rather than a rule to
  // remember — the same argument as the missing accommodation field on a
  // session. `copy-check.mjs` covers the words; this covers the shape.
  const outcome = readRun([wrong('E-PROP-INVERTED'), right()]);
  assert.deepEqual(Object.keys(outcome).sort(), ['closing', 'notes']);
  for (const note of outcome.notes) {
    assert.deepEqual(Object.keys(note).sort(), ['afterAttempt', 'errorClass', 'text']);
  }
  const serialised = JSON.stringify(outcome).toLowerCase();
  for (const field of ['score', 'streak', 'total', 'correct', 'rightfirsttime', 'percent', 'points']) {
    assert.ok(!serialised.includes(field), `the outcome carries a field called ${field}`);
  }
});
