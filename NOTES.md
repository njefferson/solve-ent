# NOTES.md — Solve-ent, source of truth

Read this first, every session. `README.md` is for someone using the
repository; this is for someone changing it.

## Thesis

Students arrive in chemistry unable to do the algebra chemistry needs. Not "bad
at maths" — they have never been shown how the specific moves work. This app
teaches exactly those moves and nothing else.

**Attribution is the product. Do not build a solver.** Free tools already solve
these and already explain the procedure. What this adds is attributing a
specific wrong answer to a specific conceptual failure. Every decision below
follows from that, and the one thing this must never become is a solver.

**AND THE CLAIM HAS TO BE STATED HONESTLY, because the first version of this
paragraph was not.** It read *what none of them do*, and that is false. Brown
and Burton's BUGGY did exactly this for subtraction in 1978, building a
catalogue of buggy procedures — the correct execution of an incorrect procedure
— from real student answer sheets. Algebra tutors have used mal-rules the same
way ever since, and Carnegie Learning's MATHia ships model tracing over a bug
library today. The uncomfortable specific: the canonical textbook example of a
buggy rule in that literature is *forgetting to change the sign when moving a
term across the equals sign*, which is `E-REARR-SIGN`, one of the twenty-nine
here, almost word for word. It was re-derived, not invented.

**What IS true, and is the defensible claim:** the platforms a chemistry
teacher can actually buy diagnose at the TOPIC level, not the misconception
level. Get a dilution wrong in ALEKS and it re-serves molarity and solution
prep — *you are shaky on this* rather than *you used the ratio upside down*. So
the sentence is not "nobody has thought of this". It is "the research solved it,
the products shipped something coarser, and this one refuses to guess when it
cannot tell".

**And the biggest open risk follows directly from that history.** BUGGY's
catalogue came from thousands of real student answer sheets. These
twenty-nine came from reasoning about what students do wrong — the same
reasoning that predicts their values. That is hub LESSONS 64 exactly, and the
collision sweep cannot see it: the sweep checks that the invented classes are
mutually distinguishable, never that they are the ones students actually hold.
The fix is cheap and somebody already has the material: run real marked work
through `classify` and read what comes back. An unclassified rate against real
answers that is far above the 10.16% this sweep reports would mean the taxonomy
is describing an imagination.

The audience is one classroom, and this is a sibling to MoleBridge: the same
teacher, the same students, the same board at the front of the room. Static, no
backend, no accounts, no cookies, and no student PII ever — identity is a
teacher-assigned roster number.

**The name is a chemistry pun on purpose: a solvent dissolves things, and this
app is about solving.** That sentence belongs in the About panel when there is
one, said once and never explained again.

## Where this stands

**Session 1 is complete. There is no user interface, on purpose.** The domain
engine, the error taxonomy, the step machine, the run reader and the test suite
are built and green: 70 tests, a clean strict type check with no `any` in the
tree, and no runtime dependencies at all.

**The two numbers session 1 exists to produce:**

- **Taxonomy collisions: 0**, over 10,500 generated problems and 72,992
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

## What the catalogue route found, on its first pass

The first validation route — read the published misconception literature and
compare — was run, and it found two things the collision sweep is structurally
incapable of finding. Both are about coverage rather than about correctness,
which is exactly what that route is for.

**The generator could not pose the hardest case in the significant-figures
topic.** Research reports the highest failure rate on questions that MIX an
addition with a multiplication: the sum's precision is limited by decimal
places, the product's by significant figures, and the two rules apply in that
order. The catalogued error is rounding on the fewest significant figures in
sight without ever asking what the intermediate sum was entitled to.

`SigfigsProblem.operation` read `'MULTIPLY' | 'ADD'`. **The TYPE forbade it**,
and no sweep over generated problems could ever have noticed: a sweep only sees
what the generator can make. Built in 0.3.0, with its own stage asking what the
sum is entitled to — a COUNT, never a value, because asking for the sum ROUNDED
would be demanding the intermediate be rounded, which is the mistake the topic
exists to teach against.

**And the app never asks anybody to GET a ratio, only to USE one.** Coefficient
and subscript confusion is a catalogued stoichiometry misconception and is
structurally out of reach here, because a proportion problem STATES the recipe
rather than asking a student to read it off a balanced equation. That is a
scope boundary rather than a missing class — but it is a real limit on what the
app can claim, and it was invisible until somebody read a list of misconceptions
next to the list of topics.

**Two classes came back confirmed.** E-SIG-WRONG-RULE and E-SIG-ROUND-EARLY both
appear in the literature as named, commonly-reported errors. That is positive
evidence for two of the twenty-nine, which is two more than the sweep can give.

### Three defects the mixed shape surfaced on its way in

Worth reading before adding another problem shape, because all three are the
shape of *a new case reaching code that was written when it did not exist*.

**A guarantee that starved the generator.** The first version required the sum's
figure count to DIFFER from the answer's, on the reasoning that otherwise the
two-step reading collapses to the one-step reading. Three problems in six
hundred survived it. They are different QUESTIONS that may share an answer, and
a guarantee that makes a case unreachable is not protecting anybody from
anything — it is deleting the case while appearing to keep it.

