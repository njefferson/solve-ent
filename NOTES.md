# NOTES.md — Solve-ent, source of truth

Read this first, every session. `README.md` is for someone using the
repository; this is for someone changing it.

## Thesis

Students arrive in chemistry unable to do the algebra chemistry needs. Not "bad
at maths" — they have never been shown how the specific moves work. This app
teaches exactly those moves and nothing else.

**Attribution is the product. Do not build a solver.** Free tools already solve
these and already explain the procedure. What none of them do is attribute a
specific wrong answer to a specific conceptual failure and report that to the
teacher. Every decision below follows from that, and the one thing this must
never become is a solver.

The audience is one classroom, and this is a sibling to MoleBridge: the same
teacher, the same students, the same board at the front of the room. Static, no
backend, no accounts, no cookies, and no student PII ever — identity is a
teacher-assigned roster number.

**The name is a chemistry pun on purpose: a solvent dissolves things, and this
app is about solving.** That sentence belongs in the About panel when there is
one, said once and never explained again.

## Where this stands

**Session 1 is complete. There is no user interface, on purpose.** The domain
engine, the error taxonomy, the step machine and the test suite are built and
green: 49 tests, a clean strict type check with no `any` in the tree, and no
runtime dependencies at all.

**The two numbers session 1 exists to produce:**

- **Taxonomy collisions: 0**, over 10,500 generated problems and 72,577
  predicted wrong values. Two error classes predicting something a student
  could not tell apart fails the build. There is no tiebreak anywhere and there
  never will be.
- **E-UNCLASSIFIED rate: 10.16%** over 26,022 deliberately wrong entries. About
  a quarter of that sweep's entries are a whole factor of ten out and are
  unclassified by definition, so the rate is close to this sweep's floor rather
  than a gap in the taxonomy.

Both are printed by `npm test` and by `node tools/cli.ts scan`.

Two more numbers are printed beside them, and both exist to keep the first two
honest — see *What the collision sweep cannot see* below.

## The scope, and the fence around it

Seven topics, and the list is closed:

- rearranging a formula to solve for any variable in it
- proportions and cross-multiplication, which IS the mole ratio
- scientific notation, and arithmetic in it
- powers and roots as they appear in real formulas
- fractions and reciprocals — dividing by a rate, per-unit quantities
- dimensional analysis: cancelling units through a chain
- significant figures and rounding once, at the end

**Ask the teacher before adding anything else.** Every topic has to be
justifiable as *a student cannot do a stoichiometry problem without it*. This is
not a general algebra course and must never grow into one.

## The decomposition, and where it had to change

Twenty-nine error classes. Each predicts the exact wrong value a student holding
that misconception would write, computed from the problem's own stated numbers.
Four of them are not misconceptions and are named as such: E-UNIT-MISSING and
E-UNIT-WRONG are about the unit rather than the number, E-ARITH is a slip with
the right method, and E-UNCLASSIFIED means the app cannot tell.

**Six counters, by SKILL rather than by stage number.** A teacher looking at a
class wants to know which MOVE a student cannot make, and "everybody fails step
three" means nothing when step three is a different thing in each of seven
topics. Choosing the move, isolating the unknown, scaling by a ratio, doing the
arithmetic, carrying units, and precision are the same move wherever they
appear, so a count is comparable across topics.

**The choices on a CHOICE stage ARE the predictions, written symbolically.** An
option list assembled by hand would be a second statement of which mistakes
exist and would go stale the first time a class was added. Generated from the
classes, a wrong choice attributes with no lookup table in between — and
because the options are symbolic they carry no value, so showing them is not
showing an answer.

**A stage's predictions are about THAT stage's mistake, never a carried-forward
one.** The first version of the scientific-notation stages predicted the
exponent a student would reach by carrying an earlier mistake into a later step.
That collided with the normalisation error twelve times in a forty-problem sweep
and was the wrong model anyway: work is step-gated and each step is diagnosed on
its own, so a student who got an early step wrong and carried it consistently is
showing that mistake again rather than a second one.

## Generation guarantees, and the one that could go circular

