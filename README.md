# Solve-ent

An algebra-skills trainer for one high school chemistry classroom.

Students arrive in chemistry unable to do the algebra chemistry needs. Not "bad
at maths" — they have never been shown how the specific moves work. This teaches
exactly those moves and nothing else.

**Attribution is the product.** Free tools already solve these problems and
already explain the procedure. What none of them do is attribute a specific
wrong answer to a specific conceptual failure — *the 0.0526 you wrote is what
you get when you multiply the concentration by the exponent instead of raising
it* — and report that to the teacher.

**There is no user interface yet, on purpose.** This repository currently holds
the domain engine, the error taxonomy, the step machine and the tests.

## What it covers

Seven topics, and the list is closed. Every one is here because a student cannot
do a stoichiometry problem without it.

- **Rearranging a formula** to solve for any variable in it — `PV = nRT`,
  `M × V = n`, `q = mcΔT` and the rest of the course's relations.
- **Proportions and cross-multiplication**, which is the mole ratio written as
  algebra.
- **Scientific notation**, and arithmetic in it.
- **Powers and roots** as they appear in rate laws and equilibrium expressions.
- **Fractions and reciprocals** — dividing by a rate, per-unit quantities.
- **Dimensional analysis** — cancelling units through a chain.
- **Significant figures**, and rounding once, at the end.

## How it works

Work is step-gated: one step at a time, each graded and diagnosed on its own. At
every step the engine computes the correct value AND a set of predicted wrong
values — one per plausible misconception, each derived from the same stated
numbers by making that specific mistake. A student's entry is matched against
that set.

If two misconceptions would produce something a student could not tell apart,
**the problem is not posed**. There is no tiebreak anywhere in the engine and
there never will be: a tiebreak means guessing which misconception somebody
holds, and a guess reported to a teacher as a diagnosis is worse than saying
nothing at all.

When nothing accounts for an entry it is reported as unclassified and COUNTED.
That rate is the number that says whether the taxonomy is any good, so it is
printed rather than hidden.

## Running it

Node 22.18 or newer. Node strips the TypeScript itself, so there is no build
step and no bundler.

```
npm ci
npm run check
```

That is the strict type check, the release triplet, the test suite, and then
`verify-algebra`, which recomputes the algebra from outside the engine.

## The harness

**It prints answers. It is not a student surface.**

```
node tools/cli.ts problem  --topic UNITS     --tier 2 --index 0
node tools/cli.ts stages   --topic REARRANGE --tier 3 --index 4
node tools/cli.ts diagnose --topic POWERS    --tier 1 --index 0 --stage W3 --entry "0.0934 mol/(L·s)"
node tools/cli.ts session  --topic PROPORTION --tier 2 --count 3
node tools/cli.ts scan     --count 500
```

`scan` prints the two numbers this project is measured by: the taxonomy
collision count, which must be zero, and the unclassified rate.

## What it is not

- **Not a solver.** It will not do a student's homework, and the one thing it
  must never become is a tool that does.
- **Not a general algebra course.** The seven topics are the fence.
- **Not a place any student information goes.** Identity is a teacher-assigned
  roster number. No names, no accounts, no cookies, no analytics, and nothing
  leaves the device.

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE.md). Use it, change it, share it — do not
sell it.