**The round-early prediction fell through to the wrong branch.**
`roundEarlyAnswer` tested `operation === 'MULTIPLY'` and treated everything else
as an addition, so a mixed problem was predicted to be the sum of all three
operands. It landed on the wrong-rule answer and surfaced as a taxonomy
collision. **A collision is evidence that something is wrong, not evidence about
WHICH thing** — the decomposition was fine and a prediction was simply wrong.

**And the collision sweep was running at the wrong precision, which predates all
of this.** `collisionsFor` read `problem.answerSigFigs`, which for the
significant-figures topic is a PLACEHOLDER — the real count is derived, and it is
what `classify` grades at. So the sweep checked pairs at four figures while a
real session graded at three, and a pair that collided in front of a student did
not collide in the sweep. One precision governs everything; that line was the
last exception.

## Validating the taxonomy without anybody handing over homework

**The twenty-nine classes came from reasoning about what students do wrong — the
same reasoning that predicts their values.** That is hub LESSONS 64, and the
collision sweep is structurally unable to see it: the sweep checks that the
invented classes are mutually distinguishable, never that they are the ones
students actually hold. It is the largest open risk in this repository.

**And the obvious fix is the wrong one.** Sending marked work anywhere — to a
model, to this repository, to a session — is exactly what this app is built not
to do. It has no field for a name and never will; a validation route that
depends on collecting student papers would undo the whole posture to check it.

Four routes that do not, in the order they should be tried:

- **Published misconception catalogues, no student data at all.** Chemistry
  education research has catalogued student misconceptions in the mole concept,
  stoichiometry, significant figures and dimensional analysis for decades. Read
  the catalogue and ask which of the twenty-nine appear in it, and — the more
  useful direction — which catalogued misconceptions have NO class here. That is
  a reading exercise, costs nothing, and is the only route that can find a
  MISSING class rather than confirming the ones present.
- **The Eedi misconception-labelled question set.** 1,857 K-12 mathematics
  questions, each with four expert-written multiple-choice options mapped to a
  named misconception; a larger benchmark carries roughly 21,000 real student
  responses with the answer chosen and the student's own explanation. Public,
  already de-identified, and the closest thing to ground truth that exists.
  **What it can and cannot say, stated before anyone runs it:** it overlaps this
  app on proportions, fractions and powers, and says nothing whatever about
  significant figures or unit cancellation in a chemistry context. A high
  agreement rate there is evidence about three topics, not seven.
- **The PSLC DataShop algebra sets, including the KDD Cup 2010 release.**
  Step-level interaction data from Cognitive Tutor algebra — one release is 575
  students and 813,661 interactions across 1,084 questions. It carries what
  students typed at each step, which is the shape `classify` eats. It is not
  misconception-labelled, so it can measure the UNCLASSIFIED RATE against real
  wrong answers without being able to say whether a diagnosis was right.
- **The local route, which is the one that answers the objection directly.**
  A validation harness that runs on the machine the marked work is already on,
  and returns a HISTOGRAM BY CLASS and an unclassified rate — no answers, no
  papers, no names, nothing transmitted. The answers never leave the device the
  same way an accommodation never does. Whoever ran it reads three numbers and
  can say them out loud without disclosing anything about anybody.

**The number to watch is the unclassified rate against real wrong answers.** The
sweep reports 10.16% against entries this repository generated. If real work
comes back far above that, the taxonomy is describing an imagination — and that
is a finding worth having early, while it is still cheap to change.

## The instructional model is one of several, and not the best-evidenced one

**This app teaches by attribution: name the misconception behind a specific
wrong number, and say what fixes it.** That is a real model with a long
research history, and it is not the one with the strongest evidence.

The honest numbers, because a plan built on an assumed effect is a plan:

- **Erroneous examples** — showing a worked wrong solution and asking what went
  wrong — carry a measured effect of about **g = 0.136** across a meta-analysis
  of 42 papers and 177 effect sizes. Statistically significant and weak.
- **Worked examples**, especially paired with self-explanation prompts, are the
  strongest thing in this family for novices, and stronger than problem-solving
  practice alone.
- **Contrasting cases** — two solution methods side by side, with the reader
  asked which is better and why — work with self-explanation rather than
  instead of it.
- And there is published work finding that buggy-message feedback does not
  always beat plain *wrong, try again*.

**SO THE TAXONOMY IS THE SUBSTRATE AND THE TEACHING STRATEGY IS A LAYER ABOVE
IT.** That is the architectural decision this section exists to record, and it
is what makes a change of model cheap rather than a rewrite. A class that
predicts the exact wrong value a misconception produces is the raw material for
every alternative above:

- an **erroneous example** is a worked solution that makes a predicted mistake —
  the engine already computes the value; it needs the working
- a **contrasting case** is the correct working beside that one
- **which worked example to show** is a choice the diagnosis already made
- a **self-explanation prompt** needs no taxonomy at all and is the cheapest
  thing on this list

