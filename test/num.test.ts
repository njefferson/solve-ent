/**
 * num.test.ts — the arithmetic everything else is built on.
 *
 * Significant figures and unit algebra. Both are ordinary and both are the
 * kind of thing that is quietly wrong for a year, because every value that
 * passes through them looks plausible.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addSubtract,
  exact,
  formatSigFigs,
  formatUnambiguous,
  isAmbiguous,
  lastPlaceOf,
  magnitudeOf,
  measured,
  multiplyDivide,
  parseQuantity,
  roundToSigFigs,
  SigFigError,
  sigFigsFrom,
} from '../src/num/sigfig.ts';
import {
  DIMENSIONLESS,
  divideUnits,
  flip,
  formatUnit,
  invertUnits,
  isDimensionless,
  multiplyUnits,
  parseUnit,
  runChain,
  sameUnit,
} from '../src/num/units.ts';

/* ---- significant figures ---- */

test('a bare integer with trailing zeros is ambiguous, and stays that way', () => {
  // THE RULE THAT SHAPES THE MODULE. `1500` may be two, three or four figures
  // and nothing in the string says which. Picking one would be inventing
  // information about somebody's measurement, and the app would then mark a
  // student wrong for the reading it did not pick.
  const q = parseQuantity('1500');
  assert.equal(isAmbiguous(q), true);
  assert.equal(q.value, 1500);
  if (q.kind !== 'ambiguous') throw new Error('unreachable');
  assert.equal(q.low.sigFigs, 2);
  assert.equal(q.high.sigFigs, 4);

  // A decimal point or an explicit exponent settles it — that is what writing
  // them was for.
  assert.equal(isAmbiguous(parseQuantity('1500.')), false);
  assert.equal(isAmbiguous(parseQuantity('1.500e3')), false);
});

test('leading zeros are placeholders and are never significant', () => {
  const q = parseQuantity('0.00450');
  if (q.kind !== 'measured') throw new Error('0.00450 is not ambiguous');
  assert.equal(q.reading.sigFigs, 3);
  assert.equal(q.value, 0.0045);
});

test('every rejection names the offset it happened at', () => {
  for (const bad of ['', 'abc', '1.2.3', '1e', '5 apples', '1,5']) {
    assert.throws(
      () => parseQuantity(bad),
      (error: unknown) => error instanceof SigFigError && typeof error.offset === 'number',
      `"${bad}" was accepted or failed without an offset`,
    );
  }
  // A comma is a THOUSANDS separator or it is nothing. `1,500` reads as
  // fifteen hundred; `1,5` is a European decimal comma, and reading it as
  // fifteen would be wrong by a factor of ten while looking reasonable.
  assert.equal(parseQuantity('1,500').value, 1500);
});

test('formatting rounds first and measures the rounded value', () => {
  // 9.96 at two figures carries into a new decade. Taking the magnitude from
  // the value as given produces `10.0`, which reads as three figures — a
  // defect that shipped in the app this module came from.
  assert.equal(formatSigFigs(9.96, 2), '10');
  assert.equal(formatUnambiguous(9.96, 2), '10.');
  assert.equal(formatSigFigs(0.0663836, 3), '0.0664');
  assert.equal(formatSigFigs(1.5, 6), '1.50000');
  assert.equal(formatSigFigs(1.23e-7, 3), '1.23e-7');
});

test('what a written number claims is what it writes', () => {
  // A number written to n figures must WRITE n figures. Checked by counting
  // the digits back out of the string rather than by trusting the formatter,
  // because the formatter is the thing under test.
  const digitsOf = (text: string): number => {
    const mantissa = text.split(/[eE]/)[0] as string;
    return mantissa.replace('-', '').replace('.', '').replace(/^0+/, '').length;
  };
  for (const value of [1, 9.96, 0.00450123, 180.156, 1.2345e-9, 6.022e23, 42]) {
    for (const figures of [2, 3, 4, 5]) {
      assert.equal(
        digitsOf(formatSigFigs(value, figures)),
        figures,
        `${value} at ${figures} figures wrote "${formatSigFigs(value, figures)}"`,
      );
    }
  }
});