A problem is refused when two error classes would predict something a student
could not tell apart. **The fix for a collision is always to stop posing the
problem, never to add a tiebreak** — a tiebreak means guessing which
misconception somebody holds, and a guess reported to a teacher as a diagnosis is
worse than saying nothing.

Every guarantee is a condition on the problem's own STATED VALUES, and that
phrasing is load-bearing. A guarantee written as *no two predictions land on the
same number* would make the collision sweep circular: the sweep would be
re-running the generator's own test and reporting zero because it could not
report anything else (hub LESSONS 141).

**`PREDICTIONS_SEPARATED` is the one exception, and it is named separately for
exactly that reason.** Two topics have class pairs with no algebraic separator —
powers, where `x·n = n^x` has no solution a generator can be told to avoid, and
significant figures, where rounding early and applying the wrong rule land
relative to each other by digits rather than by any relation. **The sweep prints
how many candidates each guarantee refused, so the share the backstop accounts
for is a number rather than a claim: it is currently 0.4% of 10,282 refusals.**

Guarantees worth reading before touching the generator:

- **`NO_DEGENERATE_PRODUCT`** (rearranging). With A the correct answer, R the
  product of the factors beside the unknown and O the far side, the four
  predictions are A, A·R², 1/A and A·f. Every pair agrees exactly when one of
  R, A, O or f is 1, and the algebra for that is written out in the code.
- **`RATIO_NOT_UNITY`** (proportions) is EXACT, not a margin, because a mole
  ratio is COUNTED — its two numbers are coefficients from a balanced equation
  and there is no measurement in them to be near anything. A margin there did
  real damage: at 0.2 it refused the 4:5 recipe, a perfectly good proportion to
  teach with, and refused it by a floating-point hair, since `|0.8 − 1|`
  computes as 0.19999999999999996.
- **`SCALE_NOT_RECIPE`** is the separation the additive misconception needs, and
  its first version was the wrong shape. The gap between "add the difference"
  and the right answer is `(c − a)(b − a)/a`, so a margin on `c/a` alone does
  not mention the ratio at all — with a recipe of 4:5, 4.99 of the first
  substance and two significant figures asked for, the additive answer and the
  correct one are both 6.0.
- **`EXPONENTS_NOT_DEGENERATE`** is worked out by hand over the integers:
  `e₁+e₂ = e₁·e₂` has integer solutions only at (0,0) and (2,2), and
  `e₁−e₂ = e₁·e₂` only at (0,0) and (−2,2). **And the margin is two, not one**,
  because renormalising moves the answer's exponent by one either way — at a
  margin of one, "multiplied the exponents" lands exactly where "shifted the
  decimal point without moving the exponent" lands.
- **`CHAIN_PRODUCT_NOT_UNITY`** exists because turning a whole chain upside down
  divides the answer by the square of the chain's product, so a chain whose
  factors multiply to about 1 puts that mistake back on the correct answer.
  Found on a real one: 1.98 g/mL × (1/44.01) mol/g × 22.414 L/mol comes to
  1.0084, and at two significant figures the inverted chain and the right answer
  are the same number.

## What the collision sweep cannot see, and how that was found

**Dropping the `RATIO_NOT_UNITY` guarantee moved the collision count by exactly
nothing.** It could not: a one-to-one ratio makes using the ratio upside down,
ignoring it entirely and getting it right all produce the SAME number, so all
three predictions land on the correct answer and are dropped before the
collision check ever sees them. A problem where every misconception is invisible
reports as perfectly clean.

A plant that does not move the measurement is telling you the path is dead (hub
LESSONS 32). So the number that would have moved is measured and printed:
**ATTRIBUTION BLIND SPOTS — how many numeric stages have no attributable
prediction left at all.** It is currently 9.30% of 6,670 stages, concentrated in
significant figures and scientific notation. A wrong answer at one of those can
only ever come back as an arithmetic slip or E-UNCLASSIFIED, whatever the
student actually did.

**And the plant took three attempts to aim at anything.**

1. Removing the guarantee moved nothing, because the recipe table had no 1:1
   ratio in it — the guarantee was armed and dormant, refusing only the 4:5
   recipe, by the floating-point hair above.