Nothing above requires a different engine. It requires a different surface over
the same engine, which is why the engine must not grow a screen's assumptions.

### An app that fails to teach must not leave a reader concluding they cannot be taught

This is the constraint that outranks the model choice, and it has concrete
consequences rather than being a sentiment.

- **The app is never the last word.** Every dead end has a route out to
  something that is not another problem of the same kind.
- **When attribution fails, SAY SO.** E-UNCLASSIFIED means the app could not
  tell, and it is reported as the app's limit rather than as a verdict. The same
  goes for the 9.30% of stages that can attribute nothing: *this one I cannot
  read* is honest, and *you got it wrong* in its place is not.
- **After repeated failure on one skill, CHANGE WHAT THE APP IS DOING** rather
  than serving the next problem. The ladder, in order: attribute the mistake →
  show a worked example of that move → show the erroneous example and ask what
  went wrong → say plainly that this one is worth taking to a person. Serving
  problem N+1 after N failures is the app asserting that the reader is the
  variable.
- **The copy never locates the failure in the reader**, and that is now a gate
  rather than an intention. `tools/copy-check.mjs` refuses effort language,
  capacity language, and the words that tell somebody what they could not do was
  easy — "simply", "obviously", "of course". It is the mirror of the praise ban:
  praise and blame are both statements about a person where a statement about a
  move belongs. Bare "just" is deliberately NOT banned, because it usually means
  *only* and a gate with false positives on ordinary copy teaches people to word
  things around it.

**What would make us change model.** Written down now so it is a trip-wire
rather than a judgement call made under sunk cost: an unclassified rate against
real work far above the 10.16% this sweep reports, or readers stalling on the
same skill through repeated attributions. Either says attribution is not
carrying the load on its own, and the ladder above is what it hands off to.

## Blocked practice, and what the engine owes it

**A whole problem is interleaved practice, which makes a skill stick once you
have it. A skill you do not have yet is built by BLOCKED practice** — the same
move again until it is yours. An app with only whole problems makes the student
who inverts a ratio walk five steps they can already do to reach the one they
cannot. The single-skill drill is its own screen and it is owed early, not late.

**It costs almost nothing because the classifier is a pure function of
(problem, stage, entry).** A drill is a loop around that and `readRun`: no
session, no completion code, nothing recorded. That purity is a load-bearing
property now rather than a testing convenience, and `taxonomy.test.ts` holds it.

**One thing had to change to make that true.** `generateProblem` kept a
module-level map of which guarantee refused which candidate, and it grew
forever — 2.8 MB over two thousand problems. Diagnostic data, read by the sweep
immediately after generating, and utterly invisible until a loop runs the
generator thousands of times, which is precisely what a drill is. It is bounded
at `MAX_REPORTS` now and plateaus: four thousand problems cost 5.6 MB, and eight
thousand more added 0.2.

## What the app says about a run, and what it never says

**NO SCORE, NO STREAK, NO TARGET, NO CONGRATULATION.** Streaks and badges teach
a student to chase the animation and make stopping feel like failing, which is
exactly wrong for the person who most needs to do twenty of these — usually the
one who has been told longest that they are bad at it.

**What replaces praise is CHANGE.** A good tutor does not read out a fraction;
they say *that went upside down again, here is why*, and at the end *you were
getting these wrong the same way and now you are not*.

The cadence, exactly, in `src/report/drill.ts`:

- **Once** is not a pattern and is never named.
- **Twice** goes in the closing summary.
- **Three times** is said during the run, once, with what fixes it, and never
  again.

**The change sentence is said only where it is true**, and "true" needed a
threshold rather than a condition buried in an `if`. `STOPPED_AFTER_CLEAN` is 2:
one clean attempt after a run of wrong ones is as likely to be a guess as a
change, and telling somebody they have stopped doing something is a claim about
a person that has to be earned. Clean attempts at a DIFFERENT skill earn
nothing — the claim is about one move.

**E-ARITH and E-UNCLASSIFIED are never called patterns.** One is a slip with the
right method and the other means the app could not tell; telling somebody they
keep making a mistake nobody identified is telling them nothing they can act on.

**The all-wrong case is a branch written by hand.** The general sentence renders
it as *four of them, and none right* — accurate, and the exact reading that
person does not need. That branch carries no number at all, and a test asserts
it: `!/\d/.test(text)`. Assume every generated sentence has a degenerate case
and go looking for it.

**Two gates hold this, and they cover different halves.** `DrillOutcome` has no
field for a count, a total or a score and must never gain one — the same
argument as the missing accommodation field on a `Session`, and the reason it is
a type rather than a rule to remember. And `tools/copy-check.mjs` covers the
WORDS: streak, badge, points, a fraction like 3/7, every variant of "Great job",
and copy addressed to a reader assumed to be in a classroom. **It runs on every
commit** through `.branch-guard`, because this is the rule a later session undoes
in one well-meaning commit — a streak counter is an afternoon's work and feels
like kindness.

