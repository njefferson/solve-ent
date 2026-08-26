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
- **NEVER TELL A READER THE FAULT IS IN THEM — same gate.** An app that fails
  to teach must not leave a kid concluding they cannot be taught. No effort
  language, no capacity language, and none of the words that tell somebody what
  they could not do was easy. This is the mirror of the praise ban: praise and
  blame are both statements about a person where a statement about a move
  belongs. And when attribution fails, SAY SO — E-UNCLASSIFIED is the app's
  limit, never a verdict.
- **ATTRIBUTION IS ONE INSTRUCTIONAL MODEL AND NOT THE BEST-EVIDENCED ONE.** The
  taxonomy is the substrate; the teaching strategy is a layer above it, and it
  has to stay swappable. After repeated failure on one skill the app changes
  what it is doing rather than serving the next problem — `NOTES.md` has the
  ladder and the trip-wire that would say the model is not carrying the load.
- **THE WHAT'S-NEW LIST IS BOUNDED AT FIVE AND OPENS A PAGE IN THIS APP.** The
  current release and four before it, generated from `CHANGELOG.md` by
  `tools/changelog.mjs` — one source, drift-checked on every commit through
  `.branch-guard`. A list that grows by accumulation eventually becomes longer
  than the app, so `OLDER_THAN_SHOWN` is carried and the panel says how many it
  is not showing. `NOTES_PAGE` is a path in this app and **never a code host**;
  somebody who wants to know what changed in a maths trainer should not land in
  a repository. When there is a screen, the panel shows once per release, never
  to a first-time visitor, stores nothing but a version and stores it
  device-locally, and never interrupts a run. `NOTES.md` has the full contract.
- **A GATE THAT BANS A WORD CANNOT SCAN THE COPY THAT SAYS THE WORD IS ABSENT.**
  `src/report/releases.ts` is reader-facing copy under `src/`, and the words
  gate failed on the note whose job is to say this app has no streaks. It is
  held to the release-notes rule and not to the praise, blame and classroom
  rules — those are about a sentence spoken TO a student about their own work,
  and a release note is about the app. It is still SCANNED, by its string
  literals, and the run prints which rules it was held to; a whole-file
  exemption is where material collects.
- **RELEASE NOTES ARE FOR HOMESCHOOL TEACHERS AND STUDENTS, as the core
  audience.** Not for programmers, not for whoever wrote the commit. If a
  release changed something a reader can see or do, describe it in the words
  they would use; if it changed something under the surface, say that plainly
  rather than dressing it up. A note naming a function, a type, a file or a gate
  is a note written for the wrong person. `CHANGELOG.md` also says what is still
  missing, every release, because a list of only fixes is an advertisement
  (Doctrine §7d).
- **THE CADENCE IS EXACT.** Once is not a pattern and is never named. Twice goes
  in the closing summary. Three times is said during the run, once, with what
  fixes it, and never again.
- **NOBODY IS ASSUMED TO BE IN A CLASSROOM.** Homeschoolers are a real audience
  and the structure already serves them; the words are the only thing that would
  exclude them. Same gate. What is banned is second-person address assuming a
  room — "your teacher", "hand it in", a named gradebook — never the word
  *teacher* on its own.
- **EVERY SYMBOL A QUESTION NAMES IS IN THE EQUATION IT SHOWS.** Keys are
  identifiers and what a reader sees is not — `T(K)`, `V₁`, `ΔT` — so
  `SymbolInfo.shown` carries the display form and everything reader-facing goes
  through `shownSymbol`. Three relations asked for letters that were not in
  their own equations for six releases with every gate green. And a
  rearrangement option can only be read ONE way: brackets on a divisor of more
  than one factor, nowhere else, because an option a reader cannot parse
  attributes nothing and attribution is the product.
- **DIFFICULTY IS DECLARED PER TOPIC, AND A DIFFICULTY THAT POSES WHAT THE ONE
  BELOW IT POSES FAILS THE BUILD.** This is the collision rule one level out: a
  control that does nothing is worse than a control that is missing, because its
  presence answers "is difficulty handled here" for everybody afterwards.
  `TIERS` was `[1, 2, 3]` for eleven releases and every screen opened at the
  first one, so nothing had ever posed the other two — and when `tiers.test.ts`
  measured all fourteen steps, six of them changed nothing a reader could tell.
  `LADDERS` says what each topic has; `generateProblem` REFUSES a tier a topic
  does not declare rather than clamping to one that exists. **Never add a
  difficulty to make a topic look symmetrical** — five have three, fractions has
  two, proportions has one, and the step that would make proportions two is a
  second reaction in sequence, which is a question shape to ask the teacher for.
  Difficulties are NAMED rather than numbered and the name describes the
  QUESTION: "Four steps", not "Hard". Nothing is locked, and nothing promotes or
  demotes itself — a difficulty that arrives because of how the last run went is
  a verdict on the reader delivered as a feature.
