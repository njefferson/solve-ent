# What changed

Written for the people who use this: someone learning the algebra, and whoever
is teaching them — at a kitchen table, at a desk, or in a room with thirty other
people. Newest first.

**These notes are not written for programmers**, and that is deliberate. If a
release changed something you can see or do, it is described below in the words
you would use for it. If it changed something under the surface that you cannot
see, it says that plainly rather than dressing it up.

## 0.14.0 — CAPABILITY

**A set you were given is still there if you close it.** Shut the tab, let the
device sleep, come back later — the app offers to pick it up at the step it
stopped on, with everything already done still counted.

Only a set somebody gave you is remembered. Practice is not, because practice
records nothing, and there is nothing in a practice run to lose.

**It says whose set it is.** The offer names the number, which matters most on a
shared device: if it is not your number, you can see that before carrying on and
finishing somebody else's work under it. Hiding the number would have been the
same disclosure with a wrong record on the end of it.

**It does not sit there forever.** An unfinished set is forgotten after twelve
hours — long enough for a lesson, a break, a bus and a battery, short enough
that yesterday's set does not surface for whoever picks the device up tomorrow.
It is also forgotten the moment a set finishes and its code exists, and one
button forgets it on the spot. Forgotten means gone rather than blank.

A set that was left across an update is not picked up. The questions come from
the key, the topic and the difficulty, so a release that changes how a question
is built changes what sits at that place in the set — and carrying on would mean
counting answers to questions that no longer exist.

**One thing that was quietly broken and is fixed:** pressing through the opening
screen went straight to the topics without checking for an unfinished set. The
one route a person who had lost their place is most likely to take was the one
route that never offered it back. Everything goes through the same check now.

**Still missing:** nothing is deployed yet, so this all runs from a device that
already has it.

## 0.13.0 — ITERATION

**There is a real icon now.** A conical flask, with the liquid in it drawn as an
equals sign.

The flask is the chemistry — it is the one piece of glassware everybody
recognises at the size an icon is actually seen. The equals is the maths, and it
is the right sign for this in particular: what this teaches is rearranging
around an equals sign, using a ratio, moving powers of ten. A plus would have
named the one operation the seven topics barely touch, and a flask with a cross
on it looks like a first-aid app.

It is a solid shape with the sign cut out of it rather than an outline with a
sign inside, because at 32 pixels a solid shape reads and thin lines inside one
do not. There is a second version for the phones and tablets that crop an icon
to a circle, with the flask kept well inside what survives the crop.

**The colours are read from the same file everything else here is coloured
from.** An icon is the one part of an app that the readability checks cannot
reach — it is a picture, not a page — so it was the easiest place for a colour
nobody had ever measured to sit unnoticed. It is generated from the palette now,
and a check refuses to let the two drift apart.

**Still missing:** a set closed part-way through is still lost, since the code
only exists at the end. Nothing is deployed yet.

## 0.12.0 — CAPABILITY

**Codes are read a stack at a time.** Paste the whole lot into the box — one per
line — and press once. Each gets its own block, in the order they were pasted,
headed by the number so it can be found against a list on paper.

A line that does not read stays where it is rather than being dropped, and says
what was wrong with it and what was on the line. Underneath there are two
counts: how many read and how many did not. Two numbers rather than one over the
other, because one over the other reads like a mark out of something.

**A number that turns up twice is pointed out and not decided about.** It
happens when a code is written down twice and it happens when two people were
given the same number, and this cannot tell those apart, so it says which line
the number appeared on before and leaves it there.

**And the moves are added up across the whole stack**, ordered by how much went
wrong. That is the part worth taking back to the next lesson: it says what to
teach again, not who to talk to.

**Still missing:** the icon is still a simple drawing rather than a proper one,
and nothing is deployed yet, so this runs from a device that already has it.

## 0.11.0 — CAPABILITY

**A set can be handed in now.** If somebody gave you a key and a number, there
is a way in from the front screen, and at the end you get a code — sixteen
characters in four groups — to give back.

The code says which number you are, how many steps you did, how many were right
first time, which kinds of move went wrong and how many times, and roughly how
long it took. **That is everything in it.** No name, nothing you typed, and
nothing about the settings you were using: text size, spacing, one step at a
time and read-aloud stay on the device, and there is nowhere in a code for them
to go. Nobody should have to tell a room something about themselves just by
handing work back.

**And there is a page for reading them.** Whoever set the work opens
`/teacher`, types in the set as they gave it out, and pastes the code. It reads
on the device, with no connection and nothing to sign in to, because the page
doing the reading is the same code that did the writing.

The characters are chosen for handwriting: there is no I, L, O or U in a code,
and if you write O for zero or l for one it still reads. A code from a different
key, a different topic or an easier difficulty than the one that was set does
not read at all, and the page says which way it is wrong rather than just
refusing.

