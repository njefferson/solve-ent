# What changed

Written for the people who use this: someone learning the algebra, and whoever
is teaching them — at a kitchen table, at a desk, or in a room with thirty other
people. Newest first.

**These notes are not written for programmers**, and that is deliberate. If a
release changed something you can see or do, it is described below in the words
you would use for it. If it changed something under the surface that you cannot
see, it says that plainly rather than dressing it up.

## 0.3.0 — CAPABILITY

**Significant-figures questions can now mix adding and multiplying, which is the
kind people get wrong most.**

Two rules govern how many digits an answer is allowed to keep, and they are
different rules. Adding is limited by decimal places. Multiplying is limited by
significant figures. A question that does both — add two measurements, then
multiply by a third — needs both rules, in order, and the usual mistake is to
skip the first one and round on the fewest digits in sight.

Until now this app could not ask that question at all. It could only ask
questions that used one rule or the other, so the hardest case in the topic was
missing. It is there now, from the second difficulty level up, and it asks about
the middle step on its own: *how many significant figures is that sum entitled
to?* — without asking anyone to round it, because rounding partway through is
the mistake, not the method.

This was found by reading published research on what people actually get wrong,
rather than by testing the app against itself. The app's own checks could never
have found it: they only ever look at questions the app is able to ask.

**Still missing, and it is most of it:** there is no screen. Nothing here can be
opened and used yet. Everything above lives in the part that works out the
questions and marks the answers, and there is nothing to look at.

## 0.2.1 — ITERATION

**Nothing this app says will ever suggest the problem is you.**

An app that fails to teach someone should leave them thinking *that app did not
work for me*, not *I cannot be taught*. So none of the words in it talk about
effort, or about what someone ought already to know, or call anything easy.
Calling something easy leaves only one explanation for why it did not go well,
and that explanation is the person reading it.

This is now checked automatically every time the app changes, the same way the
no-scores rule is, so it cannot quietly stop being true.

## 0.2.0 — CAPABILITY

**No scores, no streaks, no targets, and nothing congratulating anybody.**

A streak teaches you to protect a number, and it makes stopping feel like
losing something. That is the opposite of what is useful for the person who most
needs to sit and do twenty of these.

What you get instead is what changed:

- A mistake made **once** is not a pattern, and nothing is said about it.
- Made **twice**, it turns up at the end.
- Made **three times**, it is named while you are still working — once, with
  what fixes it — and then not raised again.
- If you were making the same mistake and then you stopped, it says so. **Only
  if that actually happened**, and one right answer after a run of wrong ones is
  not enough to count.

And if a whole set went wrong, it does not tell you how many. *Four questions
and none right* is true and is no use to anybody. It says what the mistake was
and that it is one thing to fix, not a pile of questions to do again.

**Also fixed:** a multiple-choice question could mark the wrong option correct
if it was one the marking had not been told about. On a rearranging question
that meant the upside-down answer would have been accepted. Nobody could have
run into this yet — there is no screen — but it would have been waiting.

## 0.1.0 — CAPABILITY

The first release. It works out questions and marks answers; there is nothing
to look at yet.

**What it covers.** Seven kinds of algebra, and only these seven, because each
one is something you cannot do a chemistry calculation without: rearranging a
formula, proportions and cross-multiplying, scientific notation, powers and
roots, fractions and rates, cancelling units through a chain, and significant
figures.

**What makes it different from a calculator.** It does not just mark an answer
wrong. It works out *which* mistake produces that exact number — the ratio used
upside down, the exponent multiplied instead of raised, a conversion factor
turned the wrong way — and says so.

**And it refuses to guess.** If two different mistakes would produce answers you
could not tell apart, the app will not ask that question at all. It would rather
stay quiet than tell somebody they have a misunderstanding they may not have.
When it genuinely cannot tell what happened, it says that too, rather than
picking something plausible.

**Still missing, and it is most of it:** no screen, nothing to open, no way to
practise a single skill on its own, and nothing to hand to anybody at the end.