2. Adding 1:1 recipes to the table gave it something real to refuse. Removing
   the guarantee still moved nothing, because `SCALE_NOT_RECIPE` refuses the
   same candidates: at a = b the additive answer IS the correct answer.
3. Removing BOTH moved two measurements — one collision appeared and the blind
   spot went from 9.30% to 10.52%.

**The two proportion guarantees overlap, so neither is provable on its own.**
That is written in the code beside them, because it is invisible from either
line by itself.

## Two defects that every test agreed with

Both are the same shape, and it is the shape hub LESSONS 7g is about: a check
written alongside its code inherits the author's framing.

**The conversion chains did not have to compose.** The generator picked links at
random and asked what came out, and the guarantee that was supposed to catch it
compared the chain's arrived unit against a `wantedUnit` READ OFF THE SAME RUN —
two expressions of one computation, agreeing with each other forever. It posed
*convert 522 mL into L·particles/g*: millilitres to litres, then a molar mass
applied to a volume. The chains are written out as compositions now, the target
unit is DECLARED, and the guarantee compares the arithmetic against the
declaration.

**A stage was graded against the wrong number, and nothing objected.** The stage
that asks a student to apply only the FIRST conversion in a chain was graded
against the value of the whole chain, in the first link's unit. Every test
stayed green, because `correctEntryFor` read the same field `classify` compared
against: the engine agreeing with itself about a number that was wrong. It was
caught by reading the harness's output — 3.975 kg printed as
`1.95407755102e25 g` — which is the argument for having a harness that prints a
session. `tools/verify-algebra.mjs` recomputes that intermediate by hand now;
planting the defect back makes it report 900 failures while `npm test` stays
entirely green.

## What `npm test` cannot tell you, and what does

`npm test` is thorough and self-referential in one specific way: it asks the
engine whether the engine agrees with itself. `solve()` produces the answer,
`correctEntryFor` writes it down, and `classify` accepts it — all three could
share one mistake and the suite would stay green.

`tools/verify-algebra.mjs` recomputes the algebra from OUTSIDE, and its
strongest check is not a recomputation at all: **it substitutes the app's answer
back INTO the relation and asks whether both sides balance.** That cannot share
a mistake with the solver, because it is not doing the same operation — a solver
that divides where it should multiply produces an answer that does not satisfy
the equation, whatever it believes about itself.

It also holds every conversion factor to a value typed in by hand from published
sources. That is the only check in the repository that can see a wrong molar
mass, because everything else derives from the same table the engine does.

**Planted red before it was believed**, and each plant aimed at a different
check: a molar mass moved by four, the solver multiplying where it divides,
a proportion answer scaled by one percent, the written answer claiming one
figure too many, and a chain link left upside down. All five fired. The last one
fired at the GENERATOR rather than at the verifier — the guarantee refuses to
pose a chain whose units do not cancel — which is the right place for it.

## Decisions worth keeping

**The type is the wall.** A `Problem` carries what a student is told and nothing
else: no answer, no intermediate, no prediction. `solve()` and everything in
`taxonomy.ts` are the grader's. A test walks the serialised problem looking for
any stage's value written to three, four, five or six figures, so the wall is
checked against the object a screen would actually be handed rather than against
the type declaration.

**A tiebreak in the classifier is now a gated rule rather than a paragraph.**
Changing `classify` to take the first of several matches broke nothing in the
suite, which meant the most important rule in the repository was prose. The
fixture is built by hand and is deliberately degenerate — an amount of 2 and a
rate of 4 make "write the answer upside down" and "never use the rate" both come
to 2 while the right answer is 0.5 — and the classifier is required to report
the collision rather than pick.

**One precision governs everything.** A first version read a student's entry at
the precision they wrote, floored at two figures, while judging CORRECTNESS at
the problem's own precision. Two readings of one entry, and the gap between them
is a misdiagnosis: an answer written to two figures in a four-figure problem
failed the correctness check at four and then matched a predicted mistake at
two, so a student who had the right value and rounded it badly would be told they
held a misconception they did not. Both are done at no less than the problem's
own precision now. The cost is a MISSED diagnosis rather than a wrong one, which
is the right way round.

