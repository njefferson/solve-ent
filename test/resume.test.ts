/**
 * resume.test.ts — an unfinished set, and everything it must refuse.
 *
 * The cases are the ones a shared device actually produces: a set from
 * yesterday, a set from a different release, a value somebody edited, and a
 * practice run that should never have been stored in the first place.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../src/ui/prefs.ts';
import { RESUME_KEY, RESUME_WINDOW_MS, clearRun, readRun, saveRun } from '../src/ui/resume.ts';
import { startSession, submit, type SessionConfig } from '../src/engine/steps.ts';
import { correctEntryFor, stagesFor } from '../src/engine/taxonomy.ts';
import { solve } from '../src/engine/problem.ts';
import { currentProblem, currentStage } from '../src/engine/steps.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';
import { VERSION } from '../src/version.ts';

const at = (ms: number) => ({ now: () => ms });
const T0 = 1_700_000_000_000;

const assigned = (over: Partial<SessionConfig> = {}): SessionConfig => ({
  assignmentKey: 'CHEM-7B',
  topic: 'REARRANGE',
  tier: 1,
  count: 3,
  mode: 'assignment',
  rosterNumber: 17,
  ...over,
});

test('an unfinished assigned set comes back', () => {
  const store = memoryStore();
  const session = startSession(assigned(), at(T0));
  saveRun(store, session, at(T0));

  const back = readRun(store, at(T0 + 60_000));
  assert.equal(back.kind, 'run');
  if (back.kind !== 'run') return;
  assert.equal(back.session.config.rosterNumber, 17);
  assert.equal(back.session.config.assignmentKey, 'CHEM-7B');
  assert.equal(back.session.problemIndex, 0);
});

test('it carries on from where it stopped, not from the beginning', () => {
  const store = memoryStore();
  let session = startSession(assigned(), at(T0));
  // One real step, so there is something to lose.
  const problem = currentProblem(session);
  const stage = currentStage(session);
  session = submit(session, correctEntryFor(problem, solve(problem), stage, SCRATCH_SIG_FIGS), at(T0)).session;
  assert.ok(session.stageIndex > 0 || session.problemIndex > 0, 'the fixture did not advance');
  saveRun(store, session, at(T0));

  const back = readRun(store, at(T0 + 1000));
  assert.equal(back.kind, 'run');
  if (back.kind !== 'run') return;
  assert.equal(back.session.stageIndex, session.stageIndex);
  assert.equal(back.session.problemIndex, session.problemIndex);
  assert.equal(back.session.attempted, session.attempted);
  assert.equal(back.session.rightFirstTime, session.rightFirstTime);
  // And the stage it points at is a stage that exists.
  assert.ok(stagesFor(currentProblem(back.session)).length > back.session.stageIndex);
});

test('practice is never stored, because practice records nothing', () => {
  const store = memoryStore();
  const session = startSession(
    assigned({ mode: 'practice', rosterNumber: null, assignmentKey: 'practice' }),
    at(T0),
  );
  saveRun(store, session, at(T0));
  assert.equal(store.get(RESUME_KEY), null);
  assert.equal(readRun(store, at(T0)).kind, 'none');
});

test('a finished set is removed rather than kept', () => {
  const store = memoryStore();
  const session = startSession(assigned({ count: 1 }), at(T0));
  saveRun(store, session, at(T0));
  assert.ok(store.get(RESUME_KEY) !== null);
  // The same call, on a session that has finished, is what clears it.
  saveRun(store, { ...session, finished: true }, at(T0));
  assert.equal(store.get(RESUME_KEY), null, 'a roster number stayed on the device after the set ended');
});

test('yesterday does not come back for whoever picks the device up', () => {
  const store = memoryStore();
  saveRun(store, startSession(assigned(), at(T0)), at(T0));
  const back = readRun(store, at(T0 + RESUME_WINDOW_MS + 1));
  assert.equal(back.kind, 'none');
  assert.equal(back.kind === 'none' ? back.why : '', 'STALE');
  assert.equal(store.get(RESUME_KEY), null, 'a stale run was refused and then left on the device');
});

test('a set from another release is refused rather than resumed into different questions', () => {
  const store = memoryStore();
  const session = startSession(assigned(), at(T0));
  store.set(RESUME_KEY, JSON.stringify({ version: '0.0.1-other', savedAtMs: T0, session }));
  const back = readRun(store, at(T0));
  assert.equal(back.kind === 'none' ? back.why : '', 'OTHER_VERSION');
  assert.equal(store.get(RESUME_KEY), null);
});

test('anything that does not read is dropped rather than repaired', () => {
  const session = startSession(assigned(), at(T0));
  const bad: Record<string, unknown>[] = [
    { version: VERSION, savedAtMs: T0, session: { ...session, config: { ...session.config, mode: 'practice' } } },
    { version: VERSION, savedAtMs: T0, session: { ...session, config: { ...session.config, rosterNumber: 99999 } } },
    { version: VERSION, savedAtMs: T0, session: { ...session, config: { ...session.config, topic: 'ASTROLOGY' } } },
    { version: VERSION, savedAtMs: T0, session: { ...session, config: { ...session.config, tier: 3, topic: 'PROPORTION' } } },
    { version: VERSION, savedAtMs: T0, session: { ...session, problemIndex: 99 } },
    { version: VERSION, savedAtMs: T0, session: { ...session, finished: true } },
    { version: VERSION, savedAtMs: T0, session: { ...session, wrongBySkill: 'lots' } },
    { version: VERSION, savedAtMs: T0 },
  ];
  for (const value of bad) {
    const store = memoryStore({ [RESUME_KEY]: JSON.stringify(value) });
    const back = readRun(store, at(T0));
    assert.equal(back.kind, 'none', `this was resumed: ${JSON.stringify(value).slice(0, 90)}`);
    assert.equal(store.get(RESUME_KEY), null, 'refused and then left on the device');
  }
  const broken = memoryStore({ [RESUME_KEY]: '{not json' });
  assert.equal(readRun(broken, at(T0)).kind, 'none');
  assert.equal(broken.get(RESUME_KEY), null);
});

test('clearing it means it is gone, not blank', () => {
  const store = memoryStore();
  saveRun(store, startSession(assigned(), at(T0)), at(T0));
  clearRun(store);
  // NOT AN EMPTY STRING. A key left behind holding nothing is still a key on a
  // shared device saying somebody was here.
  assert.equal(store.get(RESUME_KEY), null);
});

test('what is stored says nothing about a reader beyond the number they were given', () => {
  const store = memoryStore();
  saveRun(store, startSession(assigned(), at(T0)), at(T0));
  const raw = (store.get(RESUME_KEY) ?? '').toLowerCase();
  for (const forbidden of ['name', 'accommodation', 'textsize', 'spacing', 'readaloud', 'onestep', 'device', 'answer']) {
    assert.ok(!raw.includes(forbidden), `an unfinished set carries a ${forbidden}`);
  }
});