**Comments are stripped before matching, and that is load-bearing.** The
comments are exactly where the words that must NOT be built are written down —
this repository's own drill module has four paragraphs of them. A gate that read
comments would fail on the prose explaining the rule, which teaches people to
word things around it. Planted four ways: a streak counter, a fraction, copy
assuming a teacher, and the same words inside a comment, which correctly did NOT
fire.

## Nobody is assumed to be in a classroom

Homeschoolers are a real audience and the structure already serves them; the
WORDS are the only thing that would have excluded them. So the neutral version
is written from the start rather than retrofitted — same code, same features, no
second mode.

**What is banned is second-person ADDRESS assuming a room** — "your teacher",
"ask your teacher", "hand it in", a named gradebook or learning-management
system. Not the word *teacher* on its own: this repository is built for one, the
documentation says so, and a rule firing on that would push people into writing
around it.

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

## A third defect every test agreed with

**A choice question graded the FIRST option correct when the grader did not
recognise the stage.** `optionsFor` was a hand-typed map from (topic, stage id)
to a builder, with a fallback returning an empty set — so a stage whose id it
did not know reported `correct: 0` with zero predictions, while the screen
showed the real options. On a rearrangement problem, option 0 is the
upside-down answer.

Nothing failed, because `correctEntryFor` submitted option 0 and `classify`
compared against the same broken lookup: the engine agreeing with itself about a
wrong answer, which is the third time that exact shape has appeared here.

The fix is DERIVATION rather than a bigger map. Options are keyed on the TOPIC
alone — a topic has at most one choice stage, so there is no id to get wrong —
and `taxonomy.test.ts` asserts that "at most one" holds, because it is the
assumption the keying rests on.

**And the first test written for it could not have caught it.** Asserting that
the two readers agree today is satisfied by every stage in the tree, since every
id is one the old map already knew; re-planting the map changed nothing. The
check that goes red exercises the failure mode directly — a choice stage
carrying an id nothing recognises — and it does.

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

## The what's-new surface, and the contract it has to keep

**Half of this is built and the visible half is not.** The words exist, bounded
and generated from one source; the panel that shows them and the page it opens
do not, because there is no screen at all. That is stated here in full so
session 2 builds the agreed thing rather than re-deciding it.

**The words half, built in 0.4.0.** `CHANGELOG.md` is the source and
`tools/changelog.mjs` writes `src/report/releases.ts` from it. Nothing is typed
twice, and `tools/notes-check.mjs` runs the drift check on EVERY commit through
`.branch-guard` — because a generated artefact in the tree is a generated
artefact that goes stale in the tree, and a what's-new panel one release behind
is a panel telling somebody about a change they do not have.

**Bounded at five: the current release and four before it.** A list that grows
by accumulation eventually becomes longer than the app. `OLDER_THAN_SHOWN` is
carried so the panel can say how many it is NOT showing, rather than implying
five is all there has ever been. The generator also REFUSES a release with no
"still missing" line (Doctrine §7d) — checked rather than remembered, because
the release somebody is proudest of is the release it gets left off.

**`NOTES_PAGE` is `/whats-new`, a path in this app.** Never a link off to a code
host. Somebody who wants to know what changed in a maths trainer should not land
in a repository, and a test asserts the VALUE rather than trusting the comment,
because that is the line somebody edits when a page is slow to build and a link
to the source feels like a reasonable stopgap.

**The visible half, owed the moment there is a screen:**

- **Shown once per release, never twice.** The trigger is the stored version
  differing from `VERSION`, and the stored version is written when the panel is
  DISMISSED rather than when it is shown — a panel closed by a reload is a panel
  nobody read.
- **Never to a first-time visitor.** No stored version at all means a newcomer,
  and a newcomer has nothing to catch up on. Write the current version and show
  nothing. A what's-new panel is the second-worst possible first screen, after
  a panel of what they have missed by never having been here.
- **It is a device-local preference and it never leaves the device.**
  `localStorage`, like every accommodation. It reaches no completion code and no
  teacher's page.
- **Closeable, and closing it means closed** (Doctrine §4) — a real control with
  a real target size, not a corner glyph, and Escape as well when there is a
  keyboard.
- **It never interrupts a run.** Between problems or on the way in, never over a
  question somebody is part-way through answering.
- **The link opens `/whats-new` inside the app.** Same-document navigation, so
  it needs the `hashchange` listener the opener path needs — see the warm-up
  link trap below.
- **It must join the accessibility gate's surface list in the SAME commit** that
  builds it, or it ships unmeasured. That is hub LESSONS §28 and it has cost a
  release before.

## A gate that bans a word cannot scan the copy that says the word is absent

`src/report/releases.ts` is generated reader-facing copy that lives under
`src/`, so `tools/copy-check.mjs` scanned it like any other source file the
moment it existed. **It failed** — on the 0.2.0 note, whose whole job is to tell
a reader this app has no streaks.

The two lines it caught are the product keeping its promise, said out loud to
the person the promise is to. There is no wording around it: the only way past
the gate is to stop saying it, which would make the note worse in exact
proportion to how well the gate was working.