test('multiplication takes the fewest figures and addition the coarsest place', () => {
  const a = measured(2.89, 3);
  const b = measured(4.5451, 5);
  const product = multiplyDivide(2.89 * 4.5451, [a, b]);
  if (product.kind !== 'measured') throw new Error('a product of two measurements is measured');
  assert.equal(product.reading.sigFigs, 3);

  const sum = addSubtract(318.32 + 20.1, [measured(318.32, 5), measured(20.1, 3)]);
  if (sum.kind !== 'measured') throw new Error('a sum of two measurements is measured');
  assert.equal(sum.reading.lastPlace, -1);

  // An exact operand constrains nothing — that is what makes it exact.
  const withExact = multiplyDivide(2.89 * 3, [a, exact(3)]);
  if (withExact.kind !== 'measured') throw new Error('an exact operand does not erase the measured one');
  assert.equal(withExact.reading.sigFigs, 3);
  assert.equal(multiplyDivide(6, [exact(2), exact(3)]).kind, 'exact');
});

test('magnitude and last place are inverses of each other', () => {
  for (const value of [12.3, 0.00456, 5, 1000, 6.022e23, 1.5e-9]) {
    for (const figures of [1, 2, 3, 5]) {
      assert.equal(sigFigsFrom(value, lastPlaceOf(value, figures)), figures, `${value} at ${figures}`);
    }
  }
  assert.equal(magnitudeOf(1000), 3, 'computed by string — Math.log10(1000) is not always 3');
  assert.equal(magnitudeOf(0.00456), -3);
});

test('rounding uses the decimal round trip, not a scale factor', () => {
  assert.equal(roundToSigFigs(180.15600000001, 6), 180.156);
  assert.equal(roundToSigFigs(0, 3), 0);
});

/* ---- unit algebra ---- */

test('a unit expression cancels, and compares regardless of the order written', () => {
  assert.equal(formatUnit(parseUnit('g/mol')), 'g/mol');
  assert.equal(formatUnit(multiplyUnits(parseUnit('g'), parseUnit('mol/g'))), 'mol');
  assert.equal(sameUnit(parseUnit('mol·L'), parseUnit('L·mol')), true);
  assert.equal(sameUnit(parseUnit('J/(g·K)'), parseUnit('J/(K·g)')), true);
  assert.equal(isDimensionless(divideUnits(parseUnit('g'), parseUnit('g'))), true);
  assert.equal(formatUnit(DIMENSIONLESS), '');
  assert.equal(formatUnit(invertUnits(parseUnit('mol/g'))), 'g/mol');
});

test('two divisions in one unit is refused rather than guessed at', () => {
  assert.throws(() => parseUnit('a/b/c'), RangeError);
});

test('a chain reports the unit it actually arrived at, however wrong', () => {
  // IT DOES NOT THROW, and that is the diagnostic. A chain ending in g²/mol
  // has told the student exactly which link is upside down; a function that
  // refused to compute it would have thrown that away.
  const molarMass = 44.01;
  const good = runChain(88.02, parseUnit('g'), [
    { label: 'molar mass', value: 1 / molarMass, unit: parseUnit('mol/g') },
  ]);
  assert.equal(formatUnit(good.unit), 'mol');
  assert.ok(Math.abs(good.value - 2) < 1e-9);

  const upsideDown = runChain(88.02, parseUnit('g'), [
    flip({ label: 'molar mass', value: 1 / molarMass, unit: parseUnit('mol/g') }),
  ]);
  assert.equal(formatUnit(upsideDown.unit), 'g·g/mol');
  assert.notEqual(upsideDown.value, good.value);
});
