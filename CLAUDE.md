# CLAUDE.md — Solve-ent

> **Inherits the Universal App Doctrine.** The canonical copy lives in the hub
> repository at [`noahjefferson/DOCTRINE.md`](https://github.com/njefferson/noahjefferson/blob/main/DOCTRINE.md),
> alongside [`LESSONS.md`](https://github.com/njefferson/noahjefferson/blob/main/LESSONS.md),
> [`PALETTES.md`](https://github.com/njefferson/noahjefferson/blob/main/PALETTES.md)
> and [`SECURITY.md`](https://github.com/njefferson/noahjefferson/blob/main/SECURITY.md).
> It is the single source of truth for product values, taste, accessibility,
> honesty, verification, release discipline, licensing, privacy, the permanent
> **AskUserQuestion ban** (§0), and the **repo-metadata confirm rule** (§10).
> **Where anything below overlaps the Doctrine, the Doctrine wins.** Never fork
> it into this repository — link to it.

**Run this first, in the hub, at the start of any session here:**

```
node ../noahjefferson/doctrine-sync.mjs --repo . --adopt
```

## Read NOTES.md before changing anything

[`NOTES.md`](NOTES.md) is this repository's source of truth: the thesis, what is
built, what is deliberately NOT built, every judgement call and the reasoning
behind it, and the defects that every test agreed with until somebody read the
output. It exists because the reasoning behind a threshold is the first thing
lost.

## What this repository is

An algebra-skills trainer for one high school chemistry classroom, and a sibling
to **MoleBridge** — the same teacher, the same students, the same board at the
front of the room. Students arrive unable to do the algebra chemistry needs, not
because they are bad at maths but because nobody has shown them how the specific
moves work. This teaches exactly those moves and nothing else.

Static, no backend, no accounts, no cookies, no network calls at runtime.

**Attribution is the product. Do not build a solver.** Free tools already solve
these and already explain the procedure. What this adds is attributing a
specific wrong answer to a specific conceptual failure.

**State that claim carefully.** Research tutors have attributed wrong answers to
misconceptions since Brown and Burton's BUGGY in 1978, and `E-REARR-SIGN` is
that literature's canonical example almost word for word — it was re-derived
here, not invented. What is defensible is that the platforms a chemistry class
can buy diagnose at the TOPIC level, and that this one refuses to guess when two
misconceptions would produce answers a student could not tell apart. `NOTES.md`
has the full version, including the risk that follows from it.

## The rules specific to this repository

- **THE SCOPE IS CLOSED. Ask the teacher before adding a topic.** Seven:
  rearranging a formula, proportions and cross-multiplication, scientific
  notation, powers and roots, fractions and reciprocals, dimensional analysis,
  and significant figures. Every one has to be justifiable as *a student cannot
  do a stoichiometry problem without it*. This is not a general algebra course
  and must never grow into one.
- **A TAXONOMY COLLISION FAILS THE BUILD. NEVER ADD A TIEBREAK.** If two error
  classes predict something a student could not tell apart, the decomposition is
  wrong or the problem should not have been posed. A tiebreak means guessing
  which misconception somebody holds, and a guess reported to a teacher as a
  diagnosis is worse than saying nothing. Every fix so far has been a generation
  guarantee; `NOTES.md` lists them and what each was found by. **It is gated as
  well as written down** — `classify` is required to REPORT a collision rather
  than pick, against a hand-built degenerate fixture, because changing it to
  take the first match once broke nothing in the suite.
- **E-UNCLASSIFIED IS COUNTED AND REPORTED, NEVER SUPPRESSED.** It is the metric
  that says whether the taxonomy needs work. So is the ATTRIBUTION BLIND SPOT
  rate, which exists because the collision sweep is structurally unable to see a
  problem where every misconception lands on the correct answer.
- **NO STUDENT PII, EVER.** Identity is a teacher-assigned roster number from 1
  to 4095. Not a name, not an email, not a device id, not a class period that
  narrows to one person.
- **The correct answer is never shown before the student's attempt at that step.**
  `solve()`, `predictionsFor()` and `correctEntryFor()` are the grader's. A
  screen renders a `Problem`, which carries no answer and no intermediate, and
  that separation is the reason the type exists. **This does not stop applying
  when the delivery is audio** — reading a question aloud is reading the
  question, and a read-aloud that reached the answer would be the same
  disclosure through a different channel.
- **AN ACCOMMODATION IS A DEVICE-LOCAL PREFERENCE AND NEVER LEAVES THE DEVICE.**
  Text size, letter and line spacing, one-step-at-a-time and read-aloud belong
  in `localStorage` and nowhere else. **None of them may reach a completion
  code, a problem report, or a teacher's page.** A student's accommodations are
  disability information; a code carrying one would make a student disclose it
  by using it, over a channel they cannot opt out of. The app must never store
  or transmit WHICH accommodations a student has. There is no field for one on a
  `Session` and there must never be — omitting it from the output would be a
  rule to remember, and having no field is a rule that holds.
- **Speech synthesis is allowed; speech RECOGNITION is not.** They are one
  letter apart in the same corner of the platform, and recognition turns on a
  microphone. When there is a bundle, a permissions gate names the allowance and
  forbids the other by name.
- **NO SCORE, NO STREAK, NO TARGET, NO CONGRATULATION — and it is a gate.**
  Streaks and badges teach a student to chase the animation and make stopping
  feel like failing, which is exactly wrong for the person who most needs to do
  twenty of these. What replaces praise is CHANGE: say what happened, and say a
  repeated mistake stopped only where that is true. `tools/copy-check.mjs` runs
  on EVERY COMMIT through `.branch-guard` and refuses a streak, a badge, points,
  a fraction like 3/7 and every variant of "Great job" — because this is the
  rule a later session undoes in one well-meaning commit. It strips comments
  first, since the comments are where the words that must not be built are
  written down. `DrillOutcome` also has no field for a count and must never gain
  one.
- **THE CADENCE IS EXACT.** Once is not a pattern and is never named. Twice goes
  in the closing summary. Three times is said during the run, once, with what
  fixes it, and never again.
- **NOBODY IS ASSUMED TO BE IN A CLASSROOM.** Homeschoolers are a real audience
  and the structure already serves them; the words are the only thing that would
  exclude them. Same gate. What is banned is second-person address assuming a
  room — "your teacher", "hand it in", a named gradebook — never the word
  *teacher* on its own.
- **BLOCKED PRACTICE IS ITS OWN SCREEN, and it is owed early.** A whole problem
  is interleaved practice; a skill somebody does not have yet is built by doing
  the same move again. **Keep `classify` a pure function of (problem, stage,
  entry)** — not for testability, but because that purity is what makes a drill
  a loop around it with no session, no code and nothing recorded.
- **`tools/cli.ts` PRINTS ANSWERS and is not a student surface.** Nothing
  student-facing may ever call it.
- **Every numeric tolerance is a named constant** in `src/engine/tolerance.ts`,
  with the judgement behind it written beside it. Never an inline literal.
- **No date access outside an injected clock.** A test that cannot control the
  time cannot check anything that carries one, and `steps.test.ts` enforces it
  by reading the source.
- **No third-party runtime dependencies, and no network calls at runtime.** Node
  strips the TypeScript, so there is no bundler and no test framework — the type
  checker is the whole build.

## Running it

Node 22.18 or newer.

```
npm ci
npm run check
```

That is the strict type check, the release triplet, the words gate, the whole
test suite, and then `verify-algebra`, which recomputes the algebra from OUTSIDE
the engine.
`npm test` is thorough and self-referential in one way — it asks the engine
whether the engine agrees with itself — and `verify-algebra` is what answers
that. Its strongest check substitutes the app's answer back INTO the relation
and asks whether both sides balance, which cannot share a mistake with the
solver.

`npm run gates` runs the hub's shared gates. `README.md` has the harness.

## Branches

**Work commits to `staging`. `main` is production**, and will be the Cloudflare
Pages production branch once there is anything to deploy. Promotion is a merge;
a commit made directly on `main` needs `SOLVENT_PROMOTE=1` in front of it. The
harness's own `claude/*` branch is kept pointing at the same commit so nothing
is stranded on it.

**This is a hook, not a paragraph.** `.branch-guard` is the whole configuration
and the hub GENERATES `.githooks/pre-commit` from it — never edit that file:

```
node ../noahjefferson/branch-guard.mjs --repo . --install
```

`npm ci` runs the install through `prepare`, because a fresh clone has no
`.git/hooks` and the tracked copy is not the one git runs. `npm run branch`
fails on drift. **In CI it must be `--artefact`** — the plain check also asserts
that `.git/hooks/pre-commit` is installed, which is a fact about one clone that
a runner can never satisfy (hub LESSONS 107).

## Repo metadata (manual, confirm — Doctrine §10)

Description, website, topics and social preview are GitHub-UI steps a session
token cannot perform. Proposed values live in the hub's `METADATA.md`. Never
report this repository set up while a row there says proposed. The Cloudflare
Pages project and the default branch are the owner's too.