So the artefact is held to rule four — the release-notes rule — and not to rules
one to three. That is the rule that actually applies to it. Rules one to three
are about copy addressed to somebody about their own work; praise, blame and an
assumed classroom are register errors in a sentence spoken TO a student mid-run.
A release note is about the app, and describing an absence requires naming it.

**Deliberately not a whole-file exemption**, because a whole-file exemption is
where material collects — that is the hub privacy gate's own history, where
green meant *not looked at*. The file is scanned in the same run, by its STRING
LITERALS only (its generated header names a filename twice and none of that
reaches a reader), and the line saying which rules it was held to is printed.

## The hub commit is written in two files, and they drifted on the commit that adopted the lesson about drifting

`.doctrine-sync` records the hub commit this repository has RECONCILED with, and
`HUB_SHA` in the gates workflow is the commit CI checks the hub out at to run the
shared gates. **They are the same fact.** A pin left behind means CI runs the
hub's privacy, quote and no-grid gates from before the rules this repository has
already read: every gate green, the new rule enforced nowhere, and the marker
asserting it was read and applied.

It happened here on the commit that adopted hub LESSONS §146 — the marker moved,
the pin did not, and it was found by grepping the workflow on the way to
something else rather than by anything that would find it next time. That is
§117 recurring, having been enforced by CHECKLIST since it was written.

`tools/hub-pin-check.mjs` refuses a commit where the two disagree in EITHER
direction. Behind is CI enforcing stale rules; ahead is CI enforcing rules this
repository has not reconciled with. Both have the same fix: read the drift, then
move them together. An abbreviated pin or a branch name fails loudly rather than
reading as absent, and a missing file is a failure and never a skip.

**It is repo-local rather than a hub gate, and that is deliberate.** The hub's
shared gates take `--repo .` precisely so divergent copies cannot exist. This one
cannot: CI fetches the hub AT that pin, so a shared gate validating the pin would
be fetched at the very commit it is checking — a pin left behind far enough
checks out a hub without the file, and the step fails with a missing module
rather than a diagnosis. It reads only files in this repository and needs the hub
for nothing, which is also why it can be a commit hook without making a commit
depend on the hub being checked out.

It was never planted. It went red twice on real drift, unprompted — once on the
§146 adopt and again on the §117 adopt an hour later.

## Session 2: there is a screen, and what it cost to put one there

**The engine had no browser problem until it had a browser.** Everything below
is a decision that was not obvious, with what it was traded against.

### A browser cannot run TypeScript, and the rule said no bundler

"No build step beyond the type checker" was written when there was no screen and
Node strips the types by itself. A browser does not. A second copy of the engine
written in JavaScript would fork the one thing in this repository that must
never have two versions.

So the types are erased for the browser and **erasure is all that happens**.
`erasableSyntaxOnly` in the base config is what makes that checkable rather than
hopeful: it refuses any TypeScript whose meaning is not purely annotation, so
removing the types is a deletion and never a transform. One file in, one file
out, same name, same imports, same order, same target, comments intact. No
module graph is flattened, nothing is minified, no dependency is resolved into
the output, and nothing was added to the dependency list — the type checker was
already here.

**The output is COMMITTED rather than built at deploy time**, and that is the
part worth arguing with later. `public/` is the site, in this repository and in
every sibling. Building at deploy would mean the deployed directory does not
exist in the tree and a Pages project that needs a build command set correctly
by hand — a new way for a release to silently not arrive, which is hub LESSONS
§53 and cost four releases elsewhere. The cost of committing it is staleness,
and staleness is what a gate is for: `tools/web-build.mjs --check` runs on every
commit and refuses a stale module, a missing one, or an orphan left behind by a
rename.

### The engine cannot reach the DOM, and that is the build rather than a habit

`tsconfig.json` has `lib: es2023` and no DOM at all, and excludes `src/ui/`.
`tsconfig.web.json` adds the DOM and covers everything. An engine file that
reached for `document`, `localStorage` or `window` does not type-check — planted
and watched failing.

**And that split immediately produced its own defect, which is the better half
of the story.** `exclude` is INHERITED THROUGH `extends`. The base config's
exclusion of `src/ui/` therefore applied to the web config as well, so the
entire browser layer was checked by NEITHER project. Both `tsc --noEmit` runs
exited 0. The screen had two real type errors in it — a wrong field name and a
property that does not exist — and it was found by asking `--listFilesOnly` how
many files had actually been looked at, on a hunch that a screen written in one
pass had no business compiling first time.

`tools/coverage-check.mjs` now refuses a tree where any source file is in no
project, and refuses a project that loads nothing at all. **A file in no project
is not a file that passed**, and the two states are identical from the outside.

### The palette: adopted, not invented, and declared once

Instrument, the hub's recommended default — the only one of the four families
whose worst text pairing is at or above 4.87 across all four of its palettes,
with primary text AAA on every fill and an exact-neutral night chrome. No
picker: one family, so palette and mode stay independent axes with only the mode
axis populated.

