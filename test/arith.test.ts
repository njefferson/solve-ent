/**
 * arith.test.ts — the scratch line, which must never be subtly wrong.
 *
 * An application whose claim is attributing a wrong answer to a specific
 * mistake cannot be the thing that produced the wrong answer. So the cases here
 * are the ones a hand-rolled parser gets wrong: precedence, associativity, a
 * minus sign that is not a subtraction, and an exponent half typed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asWritten, evaluate } from '../src/num/arith.ts';

/** The value, or a failure that says what came back instead. */
const value = (line: string): number => {
  const result = evaluate(line);
  assert.equal(result.kind, 'value', `"${line}" came back as ${result.kind}`);
  return result.kind === 'value' ? result.value : Number.NaN;
};

const unreadable = (line: string): void => {
  assert.equal(evaluate(line).kind, 'unreadable', `"${line}" was read as something`);
};

test('the arithmetic a chemistry question actually needs', () => {
  assert.equal(value('3.975*1000/44.01'), (3.975 * 1000) / 44.01);
  assert.equal(value('6.022e23*0.25'), 6.022e23 * 0.25);
  assert.equal(value('1/0.250'), 4);
  assert.equal(value('2.5e-3*4'), 2.5e-3 * 4);
  // The keys say × and ÷, so those are what arrives.
  assert.equal(value('12 × 4 ÷ 3'), 16);
  assert.equal(value('7 − 2'), 5);
});

test('precedence and association are what the notation means', () => {
  assert.equal(value('2+3*4'), 14, 'multiplication binds tighter than addition');
  assert.equal(value('(2+3)*4'), 20);
  assert.equal(value('100/10/2'), 5, 'division is left-associative');
  assert.equal(value('100-10-2'), 88);
  assert.equal(value('2^3^2'), 512, 'a power tower is right-associative');
  assert.equal(value('-2^2'), -4, 'the sign is not part of the base');
  assert.equal(value('2*-3'), -6);
  assert.equal(value('--5'), 5);
});

test('what is not a number is refused rather than half read', () => {
  // THE FAILURE THAT MATTERS. A calculator that answers 3 to "3 4" is wrong in
  // the one way this application cannot afford, and it is what a parser that
  // stops at the first thing it understands does.
  unreadable('3 4');
  unreadable('3+');
  unreadable('(2+3');
  unreadable('2+3)');
  unreadable('.');
  unreadable('4/0', );
  unreadable('hello');
  unreadable('3 + hello');
  assert.equal(evaluate('').kind, 'empty');
  assert.equal(evaluate('   ').kind, 'empty');
});

test('a line still being typed is unreadable, never a partial answer', () => {
  // This runs on every keystroke, so half a sum is the ordinary case.
  const half = '6.022e';
  assert.equal(evaluate(half).kind, 'unreadable', 'an exponent with no digits is not a number yet');
  assert.equal(value('6.022e2'), 602.2);
  assert.equal(value('6.022e+2'), 602.2);
  assert.equal(value('6.022e-2'), 0.06022);
});

test('it never rounds, because rounding is one of the things being taught', () => {
  // Significant figures are a topic. A scratch line that handed back 90.3 would
  // be doing that step for the reader at the moment they are asked to do it.
  const raw = (3.975 * 1000) / 44.01;
  assert.equal(value('3.975*1000/44.01'), raw);
  assert.ok(String(value('1/3')).length > 5, '1/3 comes back at full precision');
  assert.equal(value('2/3'), 2 / 3);
});

test('what it SHOWS carries no binary noise, though what it computes stays exact', () => {
  // The reported case: a reader multiplied 3.49 by 8.39 in the calculator, put
  // the result in the answer box, and the working log recorded
  // 29.281100000000002 — seventeen figures, in an app that teaches significant
  // figures. Every handheld calculator in the room says 29.2811.
  assert.equal(3.49 * 8.39 === 29.2811, false, 'the double really is not 29.2811, so this is a display problem');
  assert.equal(asWritten(3.49 * 8.39), 29.2811);
  assert.equal(String(asWritten(3.49 * 8.39)), '29.2811');

  // AND IT IS NOT THE ROUNDING THE APP REFUSES. Fifteen significant digits is
  // far past anything a step asks for, so nothing a reader is being asked to do
  // is done for them.
  assert.equal(String(asWritten(2 / 3)).replace('0.', '').length, 15);
  assert.equal(asWritten(0.1 + 0.2), 0.3);

  // `evaluate` is untouched: the value stays exact.
  const raw = (3.975 * 1000) / 44.01;
  assert.equal(value('3.975*1000/44.01'), raw);
});
