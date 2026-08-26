/**
 * arith.ts — evaluating what a reader typed into the scratch line.
 *
 * ## Why this exists rather than `eval`
 *
 * A reader working a chemistry question has to multiply a mass by a thousand
 * and divide by a molar mass, and this application's whole position is that
 * they should not need a second thing in front of them to do it. So there is a
 * scratch line, and something has to work out what is on it.
 *
 * `eval` and `new Function` are not options: they would run whatever text
 * arrived as PROGRAM, in a page that also holds the grader. This reads the
 * text as arithmetic and can produce nothing else, because there is nothing
 * else in the grammar.
 *
 * ## Why it is here rather than in the screen
 *
 * The screen cannot be tested without a browser and this can be tested with a
 * number. It is also the one piece of this application that must never be
 * subtly wrong: an app whose claim is attributing a wrong answer to a specific
 * mistake cannot be the thing that produced the wrong answer.
 *
 * ## What it does NOT do
 *
 * **It never rounds.** Significant figures are one of the seven things being
 * taught, and a scratch line that handed back a rounded number would be doing
 * that step for the reader — silently, and at the exact moment they were being
 * asked to do it themselves.
 *
 * The grammar, smallest first:
 *
 *     expression := term (("+" | "-") term)*
 *     term       := unary (("*" | "/") unary)*
 *     unary      := ("-" | "+") unary | power   — the sign is ABOVE the power
 *     power      := primary ("^" unary)?        — right-associative, as written
 *     primary    := number | "(" expression ")"
 *     number     := digits ["." digits] [("e"|"E") ["+"|"-"] digits]
 */

/** What a scratch line came to, or why it could not. */
export type Arithmetic =
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unreadable'; readonly at: number };

/** The characters a reader can type or press. `×` and `÷` are what the keys say. */
const OPERATORS: Readonly<Record<string, string>> = {
  '×': '*',
  '·': '*',
  '÷': '/',
  '−': '-',
  '–': '-',
  '—': '-',
  ',': '',
};

interface Reader {
  readonly text: string;
  at: number;
  failed: number | null;
}

const skip = (r: Reader): void => {
  while (r.at < r.text.length && r.text[r.at] === ' ') r.at += 1;
};

const peek = (r: Reader): string => (r.at < r.text.length ? (r.text[r.at] as string) : '');

function fail(r: Reader): number {
  if (r.failed === null) r.failed = r.at;
  return Number.NaN;
}

function primary(r: Reader): number {
  skip(r);
  if (peek(r) === '(') {
    r.at += 1;
    const inside = expression(r);
    skip(r);
    if (peek(r) !== ')') return fail(r);
    r.at += 1;
    return inside;
  }
  const start = r.at;
  while (/[0-9]/.test(peek(r))) r.at += 1;
  if (peek(r) === '.') {
    r.at += 1;
    while (/[0-9]/.test(peek(r))) r.at += 1;
  }
  if (r.at === start || r.text.slice(start, r.at) === '.') return fail(r);
  // An exponent, which this application's readers meet constantly — a mole is
  // 6.022e23 and nobody is typing twenty-three zeros.
  if (peek(r) === 'e' || peek(r) === 'E') {
    const mark = r.at;
    r.at += 1;
    if (peek(r) === '+' || peek(r) === '-') r.at += 1;
    const digits = r.at;
    while (/[0-9]/.test(peek(r))) r.at += 1;
    // `4e` on its own is somebody part-way through typing, not a number.
    if (r.at === digits) r.at = mark;
  }
  const value = Number(r.text.slice(start, r.at));
  return Number.isFinite(value) ? value : fail(r);
}

/**
 * A sign, or a power.
 *
 * THE SIGN SITS ABOVE THE POWER, not below it, and that is the whole reason
 * these are two functions. Written the other way round — a power whose base is
 * a signed number — `-2^2` comes to 4, because the minus is swallowed into the
 * base before the exponent is seen. It is −4: the exponent binds tighter than
 * the sign, in every textbook this application's readers will ever open.
 */
function unary(r: Reader): number {
  skip(r);
  const sign = peek(r);
  if (sign === '-' || sign === '+') {
    r.at += 1;
    const inner = unary(r);
    return sign === '-' ? -inner : inner;
  }
  return power(r);
}

function power(r: Reader): number {
  const base = primary(r);
  skip(r);
  if (peek(r) !== '^') return base;
  r.at += 1;
  // RIGHT-ASSOCIATIVE, because that is what the notation means: 2^3^2 is 2^9.
  // The exponent is a UNARY so that `2^-3` is a number rather than a failure.
  return base ** unary(r);
}

function term(r: Reader): number {
  let value = unary(r);
  for (;;) {
    skip(r);
    const operator = peek(r);
    if (operator !== '*' && operator !== '/') return value;
    r.at += 1;
    const next = unary(r);
    // DIVISION BY ZERO IS UNREADABLE, not Infinity. Infinity is a number a
    // reader could put in an answer box, and it is never an answer.
    if (operator === '/' && next === 0) return fail(r);
    value = operator === '*' ? value * next : value / next;
  }
}

function expression(r: Reader): number {
  let value = term(r);
  for (;;) {
    skip(r);
    const operator = peek(r);
    if (operator !== '+' && operator !== '-') return value;
    r.at += 1;
    const next = term(r);
    value = operator === '+' ? value + next : value - next;
  }
}

/**
 * Work out what a scratch line comes to.
 *
 * PRECONDITION: none. Anything at all can arrive here, including half a sum
 * somebody is still typing — which is the ordinary case, since this runs on
 * every keystroke. An unfinished line is `unreadable` and says where it stopped
 * making sense; it is never an exception and never a partial answer.
 */
export function evaluate(line: string): Arithmetic {
  const text = [...line].map((c) => OPERATORS[c] ?? c).join('');
  if (text.trim() === '') return { kind: 'empty' };
  const r: Reader = { text, at: 0, failed: null };
  const value = expression(r);
  skip(r);
  // TRAILING TEXT IS A FAILURE. `3 4` is not 3, and a calculator that answered
  // 3 to it would be wrong in the one way this application cannot afford.
  if (r.failed !== null) return { kind: 'unreadable', at: r.failed };
  if (r.at < r.text.length) return { kind: 'unreadable', at: r.at };
  if (!Number.isFinite(value)) return { kind: 'unreadable', at: r.text.length };
  return { kind: 'value', value };
}
