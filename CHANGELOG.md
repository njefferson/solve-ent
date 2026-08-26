# What changed

Written for whoever is reading it, not for whoever wrote it. Newest first.

## 0.2.0 — CAPABILITY

The engine can now read a run of attempts and say what happened, without ever
saying how many you got right.

- **What replaces praise is change.** A repeated mistake is named once, during
  the run, on the third time — with what fixes it, and never again. Twice goes
  in the closing. Once is not a pattern and is never mentioned. The sentence
  saying a mistake stopped is only said where the run actually shows that.
- **No score, no streak, no target, no congratulation**, and it is a gate rather
  than a paragraph: `tools/copy-check.mjs` runs on every commit and refuses a
  streak, a badge, points, a fraction like 3/7, and every variant of "Great
  job". Comments are stripped first, because the comments are where the words
  that must not be built are written down.
- **Nothing addressed to a reader assumed to be in a classroom.** Same gate.
  Homeschoolers are a real audience and the structure already serves them; the
  words were the only thing that would have excluded them.
- **A choice question and the grader now read one derivation of the options.**
  They used to be two hand-typed lookups, and a question the grader did not
  recognise silently marked the FIRST option right — which on a rearrangement is
  the upside-down answer.

**Still missing, and it is most of the app:** there is no screen, so none of the
above is visible to anybody yet. No single-skill drill surface, no completion
code, no teacher's page, nothing deployed.

## 0.1.0 — CAPABILITY

The domain engine and the error taxonomy. There is no screen yet, on purpose.

- Seven topics, and the list is closed: rearranging a formula, proportions and
  cross-multiplying, scientific notation, powers and roots, fractions and rates,
  cancelling units through a chain, and significant figures. Every one of them
  is here because a student cannot do a stoichiometry problem without it.
- Twenty-nine error classes, each predicting the exact wrong number a student
  holding that misconception would write.
- A collision sweep over 10,500 generated problems. Two classes predicting
  something a student could not tell apart fails the build.
- A command-line harness, which prints answers and is therefore not a student
  surface.

**Still missing, and it is most of the app:** there is no screen, no completion
code, no teacher's page, no accessibility work and nothing deployed. The two
numbers this release exists to produce are in `NOTES.md`.