**One thing said plainly, because it would be easy to imply otherwise:** the
check on a code catches a character copied wrong, or last week's code, or the
wrong set. It cannot stop somebody who reads the source of the page and writes
their own — there is no server here, so there is no secret to keep one out. The
page says so itself.

A drop-down list on the new page turned out to be painted by the browser rather
than by this app: nineteen pixels tall, in system greys that had never been
checked for readability in either light or dark. Both are fixed, and the sweep
that checks every screen now covers twenty of them rather than fifteen.

**Still missing:** the icon is still a simple drawing rather than a proper one.
Codes are read one at a time, so a stack of thirty is thirty pastes. Nothing is
deployed yet, so this all runs from a device that already has it.

## 0.10.0 — CAPABILITY

**You can do the arithmetic without leaving the question.** Every step that asks
for a number now has a scratch line under the answer box, with a keypad, and a
button that puts what it worked out straight into the answer.

The keypad is there because this gets used on a tablet by finger, and × and ÷
are two keyboard layers away on most of them — far enough that you would reach
for a phone instead, which is exactly the thing worth avoiding. There is an EE
key for the powers of ten, since a mole is 6.022 × 10²³ and nobody types
twenty-three zeros. It takes typed input too if you have a keyboard.

**It does not round, and that is deliberate.** Working out how many figures an
answer is entitled to is one of the seven things this teaches. A scratch line
that quietly handed back 90.3 would be doing that step for you at the exact
moment you were being asked to do it, so it hands back the whole number and
says to round it yourself.

It also never sees the question. It multiplies the numbers you chose in the
order you chose them — deciding what to multiply, and which way up, is the whole
of what this is for and the scratch line has no part in it. The description in
the ⓘ panel used to say this is not a calculator; it now says what is actually
true, which is that it does not solve the question for you.

**Still missing:** nothing can be handed in and there is still no page for
whoever set the work. The icon is still a simple drawing rather than a proper
one.

## 0.9.0 — CAPABILITY

**What you have already worked out stays on the screen.** Each step you finish
is kept in front of you, in the words you wrote it in, until the question is
over.

This matters most where one step feeds the next. A proportion asks how many
times the recipe you have, and then asks you to use that number. A rate given
upside down asks you to turn it over, and then asks you to divide by what you
turned over. Both of those used to ask you to remember a number you could no
longer see, or to write it on something else — and needing anything other than
this app in front of you is friction that has nothing to do with the algebra.

It is your own work, not the app's: a line appears only once you have got that
step right, and it shows what you typed rather than a number worked out for you.
It clears when the next question starts, because working from one question
sitting beside another question's numbers is worse than showing nothing.

**And the closing screen had never been checked for readability.** The
accessibility sweep is supposed to walk every screen in both light and dark and
measure the contrast, the tap targets and the focus outlines. The part of it
that drives a set to the end could not actually finish one, so it sat on the
question screen and reported everything it measured under the name of the
closing screen — for every release there has been. It reaches the end properly
now, and the closing screen passed the first time it was really looked at.

**Still missing:** there is no way to do the arithmetic inside the app yet, so a
calculator is still a second thing to have in front of you. Nothing can be
handed in and there is no page for whoever set the work. The icon is still a
simple drawing rather than a proper one.

## 0.8.0 — CAPABILITY

**You can choose how the questions are set now.** Pick a topic and it asks which
kind of question you want before it starts.

They have names rather than numbers, and the name says what the question does:
cancelling units offers two steps, three steps or four steps; powers offers
squares, then cubes and roots, then past a cube; significant figures offers one
rule, either rule, then two rules in order. Every one of them is there the first
time you open it. Nothing is locked, nothing has to be earned, and nothing
switches you to a different one because of how a run went.

**Two topics were offering a choice that changed nothing.** This is worth being
plain about, because the setting has existed since the first release and every
question you have ever been given came at the first one.

When each was measured against the one below it, six of the fourteen steps
produced questions nobody could tell apart — bigger numbers, and nothing else.
So the topics now offer what they actually have. Proportions has one kind of
question. Fractions has two. The other five have three each.

**Fractions can hand you the rate upside down.** Instead of "the concentration
is 4.00 mol/L" you get "the volume one mole takes up is 0.250 L/mol", and the
first thing it asks is to turn that over. This is what the topic is named for
and it had never once been asked.

**Cancelling units goes up to four conversions in a row**, which is where the
long chemistry questions live — a volume of liquid weighed, turned into moles,
and then into particles or into the volume it fills as a gas.

Two things were found while measuring all of this and both are fixed. A
proportion question could ask you to work out a number that was already printed
in the question, when a recipe took one mole of the first substance. And on a
long conversion, turning one factor over and turning the whole chain over could
come to the same answer, so being told which one happened would have been a
guess.

**Still missing:** nothing can be handed in and there is still no page for
whoever set the work. Proportions has one kind of question because a second one
means asking about two reactions in a row, and that is a question this has never
posed — it is for whoever is teaching to ask for, not for this to decide. The
icon is still a simple drawing rather than a proper one.

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
