# What changed

Written for the people who use this: someone learning the algebra, and whoever
is teaching them — at a kitchen table, at a desk, or in a room with thirty other
people. Newest first.

**These notes are not written for programmers**, and that is deliberate. If a
release changed something you can see or do, it is described below in the words
you would use for it. If it changed something under the surface that you cannot
see, it says that plainly rather than dressing it up.

## 0.7.0 — CAPABILITY

**You can practise one move on its own now**, instead of working whole questions
and walking past the step you want four times to reach it once.

Whole questions are what makes a move stick once you have it. A move you do not
have yet is built the other way round: by doing that one thing again. So there
is a second way in — pick one of six moves and get that move, over and over,
with the question around it for context but only the one step to answer.

The six are choosing the move, isolating the unknown, scaling by a ratio, doing
the arithmetic, carrying and cancelling units, and significant figures. Stop
whenever you like; it tells you what happened and there is no number anywhere.

Nothing about a practice run is stored. There is no session, nothing to hand in,
and nothing written to the device.

**Three questions were asking for letters that were not in the equation.** This
is the one worth knowing about, and it had been there since the first release.

A question would show you `PV = nRT` and then ask you to rearrange it for `ng`.
Another showed `n × M = m` and offered you `n = m ÷ (Mm)`. A third showed
`T(K) = T(°C) + 273.15` and called them `TK` and `TC`. Those were names used
inside the app, and they were never meant to reach anybody. All of them now show
the letters that are actually in the equation.

**And the answer choices could be read two ways.** One option came out as
`V₁ = (P₁) ÷ P₂ × V₂`, which could mean two different things depending on where
you put the brackets — and neither of them was the mistake the option was
supposed to represent. Brackets go where they change the meaning now, and
nowhere else.

Both of those were found by building the practice screen, because it is the
first thing that ever showed one of those steps on its own.

**Still missing:** every question still arrives at the same difficulty when you
work a whole set. Nothing can be handed in and there is no page for whoever set
the work. The icon is still a simple drawing rather than a proper one.

## 0.6.0 — CAPABILITY

**It works with no connection now**, which is the one that matters most for
whoever is doing this on a bus, in a car, or somewhere the signal gives out
halfway through.

Open it once with a connection and it keeps a copy on the device. After that it
opens whether or not there is any network at all — the questions, the marking,
the explanations and the list of what changed. Nothing is ever fetched while you
work, because nothing ever was: the questions are worked out on the device.

**And when a newer version arrives, it waits for you.** This is the part most
apps get wrong, so it is worth saying what happens instead.

A newer version does not replace what you have while you are using it. You get a
line at the top of the screen saying one is ready, with a button to switch to it
and a button to leave it for later. Nothing reloads on its own, nothing is lost
part-way through a question, and if you ignore it entirely you get the new one
next time you open the app.

If you have never opened this before, you are told none of that. There is
nothing you missed.

**You can keep it on your home screen**, and the information button now lists
how to do that on each kind of device.

**Also:** the panel that tells you which copy of the app is on the device now
says so exactly, which matters because the version number on screen is reported
by the code that is running — on an out-of-date copy, that is the old code
reporting itself perfectly accurately.

**Still missing:** there is still no way to practise a single move over and over,
which is the thing most worth having when one particular step is the one going
wrong. Every question still arrives at the same difficulty. Nothing can be handed
in and there is no page for whoever set the work. And the icon is a simple
drawing rather than a proper one.

## 0.5.0 — CAPABILITY

**There is something to open.** Until now everything in here worked and none of
it could be seen.

You get a short page saying what this is and what it is not, and then you pick
one of the seven kinds of question and work through five of them, one step at a
time. Get a step wrong and it tells you which mistake produces that exact
number — and **the step stays where it is until you get it**, because a step you
can walk past is just another question.

**It can be made easier to read, and those settings never leave your device.**
Bigger text, more space between letters and lines, showing one thing at a time,
and reading the question aloud where the device can do that. None of them is
written into anything you hand in and none of them is sent anywhere. That is
deliberate rather than an oversight: what somebody needs in order to read
something is nobody else's business, and a tool that quietly passed it on would
make them disclose it every time they used it.

**Day and night colours**, following the device unless you say otherwise. The
colours were measured against a contrast standard before anything was drawn,
in both, on every screen — including the ones that only appear after a wrong
answer, which is where this kind of thing usually goes unchecked.

**An information button in the corner**, with what this is, how to keep it on
your home screen on each kind of device, where the questions come from, what it
stores, what changed, the accessibility statement and the licence. The page you
see first is moved in there when you press Start, so it is still reachable
rather than gone.

**And a page listing every release**, which the panel above links to. The panel
itself never shows more than five, and says how many it is not showing.

**Still missing, and some of it matters:** it does not work offline yet — close
the connection and it will not open, which is worst for exactly the people who
need it on a bus. There is still no way to practise a single move over and over,
which is the thing most worth having when one particular step is the one going
wrong. Nothing can be handed in and there is no page for whoever set the work.
Every question arrives at the same difficulty for now. And there is no way to be
told when a newer version is waiting.

## 0.4.0 — CAPABILITY

**When a new version arrives, this will be able to tell you what changed — and
it will not be an endless list.**

Every app should say what is different since last time, in the place you already
are, rather than sending you off to a website meant for programmers. This
release builds the part that holds those words: the newest release plus four
before it, and nothing older than that. Everything further back lives on a page
inside the app itself.

Five is a decision and not a number that happened. A list that grows by
accumulation eventually becomes longer than the thing it is describing, and
nobody opening a maths trainer wants to scroll through two years of it. The app
also knows how many releases it is NOT showing, so it can say so, instead of
leaving an impression that five is all there has ever been.

**The words are now written in one place and only one place.** Until now, what a
reader would see and what was kept alongside the working parts were two separate
lists — and two lists drift, so an app ends up describing a change that is not in
the version somebody is actually running. There is one set of words now, and a
check refuses any change that lets the two disagree.

**Still missing, and it is the part that matters:** there is still no screen, so
the panel that would appear on a new version, and the page it would open, do not
exist yet. What exists is the list of words and the rule about how long it is
allowed to be. Nothing here can be opened and read.

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

**Still missing:** there is no screen, so none of these words have reached
anybody yet. The check is in place for when they do.

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

**Still missing:** there is no screen, so nothing above can be seen. And there
is still no way to practise a single skill on its own, which is the thing most
worth having if one particular move is the one going wrong.

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
