/**
 * blocked.test.ts — one move, again.
 *
 * The property that matters most here is not that the drill works; it is that
 * it CANNOT accumulate. No session, no completion code, nothing recorded — and
 * that is held by reading the source, because it is a claim about what does not
 * exist rather than about what one run happens to produce.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drillItem, drillableSkills } from '../src/engine/blocked.ts';
import { COUNTER_SKILLS, SKILL_NAMES, classify, correctEntryFor } from '../src/engine/taxonomy.ts';
import { solve } from '../src/engine/problem.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';

test('every move can be drilled, and the list is measured rather than declared', () => {
  // A move quietly missing from the menu is worse than a loud failure here.
  // REARRANGE — isolating the unknown, the move this app is most about — was
  // reachable in NO tier-1 problem and in about one tier-3 rearrangement in
  // twelve, so the first two versions of the search produced it never and then
  // fourteen times in twenty.
  const reachable = drillableSkills(COUNTER_SKILLS, 'practice');
  assert.deepEqual(
    [...reachable].sort(),
    [...COUNTER_SKILLS].sort(),
    `these moves cannot be posed as a drill: ${COUNTER_SKILLS.filter((s) => !reachable.includes(s)).join(', ')}`,
  );
});

test('a drill produces an item every time, not most of the time', () => {
  // Forty in a row per skill. The version that searched blindly passed a
  // single-item check and failed this one.
  for (const skill of COUNTER_SKILLS) {
    for (let index = 0; index < 40; index += 1) {
      assert.notEqual(
        drillItem(skill, 'practice', index),
        null,
        `${SKILL_NAMES[skill]} produced nothing at item ${String(index)}`,
      );
    }
  }
});

test('every item drills the move that was asked for, and only that step', () => {
  for (const skill of COUNTER_SKILLS) {
    for (let index = 0; index < 12; index += 1) {
      const item = drillItem(skill, 'practice', index);
      assert.notEqual(item, null);
      if (item === null) continue;
      assert.equal(item.stage.counter, skill, `${skill} drill served a ${item.stage.counter} step`);
      assert.ok(item.stage.prompt.trim().length > 0, 'a step with nothing asked');
      assert.ok(item.problem.prompt.trim().length > 0, 'a step with no question around it');
    }
  }
});

test('the same key gives the same drill, on any device', () => {
  // The property that lets one thing written on a board produce one drill.
  for (const skill of COUNTER_SKILLS) {
    for (let index = 0; index < 6; index += 1) {
      const first = drillItem(skill, 'board-key', index);
      const second = drillItem(skill, 'board-key', index);
      assert.deepEqual(first, second);
    }
  }
});

test('a different key gives a different drill', () => {
  const a = drillItem('EVALUATE', 'one', 0);
  const b = drillItem('EVALUATE', 'two', 0);
  assert.notDeepEqual(a?.problem, b?.problem);
});

test('a drill item carries no answer, because a Problem carries no answer', () => {
  // The wall is the type. A screen renders a Problem and a Stage, and neither
  // has anywhere to put the value, the intermediate or the prediction.
  for (const skill of COUNTER_SKILLS) {
    const item = drillItem(skill, 'practice', 0);
    assert.notEqual(item, null);
    if (item === null) continue;
    const shown = JSON.stringify({ problem: item.problem, stage: item.stage });
    const solution = solve(item.problem);
    const answer = correctEntryFor(item.problem, solution, item.stage, SCRATCH_SIG_FIGS);
    if (answer.kind === 'text') {
      // The digits of the answer must not appear in what a screen is handed.
      // Checked on the STRING the screen sees rather than on a field name,
      // because a leak arrives as a value and not as a label.
      const digits = answer.text.replace(/[^\d]/g, '');
      if (digits.length >= 4) {
        assert.ok(
          !shown.replace(/[^\d]/g, '').includes(digits),
          `${skill}: the answer ${answer.text} is reachable from what the screen renders`,
        );
      }
    }
  }
});

test('the classifier a drill loops around is still pure', () => {
  // Not for testability — that purity is WHY a drill is a loop with no session.
  // The same call, twice, with nothing in between.
  const item = drillItem('EVALUATE', 'practice', 3);
  assert.notEqual(item, null);
  if (item === null) return;
  const entry = { kind: 'text', text: '1.234' } as const;
  // The signature is (problem, solution, stage, entry), and `solve` is itself a
  // pure function of the problem — so the composition is pure and a drill needs
  // to carry nothing between items. Written out here because the shorthand
  // "(problem, stage, entry)" is one argument loose, and calling it that way
  // crashes inside the engine rather than failing to compile.
  const solution = solve(item.problem);
  const first = classify(item.problem, solution, item.stage, entry);
  const second = classify(item.problem, solution, item.stage, entry);
  assert.deepEqual(first, second);
  // And nothing about the FIRST call changes the second's answer for a
  // different entry, which is the property a loop actually leans on.
  const other = { kind: 'text', text: '9.876' } as const;
  assert.deepEqual(
    classify(item.problem, solution, item.stage, other),
    classify(item.problem, solve(item.problem), item.stage, other),
  );
});

test('nothing in the drill can accumulate: no session, no code, no clock', () => {
  // A CLAIM ABOUT WHAT DOES NOT EXIST, so it is read off the source. A drill
  // that could produce a completion code would be a drill somebody could be
  // asked to hand in, and the whole point is that this one records nothing.
  const strip = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const code = strip(readFileSync(new URL('../src/engine/blocked.ts', import.meta.url), 'utf8'));
  for (const forbidden of ['Session', 'completionCounts', 'rosterNumber', 'Date', 'now(', 'Clock']) {
    assert.equal(code.includes(forbidden), false, `src/engine/blocked.ts reaches for ${forbidden}`);
  }
});