`palettes/solve-ent.json` is the ONE source. The hub's `palette-check.mjs`
measures that file; `tools/palette.mjs` writes `public/css/tokens.css` from the
same file. So the values that were measured and the values a browser paints
cannot be different values — a property rather than a promise. PALETTES.md §6
says consolidate before there is more than one of anything, and having no screen
yet was the cheapest possible moment to do it.

**Four cascade blocks, not two**, and the fourth is the one that gets dropped:
a default outside every query, the system asking for light with nothing stored,
an explicit day beating a system set to dark, and an explicit night beating a
system set to light.

**The generator's check printed a claim it did not measure.** It said "day
arrives three ways, and night beats a system set to light" as an `ok` line while
the explicit-night block had been deleted from the generator during a plant —
because a drift check regenerates from the same generator and compares like with
like, so it is structurally incapable of catching a wrong GENERATOR. The four
cases are now read off the generated text, where a generator that stops emitting
one of them fails.

### The accessibility gate, and the three ways it lied before it worked

`tools/a11y.mjs`: eight states by two modes, both dialogs opened rather than
skipped, axe-core plus the checks axe cannot make. The surface list is
**asserted** against every `[data-surface]` in the document, so a new screen that
does not join it fails rather than shipping unmeasured (hub LESSONS §28).

`work-diagnosed` is its own state on purpose. The diagnosis panel is the thing
this app exists to show and it is only ever on screen after a wrong step, which
a resting sweep never produces.

**Contrast is enumerated, not sampled.** The body is a gradient between two
known tokens, so text over it is checked against BOTH stops and the worse
reading counts. Interpolation in sRGB stays between the endpoints channel by
channel, so bounding the ends bounds every position — which is more than a
sampled pixel can say, and it sidesteps the computed-style trap entirely rather
than working around it.

Three instrument defects, all found by results that looked absurd:

- **Hex against rgb.** A custom property comes back from `getComputedStyle` as
  AUTHORED (`#f4ecdd`); the colour that reached the screen comes back RESOLVED
  (`rgb(244, 236, 221)`). The digit regex over `#f4ecdd` returns `[4, 44]`, and
  the gate reported that every surface in the day palette mapped to no token.
- **`.22` against `0.22`.** The hairline exemption compared border colours as
  strings, so every decorative fieldset border was measured as a load-bearing
  rail and failed at 1.54. This is PALETTES.md §7's string-comparison trap
  wearing a second coat; everything compares numbers now.
- **A false exemption.** The inline-in-a-sentence exemption asked only whether
  the parent held other text, which let off a link sitting in a header beside
  the wordmark — a real 44px target being quietly excused. An exemption that
  fires where it should not reads exactly like a measurement.

And **the panel was over everything it was trying to measure**: seeding "already
seen" with a placeholder string means "seen an OLDER version", which is the
condition that opens the what's-new panel. Every click timed out against its
backdrop. A placeholder is not a neutral value when the thing stored is compared
for equality.

Four real defects survived the triage and were fixed: no level-one heading on
any page, a 138x20 link target, a static `theme-color` on the release-notes page
that was wrong in day mode, and the false exemption above.

### The walk, and the two times the harness was wrong about the app

`tools/walk.mjs` walks the primary journey: arrive, begin, get a step wrong on
purpose, be told what happened, finish, reload, drop the network.

**A wrong step does not advance, so a harness that keeps guessing never
finishes.** The first version guessed four hundred times and reported that the
run does not end. The app was right. The correct entries are now computed in
Node from a session built with the same key, topic, tier and count — the
problems are a pure function of those, so the two runs are step for step the
same. That is a stronger check than finishing was: it says the browser's session
and an independent one agree at every stage. Nothing student-facing does this;
the screen is never told the answer, which is exactly why the harness has to
work it out separately instead of reading it off the page.

**And an init script undid what it was measuring.** Storage seeded through
`addInitScript` runs on every load in that context INCLUDING the reload, so the
walk re-seeded the old version on the way back in and then reported that
dismissing the what's-new panel does not stick.

The offline line is deliberately an assertion that it does NOT work: there is no
service worker yet, and that line is how the absence stays known rather than
being rediscovered.

### The diagnosis had to be framed, and the frame is where the rule lives

`CLASS_MEANINGS` are fragments — "used the ratio the wrong way up" — because the
engine has no business deciding how a screen frames them. Rendered raw they
arrived as a bold lowercase clause with no subject, which reads like an
accusation with the accusing part cut off. The first screenshot showed exactly
that.

**The subject is THE ANSWER.** "That answer used the ratio the wrong way up" is
a statement about a move; "you used the ratio the wrong way up" is a statement
about a person, and this app does not make those. The frame is where that
distinction actually gets made, so it lives in the screen rather than being left
to whoever writes the next surface.

### §146 happened four more times in one sitting

The lesson written this session — a gate that bans a word cannot scan the copy
that exists to say the word is absent — recurred four times after being written:

- the release notes, which is where it came from;
- a test asserting a session has no accommodation field, which failed on the
  header sentence naming the fields it must never have;
