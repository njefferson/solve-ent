/**
 * units.ts — units as algebra, so that cancelling is a computation rather than
 * a claim about one.
 *
 * THE POINT OF THIS FILE. Dimensional analysis is on the topic list because a
 * student cannot do a stoichiometry problem without it, and the whole skill is
 * watching a unit cancel. An app that PRINTS "g cancels" while its own
 * arithmetic multiplies numbers with no idea what they are attached to is
 * teaching the skill it cannot itself perform — so a unit here is a value the
 * engine carries, multiplies, inverts and compares, and "the chain ends in
 * mol" is something the engine works out rather than something a generator was
 * told to say.
 *
 * A unit expression is a product over a quotient: a bag of symbols on top and a
 * bag underneath, always kept cancelled. `g/mol` is `{num: ['g'], den:
 * ['mol']}`; `mol` is `{num: ['mol'], den: []}`; a pure number is both empty.
 * Symbols are opaque strings and nothing here knows that a gram is a mass —
 * that would be a units LIBRARY, and this only has to cancel what it is given.
 *
 * PURE. No I/O, no globals, no clock.
 */

/** A product of unit symbols over a product of unit symbols, always cancelled. */
export interface UnitExpr {
  readonly num: readonly string[];
  readonly den: readonly string[];
}

/** The unit of a bare number. */
export const DIMENSIONLESS: UnitExpr = { num: [], den: [] };

/**
 * Remove every symbol appearing on both sides, and sort what is left.
 *
 * SORTED, because two expressions built by different routes must compare equal
 * — `mol·L` and `L·mol` are one unit, and an app that told a student otherwise
 * would be inventing a mistake.
 */
function cancel(num: readonly string[], den: readonly string[]): UnitExpr {
  const top = [...num];
  const bottom: string[] = [];
  for (const symbol of den) {
    const at = top.indexOf(symbol);
    if (at >= 0) top.splice(at, 1);
    else bottom.push(symbol);
  }
  top.sort();
  bottom.sort();
  return { num: top, den: bottom };
}

/**
 * Read a unit expression from text.
 *
 * PRECONDITION: none. Accepts `g`, `g/mol`, `mol/L`, `J/(g·K)`, `g·K`,
 * `particles/mol` and the empty string, which is the dimensionless unit. A
 * symbol is any run that is not a separator; `·`, `*` and a space all multiply,
 * and one `/` divides everything after it.
 *
 * A SECOND SLASH IS REFUSED rather than guessed at. `a/b/c` means `a/(b·c)` to
 * some readers and `(a/b)/c`... which is the same thing, and `a/(b/c)` to
 * others, which is not. There is no way to tell from the string, so it is
 * rejected where whoever wrote it can see it.
 */
export function parseUnit(text: string): UnitExpr {
  const trimmed = text.trim();
  if (trimmed.length === 0) return DIMENSIONLESS;
  const slashes = trimmed.split('/').length - 1;
  if (slashes > 1) throw new RangeError(`"${text}" has two divisions and only one reading is not a guess`);
  const [topText = '', bottomText = ''] = trimmed.split('/');
  const split = (part: string): string[] =>
    part
      .replace(/[()]/g, '')
      .split(/[·*\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  return cancel(split(topText), split(bottomText));
}

/**
 * Write a unit expression the way a student writes one.
 *
 * PRECONDITION: none. The dimensionless unit comes back as the empty string,
 * because a bare number has no unit rather than a unit called "1".
 */
export function formatUnit(u: UnitExpr): string {
  const top = u.num.length === 0 ? (u.den.length === 0 ? '' : '1') : u.num.join('·');
  if (u.den.length === 0) return top;
  const bottom = u.den.length === 1 ? (u.den[0] as string) : `(${u.den.join('·')})`;
  return `${top}/${bottom}`;
}

/** The product of two unit expressions, cancelled. */
export function multiplyUnits(a: UnitExpr, b: UnitExpr): UnitExpr {
  return cancel([...a.num, ...b.num], [...a.den, ...b.den]);
}

/** One unit expression divided by another, cancelled. */
export function divideUnits(a: UnitExpr, b: UnitExpr): UnitExpr {
  return cancel([...a.num, ...b.den], [...a.den, ...b.num]);
}

/** A unit expression turned upside down. */
export function invertUnits(a: UnitExpr): UnitExpr {
  return { num: [...a.den], den: [...a.num] };
}

/** True where two unit expressions are the same unit. */
export function sameUnit(a: UnitExpr, b: UnitExpr): boolean {
  return (
    a.num.length === b.num.length &&
    a.den.length === b.den.length &&
    a.num.every((s, i) => s === b.num[i]) &&
    a.den.every((s, i) => s === b.den[i])
  );
}

/** True where the expression is a bare number. */
export function isDimensionless(u: UnitExpr): boolean {
  return u.num.length === 0 && u.den.length === 0;
}

/**
 * One link in a dimensional-analysis chain: a number with a unit on top and a
 * unit underneath.
 *
 * `applied` is what the student writes down — the factor the RIGHT way up for
 * this chain. `value` and `unit` are that. The upside-down version is
 * {@link flip}, and it is what E-UNIT-FACTOR-INVERTED predicts.
 */
export interface Factor {
  /** What it is, in words, for the worked line. */
  readonly label: string;
  /** The numeric value of the factor as written. */
  readonly value: number;
  /** The unit of the factor as written — the top over the bottom. */
  readonly unit: UnitExpr;
}

/** The same conversion, written the other way up. */
export function flip(factor: Factor): Factor {
  return { label: factor.label, value: 1 / factor.value, unit: invertUnits(factor.unit) };
}

/**
 * Multiply a starting quantity through a chain of factors and report where it
 * ended up.
 *
 * PRECONDITION: none — this does NOT require the units to cancel. It reports
 * the unit it arrived at, which is the whole diagnostic: a chain that ends in
 * `g²/mol` has told the student exactly which link is upside down, and a
 * function that threw instead would have thrown that information away.
 */
export function runChain(
  startValue: number,
  startUnit: UnitExpr,
  factors: readonly Factor[],
): { readonly value: number; readonly unit: UnitExpr } {
  let value = startValue;
  let unit = startUnit;
  for (const factor of factors) {
    value *= factor.value;
    unit = multiplyUnits(unit, factor.unit);
  }
  return { value, unit };
}
