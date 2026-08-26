/**
 * code.test.ts — the completion code, which travels on paper.
 *
 * The cases here are the ones that actually happen in a room: a character
 * copied wrong, a hand that writes `O` for zero, last week's code handed in
 * again, and a run long enough that a field runs out of room.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_LENGTH,
  CODE_LIMITS,
  groupCode,
  readCode,
  writeCode,
  type Assignment,
  type CodeInput,
} from '../src/report/code.ts';
import { COUNTER_SKILLS } from '../src/engine/taxonomy.ts';

const noSkills = Object.fromEntries(COUNTER_SKILLS.map((s) => [s, 0])) as Record<string, number>;

const input = (over: Partial<CodeInput> = {}): CodeInput => ({
  rosterNumber: 17,
  attempted: 14,
  rightFirstTime: 11,
  wrongBySkill: { ...noSkills, SCALE: 2, UNITS: 1 } as CodeInput['wrongBySkill'],
  elapsedMs: 7 * 60_000,
  ...over,
});

const SET: Assignment = { key: 'CHEM-7B', topic: 'UNITS', tier: 2 };

const read = (code: string, set: Assignment = SET): ReturnType<typeof readCode> => readCode(code, set);

test('what went in comes back out', () => {
  const code = writeCode(input(), SET);
  assert.equal(code.length, CODE_LENGTH);
  const back = read(code);
  assert.equal(back.kind, 'read');
  if (back.kind !== 'read') return;
  assert.equal(back.contents.rosterNumber, 17);
  assert.equal(back.contents.attempted, 14);
  assert.equal(back.contents.rightFirstTime, 11);
  assert.equal(back.contents.minutes, 7);
  assert.equal(back.contents.wrongBySkill['SCALE'], 2);
  assert.equal(back.contents.wrongBySkill['UNITS'], 1);
  assert.equal(back.contents.wrongBySkill['EVALUATE'], 0);
  assert.deepEqual(back.contents.atLimit, []);
});

test('every roster number in range survives the trip', () => {
  for (const roster of [1, 2, 42, 1000, 4095]) {
    const back = read(writeCode(input({ rosterNumber: roster }), SET));
    assert.equal(back.kind === 'read' ? back.contents.rosterNumber : -1, roster);
  }
});

test('the way a hand writes it is the way it reads', () => {
  const code = writeCode(input(), SET);
  // Lower case, grouped with hyphens, and spaces — all of which arrive.
  assert.equal(read(groupCode(code).toLowerCase()).kind, 'read');
  assert.equal(read(code.split('').join(' ')).kind, 'read');
  // O for zero and I or L for one are the three confusions that actually
  // happen, and Crockford's alphabet leaves those characters out so they can
  // resolve rather than fail.
  const written = code.replace(/0/g, 'O').replace(/1/g, 'l');
  assert.equal(read(written).kind, 'read');
});

test('a code that was copied wrong is refused, and says why', () => {
  const code = writeCode(input(), SET);
  // Every single-character substitution must fail. This is the whole job.
  let caught = 0;
  let tried = 0;
  for (let i = 0; i < code.length; i += 1) {
    for (const digit of '23456789ABCDEFGHJKMNPQRSTVWXYZ') {
      if (code[i] === digit) continue;
      tried += 1;
      const bent = code.slice(0, i) + digit + code.slice(i + 1);
      const back = read(bent);
      if (back.kind === 'unreadable') caught += 1;
    }
  }
  // A 24-bit check misses about one in sixteen million by chance; over a few
  // hundred bendings, missing none is what is expected and what is asserted.
  assert.equal(caught, tried, `${String(tried - caught)} of ${String(tried)} mistyped codes read as valid`);
});

test('a code from another set does not read against this one', () => {
  const code = writeCode(input(), SET);
  // A DIFFERENT KEY, A DIFFERENT TOPIC, AND A LOWER DIFFICULTY. The last is the
  // one worth having: a code earned on the easiest questions must not read as
  // the set that was actually given out.
  const others: Assignment[] = [
    { ...SET, key: 'CHEM-7C' },
    { ...SET, topic: 'FRACTIONS' },
    { ...SET, tier: 1 },
  ];
  for (const other of others) {
    const back = read(code, other);
    assert.equal(back.kind, 'unreadable', `${JSON.stringify(other)} read a code that was not its own`);
    assert.equal(back.kind === 'unreadable' ? back.why : '', 'CHECK');
  }
});

test('a code that is not one says which way it is not', () => {
  assert.equal(read('').kind === 'unreadable' ? 'EMPTY' : '', 'EMPTY');
  assert.equal(read('ABC').kind === 'unreadable' ? 'LENGTH' : '', 'LENGTH');
  // U is not in the alphabet at all, and length is checked first.
  const back = read('UUUUUUUUUUUUUUUU');
  assert.equal(back.kind === 'unreadable' ? back.why : '', 'CHARACTER');
});

test('a field that ran out of room says so rather than looking exact', () => {
  const back = read(
    writeCode(
      input({
        attempted: 900,
        elapsedMs: 200 * 60_000,
        wrongBySkill: { ...noSkills, SCALE: 40 } as CodeInput['wrongBySkill'],
      }),
      SET,
    ),
  );
  assert.equal(back.kind, 'read');
  if (back.kind !== 'read') return;
  assert.equal(back.contents.attempted, CODE_LIMITS.attempted);
  assert.equal(back.contents.minutes, CODE_LIMITS.minutes);
  assert.equal(back.contents.wrongBySkill['SCALE'], CODE_LIMITS.perSkill);
  assert.ok(back.contents.atLimit.includes('steps'));
  assert.ok(back.contents.atLimit.includes('minutes'));
  assert.ok(back.contents.atLimit.includes('SCALE'));
});

test('there is nowhere in a code for an accommodation or a name', () => {
  // THE TYPE IS THE WALL, and this reads the shape rather than trusting it.
  const back = read(writeCode(input(), SET));
  assert.equal(back.kind, 'read');
  if (back.kind !== 'read') return;
  const fields = Object.keys(back.contents).join(' ').toLowerCase();
  for (const forbidden of ['name', 'accommodation', 'textsize', 'spacing', 'readaloud', 'onestep', 'device']) {
    assert.ok(!fields.includes(forbidden), `a code carries a ${forbidden}`);
  }
});