- the §7f diagnostic, whose `maxTouchPoints` line matched the ban on *points* —
  and that property is the one thing that tells an iPad from a Mac, since iPadOS
  Safari reports itself as macOS, so the doctrine effectively requires the line;
- the walk, whose assertion that praise is absent has to spell the praise out.

Two structural fixes rather than four exemptions. `tools/copy-check.mjs` now
strips **regex literals** as well as comments — a pattern is not copy, nothing
inside `/…/` is ever shown to anybody, and the same file's plain strings are
still read, so a harness that actually printed praise is still caught. And the
*points* rule now matches points-as-a-reward rather than the bare word. The
stripper is conservative about what counts as a regex, because `/` is also
division and a stripper that guessed wrong would silently delete real copy;
anything ambiguous stays in and is therefore still scanned.

### One more the type checker caught that nothing else could

`OLDER_THAN_SHOWN` was generated as a bare literal, so its type was the exact
number it happened to be. The screen's branch on it was a comparison between two
literals — which type-checks while the count is one value and fails the day it
changes. It failed on 0.5.0, the first release that made it non-zero, which is
also the first release on which that branch had ever been reachable. It is
annotated `number` now.

### Two things the screenshots said that no gate did

Both were found by looking at a rendered page, which is the one thing none of
the gates above can do.

**The diagnosis was a fragment**, which is written up in full below — it is the
reason the framing lives in the screen rather than in the engine.

**The Start button is below the fold on a phone.** The orientation runs four
paragraphs and an aside, so on a 390-wide viewport a reader scrolls about a
third of a screen to reach the control. That is ordinary for an orientation and
it is not the unreachable-control failure — the button is reached by the same
gesture everything else on the page is reached by. It is recorded because the
next person to add a paragraph there should know what it costs, and because
"scroll a bit" and "4.9 screens down" are the same shape at different sizes,
and the second one shipped in a sibling app for 142 releases.

## Session 3: offline, and the update that waits

Doctrine §7h, which is the one item of the §7e baseline that had been named as
owed since there was a screen. The failure it prevents is invisible by
construction: caching IS the business of not asking the network, so a stale app
looks perfectly fine. It is just old. There is no error, no symptom, and the
version on screen is the old code reporting itself perfectly accurately.
**Nobody finds this by using the app.**

### The worker and the manifest are GENERATED, and the precache list is read off the tree

Two things in a service worker must move with the release and are exactly what a
hand-edited file gets wrong. The **cache name**: if it does not change, a new
release reuses the old cache and can never replace what is in it (hub LESSONS
§21). The **precache list**: written by hand it goes stale the first time a
module is added, and the symptom is a file that silently is not there offline.
Both come out of `tools/pwa.mjs` now, drift-checked on every commit.

**The generator was briefly a fixed-point search.** It writes the manifest, and
it read the manifest back off the tree as part of the list — so the first run
produced a list without it and the second produced a list with it, and the drift
check failed until it had been run twice. The manifest is added by NAME instead,
which is true whether or not it exists yet. A generator whose output is part of
its own input is not a generator.

### A first install is not an update, and it took two attempts to say that right

`activate` calls `clients.claim()` so the worker starts serving the page it was
registered from — and **claiming fires `controllerchange` exactly as a
replacement does**. The first version reloaded on any `controllerchange`, so
every first-time visitor got a reload they did not ask for, on the visit where
they had just arrived. It was caught by the accessibility gate, whose page
navigated out from under it mid-measure. A reader would have seen a flash and
thought nothing of it, which is worse.

The first fix was worse than the defect and is worth recording. It captured
`hadController` once at boot and refused to offer an update unless it was true —
correct for the first paint and **wrong forever after**, because a page that
arrived as a newcomer could then never be offered an update however long it
stayed open. The real signal is not `controller` at boot but whether the
registration has an ACTIVE worker at the moment a new one installs: a waiting
worker beside an active one is an update, a waiting worker with no active one is
a first install.

The reload guard needs both halves. `expectingSwap` is this reader pressing the
control. `hadController` covers the other tab — somebody takes the update
elsewhere, that worker claims every client, and this page is now old markup being
served new modules, which is the §7h.1 hazard arriving sideways.

### The hub's gate says itself that it cannot prove this works

It reads source text and catches NEVER IMPLEMENTED, not implemented-subtly-wrong.
It passed on the very first attempt, with the newcomer-reload defect live.

So `tools/update-walk.mjs` serves release A, installs it, then serves a
genuinely different release B from the SAME origin — which is what a deploy
looks like from the browser's side — and walks what a reader experiences: a
first visit not reloaded and not told, the app opening with the network gone,
a returning reader told in words, the open page still on the release it started
on, "Not now" leaving them alone, and the control bringing the new version in
with the old cache deleted. Nineteen steps.

**It crashed rather than diagnosing, the first time it was planted.** With
`skipWaiting()` back in install the strip never appears, and the walk went
straight on and died in a click timeout: thirty lines of stack trace, a non-zero
exit, and not one word about what was wrong. The steps that depend on the strip
are guarded now, and the failure names the likeliest cause — which on this gate
is precisely a worker that took over during install.