- **BLOCKED PRACTICE IS ITS OWN SCREEN, and it is owed early.** A whole problem
  is interleaved practice; a skill somebody does not have yet is built by doing
  the same move again. **Keep `classify` a pure function of (problem, solution,
  stage, entry)** with `solve` itself pure — not for testability, but because
  that composition is what makes a drill a loop around it with no session, no
  code and nothing recorded. `src/engine/blocked.ts` is the whole of it.
- **`tools/cli.ts` PRINTS ANSWERS and is not a student surface.** Nothing
  student-facing may ever call it.
- **Every numeric tolerance is a named constant** in `src/engine/tolerance.ts`,
  with the judgement behind it written beside it. Never an inline literal.
- **No date access outside an injected clock.** A test that cannot control the
  time cannot check anything that carries one, and `steps.test.ts` enforces it
  by reading the source.
- **THE DOCTRINE MARKER AND THE CI HUB PIN MOVE TOGETHER.** `.doctrine-sync` and
  `HUB_SHA` in the gates workflow are the same commit written twice; a pin left
  behind means CI runs the hub's shared gates from before the rules this
  repository has already adopted — every gate green, the new rule enforced
  nowhere. `tools/hub-pin-check.mjs` refuses a commit where they disagree, in
  either direction, and runs on every commit through `.branch-guard`. It is
  repo-local rather than a hub gate on purpose: CI fetches the hub AT that pin,
  so a shared gate validating the pin would be fetched at the commit it is
  checking. Hub LESSONS §117.
- **THE BROWSER GETS TYPE ERASURE AND NOTHING ELSE.** A browser cannot run
  TypeScript and a second copy of the engine would fork the one thing here that
  must never have two versions, so `tsconfig.web.json` emits `public/app/` and
  `erasableSyntaxOnly` is what makes "erasure only" checkable rather than
  hopeful. **Not a bundler**: one file in, one file out, same names, same
  imports, nothing flattened, nothing minified, no new dependency. **`rootDir` is
  set explicitly** — TypeScript 7 stopped inferring the common source directory
  and refuses to emit without it; the value is the one 5.x worked out, and the
  drift check is what proves the layout did not move. The output is
  COMMITTED because `public/` is the site — building at deploy would be a new
  way for a release to silently not arrive (hub LESSONS §53) — so staleness is
  the risk and `tools/web-build.mjs --check` runs on every commit.
- **THE ENGINE CANNOT REACH THE DOM, AND THAT IS THE BUILD.** `tsconfig.json`
  has no DOM in `lib` and excludes `src/ui/`; the web config adds it. An engine
  file that touched `document` does not compile. **`exclude` is inherited
  through `extends`**, which is how the whole browser layer once ended up
  checked by neither project while both exited 0 —
  `tools/coverage-check.mjs` refuses a source file that is in no project, and a
  project that loads nothing, on every commit.
- **COLOURS COME FROM ONE FILE.** `palettes/solve-ent.json` is the source the
  hub's `palette-check.mjs` measures, and `tools/palette.mjs` generates
  `public/css/tokens.css` from the same file, so what was measured and what is
  painted cannot differ. The family is Instrument, adopted from the hub rather
  than invented. **Never write a colour anywhere else** — the a11y gate
  reverse-maps every rendered colour to a token and fails on one it does not
  recognise.
- **A NEW SURFACE JOINS `tools/a11y.mjs` IN THE SAME COMMIT.** The gate asserts
  its state list against every `[data-surface]` in the document, so it refuses
  rather than quietly not measuring. Every state it declares, in both modes,
  dialogs opened rather than skipped — most of this app's controls live inside them, and the
  diagnosis panel only exists after a wrong step. Run `npm run browser` for the
  gate and the walk together.
- **A NEW VERSION WAITS; THE READER RELEASES IT.** `public/sw.js` and the
  manifest are GENERATED by `tools/pwa.mjs` — the cache name carries the
  release, and the precache list is read off `public/` so a module cannot be
  silently missing offline. **Never `skipWaiting()` during install**: it puts the
  new worker under the OPEN page, still running the previous release's markup
  and modules, and `activate` deletes the old cache, so that page is served new
  files with nothing said. A first install is not an update — a waiting worker
  beside an ACTIVE one is, and a waiting worker with no active one is somebody
  arriving. The hub's `pwa-check.mjs` reads source and says itself that it
  catches never-implemented rather than implemented-wrong;
  `tools/update-walk.mjs` drives a REAL second worker and is what proves the
  path.
- **No third-party runtime dependencies, and no network calls at runtime.** Node
  strips the TypeScript for the tests and the tools, so there is no bundler and
  no test framework — the type checker is the whole build.

## Running it

Node 22.18 or newer, **and the hub checked out beside this repository** — the
palette is measured by the hub's canonical gate, and a session without it cannot
commit. That is deliberate: a colour reaching a screen unmeasured is the thing
that gate exists to prevent, so it fails rather than skipping. CI checks the hub
out at `.hub` and the gate looks in both places.

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

`npm run browser` runs the three that need a real browser: the accessibility gate
over every surface in both modes with the dialogs open, and the walk — the
primary journey with a step wrong on purpose, and the stale-app path against a
real second worker. They are not on the commit hook because they take about two
minutes; they are in CI, and a change to any surface
owes a local run.

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
