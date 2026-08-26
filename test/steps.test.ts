/**
 * steps.test.ts — the session machine, the clock, and the two walls.
 *
 * The walls: a practice session cannot produce a completion code, and a
 * session has nowhere to put a student's name or an accommodation. Both are
 * checked as facts about the SHAPE of what comes out rather than as promises
 * about what a caller remembers not to do.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ROSTER_NUMBER,
  completionCounts,
  controllableClock,
  currentProblem,
  currentStage,
  driveCorrectly,
  elapsedFor,
  fixedClock,
  resumeSession,
  startSession,
  submit,
  type SessionConfig,
} from '../src/engine/steps.ts';
import { solve, TOPICS } from '../src/engine/problem.ts';
import { correctEntryFor, stagesFor } from '../src/engine/taxonomy.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';

const assignment = (over: Partial<SessionConfig> = {}): SessionConfig => ({
  assignmentKey: 'CHEM-7B',
  topic: 'PROPORTION',
  tier: 1,
  count: 3,
  mode: 'assignment',
  rosterNumber: 17,
  ...over,
});

test('a set is worked one step at a time, and a wrong step does not advance', () => {
  const clock = controllableClock(1_700_000_000_000);
  const session = startSession(assignment(), clock);
  const problem = currentProblem(session);
  const solution = solve(problem);
  const stage = currentStage(session);

  const wrong = submit(session, { kind: 'text', text: 'nonsense' }, clock);
  assert.equal(wrong.advanced, false);
  assert.equal(wrong.session.stageIndex, session.stageIndex, 'a wrong step advanced');
  assert.equal(wrong.session.attempted, 1);
  assert.equal(wrong.session.rightFirstTime, 0);
  assert.equal(wrong.session.wrongBySkill[stage.counter], 1);

  // The second attempt is right, and does not count as right FIRST time.
  const right = submit(wrong.session, correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS), clock);
  assert.equal(right.advanced, true);
  assert.equal(right.session.rightFirstTime, 0, 'a step got wrong once is not right first time');
  assert.equal(right.session.attempted, 1, 'one step, however many attempts');
  assert.equal(right.session.stageIndex, 1);
});

test('a set answered correctly finishes, with every step counted once', () => {
  const clock = controllableClock(0);
  for (const topic of TOPICS) {
    const session = startSession(assignment({ topic, count: 2 }), clock);
    const finished = driveCorrectly(session, clock);
    assert.equal(finished.finished, true, `${topic} did not finish`);
    let steps = 0;
    for (let i = 0; i < 2; i += 1) {
      steps += stagesFor(
        currentProblem({ ...session, problemIndex: i }),
      ).length;
    }
    assert.equal(finished.attempted, steps, `${topic} counted ${finished.attempted} of ${steps} steps`);
    assert.equal(finished.rightFirstTime, steps, `${topic} did not mark every correct step right`);
    for (const count of Object.values(finished.wrongBySkill)) assert.equal(count, 0);
  }
});

test('time accumulates across stretches, so a break costs nothing', () => {
  // THE POINT OF THE ACCUMULATOR. A student who stops for forty minutes must
  // not have forty minutes added to what their session reports — the label on
  // that number is "how long you had it open", which a break is exactly not.
  // Worse, it would report the accommodation: a session showing two hours for
  // twenty minutes of work makes somebody who took a break look slow.
  const clock = controllableClock(1000);
  const session = startSession(assignment(), clock);
  clock.advance(5 * 60_000);
  assert.equal(elapsedFor(session, clock), 5 * 60_000);

  const closedAt = clock.now();
  clock.advance(40 * 60_000); // the tab was shut for forty minutes
  const resumed = resumeSession(session, clock, closedAt);
  assert.equal(elapsedFor(resumed, clock), 5 * 60_000, 'the break was charged to the student');

  clock.advance(3 * 60_000);
  assert.equal(elapsedFor(resumed, clock), 8 * 60_000, 'the second stretch was not added');
});

test('nothing in this file reads a clock it was not handed', async () => {
  // NO DATE ACCESS OUTSIDE THE INJECTED CLOCK. A test that cannot control the
  // time cannot check anything that carries one — so the rule is enforced by
  // reading the source rather than by remembering it.
  const { readFileSync } = await import('node:fs');
  for (const file of ['src/engine/steps.ts', 'src/engine/problem.ts', 'src/engine/taxonomy.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bDate\s*\.\s*now\b/.test(stripped), `${file} reads Date.now`);
    assert.ok(!/\bnew\s+Date\b/.test(stripped), `${file} builds a Date`);
    assert.ok(!/\bMath\s*\.\s*random\b/.test(stripped), `${file} uses Math.random`);
    assert.ok(!/\bperformance\s*\.\s*now\b/.test(stripped), `${file} reads performance.now`);
  }
});

test('a practice session cannot produce a completion code', () => {
  // THE WALL IS A FUNCTION THAT REFUSES, not a button somebody remembers not to
  // render. Practice shows answers on request, so a practice session that could
  // produce a code would be the route to credit for work the app did in front
  // of you.
  const clock = fixedClock(0);
  const practice = startSession(
    assignment({ mode: 'practice', rosterNumber: null, count: 1 }),
    clock,
  );
  assert.throws(() => completionCounts(practice, clock), /practice/);

  // And the same session in assignment mode still works, so the refusal is
  // about the mode rather than about something else being broken.
  const graded = startSession(assignment({ count: 1 }), clock);
  const counts = completionCounts(graded, clock);
  assert.equal(counts.rosterNumber, 17);
});

test('identity is a roster number, and there is nowhere for anything else', () => {
  const clock = fixedClock(0);
  const finished = driveCorrectly(startSession(assignment({ count: 1 }), clock), clock);
  const counts = completionCounts(finished, clock);

  // WALKED, not read off the type. What a teacher's page and a completion code
  // are built from is this object, so the check is over its actual keys.
  assert.deepEqual(Object.keys(counts).sort(), [
    'attempted',
    'elapsedMs',
    'rightFirstTime',
    'rosterNumber',
    'wrongBySkill',
  ]);
  const serialised = JSON.stringify(counts);
  for (const forbidden of ['name', 'email', 'device', 'period', 'accommodation', 'readAloud', 'textSize', 'spacing']) {
    assert.ok(
      !serialised.toLowerCase().includes(forbidden.toLowerCase()),
      `the completion counts carry a field called ${forbidden}`,
    );
  }
  // AND THE SESSION ITSELF HAS NOWHERE TO PUT ONE. A student's accommodations
  // are disability information; a session that carried them would make a
  // student disclose an accommodation by using it, over a channel they cannot
  // opt out of. Omitting them from the OUTPUT would be a rule to remember;
  // having no field is a rule that holds.
  const sessionKeys = JSON.stringify(finished).toLowerCase();
  for (const forbidden of ['accommodation', 'readaloud', 'textsize', 'spacing', 'name', 'email']) {
    assert.ok(!sessionKeys.includes(forbidden), `a session carries ${forbidden}`);
  }
});

test('a roster number is checked rather than assumed', () => {
  const clock = fixedClock(0);
  for (const bad of [0, -1, MAX_ROSTER_NUMBER + 1, 1.5, null]) {
    assert.throws(
      () => startSession(assignment({ rosterNumber: bad }), clock),
      /roster number/,
      `${bad} was accepted as a roster number`,
    );
  }
  assert.doesNotThrow(() => startSession(assignment({ rosterNumber: MAX_ROSTER_NUMBER }), clock));
  // Practice reports against nobody, so it needs none.
  assert.doesNotThrow(() =>
    startSession(assignment({ mode: 'practice', rosterNumber: null }), clock),
  );
  assert.throws(() => startSession(assignment({ count: 0 }), clock), /at least one problem/);
});

test('a finished session refuses another entry', () => {
  const clock = fixedClock(0);
  const finished = driveCorrectly(startSession(assignment({ count: 1 }), clock), clock);
  assert.throws(() => submit(finished, { kind: 'text', text: '1' }, clock), /finished/);
});

test('the same key gives the same set on a second machine', () => {
  // The whole reason a teacher writes ONE thing on the board.
  const clock = fixedClock(0);
  const here = currentProblem(startSession(assignment({ topic: 'UNITS' }), clock));
  const there = currentProblem(startSession(assignment({ topic: 'UNITS' }), controllableClock(999)));
  assert.deepEqual(here, there, 'the problem depended on something other than the key');
});