### What the update strip is, and is not

A standing indicator under the bar that pushes the page down, never a dialog.
Somebody part-way through a question is not interrupted and has nothing to
dismiss before answering, and reloading mid-run would lose the run. It is a
`[data-surface]` so the accessibility gate walks it, but it is deliberately NOT
one of the mutually exclusive screens — hiding it on the next screen change
would mean the app noticed a new version, said so, and then quietly took the
words away.

## What is NOT built, and it is most of the app

Named here so nobody has to discover it by looking:

- **A real icon.** The manifest points at two hand-drawn SVGs using the
  palette's own night page and accent. They are honest placeholders, and an icon
  is the one surface the accessibility gate cannot reach, which is why they take
  their colours from the palette file rather than from taste.
- **No single-skill drill screen.** The engine half is built and `classify` is
  pure, which is what makes the drill a loop around it with no session and
  nothing recorded. The screen is not built, and it is the thing most worth
  having when one particular move is the one going wrong.
- **One difficulty.** Every run opens at tier 1; nothing chooses or moves
  between the three the generator supports.
- **No assignment key on screen**, so nothing can be handed in and there is no
  page for whoever set the work. `completionCounts` produces what a code would
  carry and refuses to do it in practice mode, which is the only mode a screen
  can currently start.
- **`tools/cli.ts` prints answers** and says so on every command that shows one.
- **No completion code.** `completionCounts` produces what a code would carry;
  there is no codec, no MAC and no readout yet. When there is one, the readout
  must DECODE the code the student is holding rather than describe it, so it
  cannot drift from the truth.
- **No teacher's page**, no resume, nothing deployed, and no repository
  metadata.
- **Nothing is deployed and no Pages project exists.** That is the owner's to
  create — see below.

## The first CI run, read rather than trusted

`gates.yml` went green on `staging` at `8221a6b` in **twenty-one seconds**,
which is faster than the same work takes in a session sandbox and is therefore
the shape of a run that skipped something. Its log was read rather than its tick:
49 tests in 2,031 ms, the verifier's four counts printed in full — 1,200
rearranged answers substituted back into their relations, 5,400 recomputed by
hand, 2,520 written answers checked against the figures they claim — and zizmor
v1.29.0 completing `.github/workflows/gates.yml` under `--strict-collection`.
Every step ran. The runner is simply quicker.

Worth keeping because the alternative reading was available and would have been
wrong in the comfortable direction: a green tick on a suspiciously fast run is
exactly what a workflow looks like when a glob matched nothing.

**Dependabot opened two pull requests within a minute of the first push** —
TypeScript 5.9.3 to 7.0.2 and `@types/node` 22.19.4 to 26.2.0 — and both are
green. Neither is merged. MoleBridge already pins TypeScript 7.0.2, so the
family standard is the newer one; whether to take a major bump is the owner's
call and not a session's.

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
- **A palette**, measured by the hub's gate before anything is drawn, and the
  hub's `PALETTES.md` recipe followed rather than improvised. Three things from
  it are worth deciding EARLY, because they are cheap now and expensive later:
  the token declarations must be consolidated to ONE source before any second
  palette exists, or adding families multiplies the blocks that must never
  drift; palette and mode are INDEPENDENT axes, so the day/night toggle stays
  as it is and a `data-palette` attribute sits beside it; and the picker labels
  each option by NAME, because a swatch alone is colour as the sole carrier.
  **Instrument is the recommended default family** — the only one whose worst
  text pairing clears 4.87 across all four palettes.
- **An accessibility gate** covering every state in both modes, measured from
  resolved pixels, with the role invariant that reverse-maps every rendered
  colour to its token — copied from MoleBridge, which is where it earned its
  keep.
- **A browser walk** of the primary journey, getting one step wrong on purpose,
  dropping the network, and reloading the page for real.
- **The validation pass against real wrong answers**, by one of the three
  remaining routes. Nothing about it requires anybody to send work anywhere.
  The catalogue route has been run once and is written up above; it should be
  run again whenever a topic changes, because it is the only route that can find
  a case the generator cannot pose.
- **The single-skill drill, as its own screen, EARLY.** The engine half is
  built; the screen is not. See *Blocked practice* above.
- **A five-minute opener path before an elaborate one.** The classroom feedback
  on the sibling app was not about practice or reports — it was that a short
  opener at the start of a lesson is what would actually get used. A link that
  goes straight into two short problems, no menu, no setup.
  **And the trap that comes with it: a hash-only URL change is same-document**,
  so a link like that does nothing in an already-open tab unless something
  listens for `hashchange`. That is a silent failure — the link looks fine and
  the page simply does not move.
- **Two walk traps to avoid rather than discover.** Scope every count in a
  browser walk to its own screen: an unscoped row count went from 8 to 16 in the
  sibling app the moment a second screen used the same class. And any map from a
  content id to a step must be DERIVED from the id rather than typed by hand,
  with the deliberate exclusions named in a test — the hand-typed version of
  exactly that shape is what silently graded the first option correct here.