**The right value written to the wrong number of figures is asked about FIRST,
and at the student's own precision.** The class exists for the case of too FEW
figures — writing 1.5 where 1.50 was asked — and judged at the required
precision that entry is simply not the correct value, so it fell through to the
predictions and came back as an arithmetic slip. Telling somebody their number
is right and their precision is not is both true and more useful.

**No text this file produces may contain a number that would be marked correct
at the stage it appears on.** The class meanings are constants with no
interpolation, and a test asserts none of them contains a digit. MoleBridge
shipped algebra help whose worked line ended in the value the student was stuck
on, and a one-figure magnitude estimate that the grader then accepted — because
no intermediate stage grades figures. Keeping these numberless is structural
rather than a thing to remember.

**There is no accommodation field on a session, and its absence is the point.**
Text size, letter and line spacing, one-step-at-a-time and read-aloud are
device-local preferences that never leave the device, so the thing that becomes
a completion code and a teacher's report has nowhere to put one. A code carrying
an accommodation would make a student disclose it by using it, over a channel
they cannot opt out of. Omitting it from the output would be a rule to remember;
having no field is a rule that holds. `steps.test.ts` walks the serialised
session and the serialised counts looking for one.

**A practice session cannot produce a completion code, and the refusal is a
function that throws.** Practice will show answers on request, so a practice
session that could produce a code would be the route to credit for work the app
did in front of you. A screen that must remember not to render a button is not a
wall.

**No date access outside an injected clock**, checked by reading the source
rather than by remembering it. Time ACCUMULATES across stretches, so a student
who stops for forty minutes does not have forty minutes added to what their
session reports — the label on that number is "how long you had it open", which
a break is exactly not, and a session showing two hours for twenty minutes of
work would make somebody who took a break look slow. That is reporting the
accommodation by another route.

**Every numeric tolerance is a named constant** in `src/engine/tolerance.ts`,
with the judgement behind it beside it. Never an inline literal.

**Node strips the TypeScript**, so the tree has no runtime dependencies and no
build step. `typescript` and `@types/node` are the only entries in
`devDependencies`, present to type check rather than to compile. That is the
strongest supply-chain position available and it matches the
no-third-party-runtime-dependencies constraint exactly rather than
approximately.

## What is NOT built, and it is most of the app

Named here so nobody has to discover it by looking:

- **No screen.** No student surface of any kind. `tools/cli.ts` prints answers
  and says so on every command that shows one.
- **No completion code.** `completionCounts` produces what a code would carry;
  there is no codec, no MAC and no readout yet. When there is one, the readout
  must DECODE the code the student is holding rather than describe it, so it
  cannot drift from the truth.
- **No teacher's page**, no resume, no accessibility work, no palette, no
  service worker, nothing deployed, and no repository metadata.
- **Nothing is deployed and no Pages project exists.** That is the owner's to
  create — see below.

## Waiting on the owner

- **The GitHub repository's description, topics, website and social preview**
  are GitHub-UI steps a session token cannot perform (Doctrine §10). Proposed
  values go in the hub's `METADATA.md`; never report this repository set up
  while a row there says proposed.
- **The Cloudflare Pages project and the default branch** are the owner's too.
  There is nothing to deploy yet, which is why no deploy workflow exists.
- **Whether the seven topics are the right seven** is the teacher's call. The
  list is closed until somebody with a classroom says otherwise.

## Obligations this repository still owes

- **The §7e baseline**, in full, when there is a screen: an ⓘ control in the
  app's own chrome, first-run orientation that survives whatever the reader
  presses to begin, patch notes from one source, a text diagnostic, and the
  stale-app offer. None of it applies yet and all of it is owed the moment a
  surface exists.
- **A palette**, measured by the hub's gate before anything is drawn.
- **An accessibility gate** covering every state in both modes, measured from
  resolved pixels, with the role invariant that reverse-maps every rendered
  colour to its token — copied from MoleBridge, which is where it earned its
  keep.
- **A browser walk** of the primary journey, getting one step wrong on purpose,
  dropping the network, and reloading the page for real.
