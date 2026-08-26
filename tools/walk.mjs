#!/usr/bin/env node
/**
 * walk.mjs — the primary journey, in a real browser, doing what a reader does.
 *
 *   node tools/walk.mjs
 *
 * The accessibility gate measures every surface. This asks a different
 * question: does the thing WORK — arrive, begin, get a step wrong on purpose,
 * be told what happened, finish, and survive a reload.
 *
 * ## What it refuses to accept as evidence
 *
 * **A count that is not scoped to its own screen.** An unscoped row count went
 * from 8 to 16 in a sibling app the moment a second screen used the same class,
 * and the walk that read it reported twice as much content as existed. Every
 * count here is scoped to the visible surface.
 *
 * **A step that advanced.** A wrong entry must NOT move the run on. That is the
 * whole shape of the thing — a gate that opens on a wrong answer is a list of
 * questions rather than something that teaches a move — and it is the one
 * behaviour a screenshot cannot show.
 *
 * **A page that came out of a cache.** The reload is a real one, and the
 * network is dropped first, so what is measured afterwards is what a reader on
 * a dead connection actually gets.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { TOPIC_NAMES } from '../src/engine/problem.ts';
import { currentProblem, currentStage, startSession, submit } from '../src/engine/steps.ts';
import { solve } from '../src/engine/problem.ts';
import { COUNTER_SKILLS, correctEntryFor } from '../src/engine/taxonomy.ts';
import { groupCode, writeCode } from '../src/report/code.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const findings = [];
const steps = [];

const check = (ok, what, detail = '') => {
  steps.push({ ok, what, detail });
  if (!ok) findings.push(`${what}${detail === '' ? '' : ` — ${detail}`}`);
};

/** Which surface is on screen, scoped so a hidden one cannot be counted. */
const visibleSurface = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-surface]')].filter((n) => !n.hidden).map((n) => n.dataset['surface']),
  );

const server = await serve(join(REPO, 'public'));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const thrown = [];
page.on('pageerror', (error) => thrown.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') thrown.push(`console: ${message.text()}`);
});

console.log('\n=== the walk · Solve-ent ===\n');

/* ---- arriving ---- */
await page.goto(`${server.origin}/`);
await page.waitForTimeout(200);
check((await visibleSurface(page)).join() === 'welcome', 'a first-time visitor lands on the orientation');
check(
  (await page.locator('#whats-new[open]').count()) === 0,
  'a first-time visitor is NOT shown what they missed by never having been here',
);

/* ---- beginning, and what happens to the orientation ---- */
await page.click('#begin');
await page.waitForTimeout(150);
check((await visibleSurface(page)).join() === 'start', 'pressing Start reaches the topic list');
check(
  (await page.locator('#info-orientation-slot #orientation').count()) === 1,
  'the orientation SURVIVES what a reader presses to begin',
  'it is moved into the (i) panel, not copied',
);
check(
  (await page.locator('[data-surface="welcome"] #orientation').count()) === 0,
  'and there is exactly ONE copy of those words',
);
check((await page.locator('#topics button').count()) === 7, 'seven topics, and the list is closed');

/* ---- choosing how the questions are set ---- */
await page.locator('#topics button').first().click();
await page.waitForTimeout(150);
check(
  (await visibleSurface(page)).join() === 'difficulty',
  'picking a topic that has more than one difficulty asks which one',
);
// THE COUNT IS THE DETAIL, NOT THE SENTENCE. Written into the sentence it read
// "all three ... are offered at once, not 3" on the line where it PASSED, since
// a passing line prints its detail too.
const offered = await page.locator('#difficulties button').count();
check(offered === 3, "all three of this topic's difficulties are offered at once", `${String(offered)} offered`);
check(
  (await page.locator('#difficulties button[disabled]').count()) === 0,
  'and none of them is locked — nothing here has to be earned',
);

/* ---- working ---- */
await page.locator('#difficulties button').first().click();
await page.waitForTimeout(150);
check((await visibleSurface(page)).join() === 'work', 'picking a difficulty starts the run');
const question = await page.locator('#question').innerText();
const step = await page.locator('#step-prompt').innerText();
check(question.trim().length > 0, 'there is a question on screen');
check(step.trim().length > 0, 'and the step being asked is on screen');

/* ---- getting one wrong ON PURPOSE ---- */
const before = step;
let wrongWorked = false;
if ((await page.locator('#answer').count()) > 0) {
  await page.fill('#answer', '0.00042');
  await page.locator('#entry .primary').click();
  await page.waitForTimeout(150);
  wrongWorked = !(await page.locator('#diagnosis').isHidden());
} else {
  for (let i = 0; i < 6 && !wrongWorked; i += 1) {
    await page.locator('.choice').first().click();
    await page.waitForTimeout(120);
    wrongWorked = !(await page.locator('#diagnosis').isHidden());
    if (!wrongWorked && (await page.locator('.choice').count()) === 0) break;
  }
}
check(wrongWorked, 'a wrong step is diagnosed rather than only marked wrong');
if (wrongWorked) {
  const said = await page.locator('#diagnosis').innerText();
  check(said.trim().length > 20, 'and it says what happened', said.slice(0, 60).replace(/\n/g, ' '));
  check(
    !/\b\d+\s*(?:\/|out of)\s*\d+\b/.test(said),
    'with no count of right answers anywhere in it',
  );
  check(
    (await page.locator('#step-prompt').innerText()) === before,
    'and the step did NOT advance',
    'a gate that opens on a wrong answer is a list of questions',
  );
}

/* ---- the (i) panel ---- */
await page.keyboard.press('Escape');
await page.click('#open-info');
await page.waitForTimeout(150);
check(await page.locator('#info[open]').isVisible(), 'the (i) panel opens');
const info = await page.locator('#info').innerText();
for (const owed of ['Home Screen', 'Add to Home screen', 'Accessibility', 'Licence', 'What changed']) {
  check(info.includes(owed), `the (i) panel carries: ${owed}`);
}
const diagnostic = await page.locator('#diagnostic-text').innerText();
check(diagnostic.includes('touch points'), 'the diagnostic says what the browser string hides');
for (const leak of ['largest', 'read-aloud', 'one-step', 'open']) {
  check(!diagnostic.toLowerCase().split('\n').some((l) => l.startsWith(leak)), `the diagnostic carries no setting: ${leak}`);
}
await page.locator('#info button[data-close]').click();
await page.waitForTimeout(100);
check(!(await page.locator('#info[open]').count()), 'and it closes');

/* ---- finishing, which needs the RIGHT answers ----
 *
 * A wrong step does not advance, which is the behaviour asserted above — so a
 * harness that keeps guessing never finishes, and the first version of this
 * walk sat there four hundred times and then reported that the run does not
 * end. The app was right and the walk was wrong.
 *
 * So the correct entries are computed HERE, in Node, from a session built with
 * the same key, topic, tier and count. The problems are a pure function of
 * those, so the two sessions are step for step the same run — which makes this
 * a stronger check than finishing was: it says the browser's session and an
 * independent one agree at every stage, and that the screen's own controls
 * carry an answer through correctly.
 *
 * NOTHING STUDENT-FACING DOES THIS. `correctEntryFor` is the grader's, this is
 * a tool, and the screen is never told the answer — that is the whole reason
 * the harness has to work it out separately instead of reading it off the page.
 */
const firstTopic = Object.keys(TOPIC_NAMES)[0];
let shadow = startSession(
  { assignmentKey: 'practice', topic: firstTopic, tier: 1, count: 5, mode: 'practice', rosterNumber: null },
  { now: () => 0 },
);
// The shadow starts at problem 0 stage 0; the browser is part-way through
// problem 0 because of the wrong answers above, which do not advance it. So
// they are still on the same stage.
let stepsDriven = 0;
for (let guard = 0; guard < 200; guard += 1) {
  if (await page.locator('[data-surface="done"]').isVisible()) break;
  if (shadow.finished) break;
  const problem = currentProblem(shadow);
  const stage = currentStage(shadow);
  const entry = correctEntryFor(problem, solve(problem), stage, SCRATCH_SIG_FIGS);

  // What the reader is about to write, in the words they write it in — so the
  // working can be checked for THAT rather than for something like it.
  let wrote = entry.kind === 'text' ? entry.text : '';
  if (entry.kind === 'choice') {
    const choices = page.locator('.choice');
    if ((await choices.count()) === 0) break;
    wrote = (await choices.nth(entry.option).innerText()).trim();
    await choices.nth(entry.option).click();
  } else {
    if ((await page.locator('#answer').count()) === 0) break;
    await page.fill('#answer', entry.text);
    await page.locator('#entry .primary').click();
  }
  await page.waitForTimeout(20);
  // Advance the shadow only where the screen advanced, so a disagreement shows
  // up as the walk stopping rather than as the two silently diverging.
  const stillHere = (await page.locator('#step-prompt').innerText()) === stage.prompt;
  if (stillHere && !(await page.locator('#diagnosis').isHidden())) {
    check(false, 'a correct entry was marked wrong by the screen', `${stage.id}: "${entry.kind === 'text' ? entry.text : String(entry.option)}"`);
    break;
  }
  const wasOn = shadow.problemIndex;
  shadow = submit(shadow, entry, { now: () => 0 }).session;
  stepsDriven += 1;

  /* ---- what the reader has already written stays in front of them ---- */
  //
  // THE POINT OF IT: nothing a step needs should have to be held in the
  // reader's head or fetched from outside the app. A proportion asks for the
  // scale and then asks you to use it; a rate stated upside down asks you to
  // turn it over and then divide by what you turned over. Both of those used to
  // ask the reader to remember a number they could no longer see.
  if (!shadow.finished && shadow.problemIndex === wasOn && stepsDriven === 1) {
    const visible = await page.locator('#working').isVisible();
    check(visible, 'the step just answered is still on screen for the next one');
    const shown = visible ? await page.locator('#working-list').innerText() : '';
    check(shown.includes(wrote), 'and it is what the reader wrote, not a value the app worked out', wrote.slice(0, 40));
    check(
      (await page.locator('#working-list li').count()) === stepsDriven,
      'with a line for each step done and none for a step nobody has answered',
    );

    /* ---- and the arithmetic can be done without leaving the question ---- */
    if ((await page.locator('#answer').count()) > 0) {
      check(await page.locator('#scratch-keys').isHidden(), 'the keypad is put away until it is asked for');
      await page.click('#scratch-toggle');
      await page.fill('#scratch-line', '3.975×1000÷44.01');
      await page.waitForTimeout(30);
      const worked = (await page.locator('#scratch-result').innerText()).trim();
      const byHand = (3.975 * 1000) / 44.01;
      check(worked === `= ${String(byHand)}`, 'a sum typed on the scratch line is worked out in the app', worked);
      check(
        !worked.includes('90.32') || String(byHand).startsWith(worked.slice(2, 7)),
        'and it is not rounded — significant figures are a step the reader is asked to do',
      );
      await page.click('#scratch-use');
      await page.waitForTimeout(30);
      const carried = await page.locator('#answer').inputValue();
      check(carried === String(byHand), 'and it lands in the answer box rather than being copied by hand', carried);
      // Put it back, so the run carries on from where it was.
      await page.fill('#answer', '');
      await page.click('#scratch-toggle');
    }
  }
  if (shadow.problemIndex !== wasOn && !shadow.finished) {
    check(
      await page.locator('#working').isHidden(),
      'and a new question starts with an empty one, since the working belongs to the question',
    );
  }
}
check(stepsDriven > 0, 'correct answers are accepted and carry the run forward', `${String(stepsDriven)} step(s)`);
check((await visibleSurface(page)).join() === 'done', 'the run finishes');
const closing = await page.locator('#closing').innerText();
check(closing.trim().length > 0, 'and says what happened', closing.slice(0, 70).replace(/\n/g, ' | '));
check(!/\b\d+\s*(?:\/|out of)\s*\d+\b/.test(closing), 'with no fraction of right answers');
check(!/\b(?:streak|badge|great job|well done)\b/i.test(closing), 'and nothing congratulating anybody');

/* ---- blocked practice: one move, again ----
 *
 * A whole question is interleaved practice. A move somebody does not have yet
 * is built by doing it again — and an app with only whole questions makes the
 * student who inverts a ratio walk five steps they can already do to reach the
 * one they cannot.
 */
await page.goto(`${server.origin}/`);
await page.evaluate(() => {
  try {
    globalThis.localStorage.setItem('solvent.welcomed', 'yes');
  } catch { /* nothing to do */ }
});
await page.reload();
await page.waitForTimeout(200);
await page.click('#to-drill');
await page.waitForTimeout(200);
check((await visibleSurface(page)).join() === 'drill-pick', 'a reader can go straight to practising one move');
const moves = await page.locator('#moves button').allInnerTexts();
check(moves.length === 6, 'all six moves are offered', `${String(moves.length)} offered`);
check(
  moves.some((name) => /isolating the unknown/i.test(name)),
  'including isolating the unknown, which lives in about one tier-3 problem in twelve',
);

const flagship = moves.findIndex((name) => /isolating the unknown/i.test(name));
await page.locator('#moves button').nth(flagship === -1 ? 0 : flagship).click();
await page.waitForTimeout(400);
check((await visibleSurface(page)).join() === 'drill', 'picking a move starts the drill');
const drillStep = await page.locator('#drill-step').innerText();
check(drillStep.trim().length > 0, 'and there is a step to do', drillStep.slice(0, 60));
check(
  (await page.locator('#drill-question').innerText()).trim().length > 0,
  'with the question around it for context, since a move with nothing to hold on to is not a move',
);

// Wrong on purpose: the move must not advance, exactly as a whole question.
let drillDiagnosed = false;
if ((await page.locator('#drill-answer').count()) > 0) {
  await page.fill('#drill-answer', '0.00042');
  await page.locator('#drill-entry .primary').click();
  await page.waitForTimeout(200);
  drillDiagnosed = !(await page.locator('#drill-diagnosis').isHidden());
} else {
  for (let i = 0; i < 6 && !drillDiagnosed; i += 1) {
    await page.locator('#drill-entry .choice').first().click();
    await page.waitForTimeout(150);
    drillDiagnosed = !(await page.locator('#drill-diagnosis').isHidden());
  }
}
check(drillDiagnosed, 'a wrong move in a drill is diagnosed, not just marked wrong');
if (drillDiagnosed) {
  check(
    (await page.locator('#drill-step').innerText()) === drillStep,
    'and the move does NOT advance',
  );
}

// NOTHING IS RECORDED. The drill has no session, so there is nothing that could
// become a completion code — asserted on what the page actually holds rather
// than on the absence of a button.
check(
  await page.evaluate(() => {
    try {
      return Object.keys(globalThis.localStorage).every((key) => !/session|code|drill|attempt|score/i.test(key));
    } catch {
      return true;
    }
  }),
  'a drill stores nothing about the run',
);

await page.click('#drill-stop');
await page.waitForTimeout(200);
check((await visibleSurface(page)).join() === 'done', 'stopping a drill says what happened');
const drillClosing = await page.locator('#closing').innerText();
check(drillClosing.trim().length > 0, 'in words', drillClosing.slice(0, 60).replace(/\n/g, ' | '));
check(!/\b\d+\s*(?:\/|out of)\s*\d+\b/.test(drillClosing), 'with no fraction of right moves');
check(!/\b(?:streak|badge|great job|well done)\b/i.test(drillClosing), 'and nothing congratulating anybody');

/* ---- an assigned set, the code it produces, and reading it back ---- */
//
// THE WHOLE LOOP, in one place: a set given out, worked to the end, a code
// written down, and that code read back on the other page. Each half is
// worthless without the other — a code nobody can read is a dead end, and a
// reader that accepts anything is worse than no reader.
{
  await page.goto(`${server.origin}/`);
  await page.waitForTimeout(150);
  // THE WELCOME IS ONLY THERE ONCE. By this point in the walk it has been seen
  // and stored, so pressing through it unconditionally waits thirty seconds for
  // a button that will never come back.
  if (await page.locator('[data-surface="welcome"]').isVisible()) await page.click('#begin');
  await page.click('#to-assignment');
  check((await visibleSurface(page)).join() === 'assignment', 'a set somebody was given has its own screen');

  await page.fill('#assignment-key', 'CHEM-7B');
  await page.fill('#roster-number', '99999');
  await page.click('#assignment-next');
  await page.waitForTimeout(60);
  check(
    !(await page.locator('#assignment-note').isHidden()),
    'a number outside the roster range is refused, and the screen says so rather than starting a run',
  );
  check((await visibleSurface(page)).join() === 'assignment', 'and it does not go anywhere');

  await page.fill('#roster-number', '17');
  await page.click('#assignment-next');
  await page.waitForTimeout(60);
  check((await visibleSurface(page)).join() === 'start', 'a key and a number in range carry on to the topics');

  await page.locator('#topics button').first().click();
  await page.waitForTimeout(80);
  await page.locator('#difficulties button').first().click();
  await page.waitForTimeout(80);

  // Driven with a second session worked out here, exactly as the run above is.
  let assignedShadow = startSession(
    { assignmentKey: 'CHEM-7B', topic: firstTopic, tier: 1, count: 5, mode: 'assignment', rosterNumber: 17 },
    { now: () => 0 },
  );
  for (let guard = 0; guard < 200; guard += 1) {
    if (assignedShadow.finished) break;
    if (await page.locator('[data-surface="done"]').isVisible()) break;
    const problem = currentProblem(assignedShadow);
    const stage = currentStage(assignedShadow);
    const entry = correctEntryFor(problem, solve(problem), stage, SCRATCH_SIG_FIGS);
    if (entry.kind === 'choice') {
      const choices = page.locator('.choice');
      if ((await choices.count()) === 0) break;
      await choices.nth(entry.option).click();
    } else {
      if ((await page.locator('#answer').count()) === 0) break;
      await page.fill('#answer', entry.text);
      await page.locator('#entry .primary').click();
    }
    await page.waitForTimeout(20);
    assignedShadow = submit(assignedShadow, entry, { now: () => 0 }).session;
  }

  check(!(await page.locator('#code-block').isHidden()), 'an assigned set ends with a code');
  const code = ((await page.locator('#completion-code').innerText()) ?? '').trim();
  check(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(code), 'written in groups a hand can copy', code);

  /* ---- a set closed part-way through is still there ---- */
  //
  // THE REAL FAILURE THIS IS ABOUT: a tab closed, a device asleep, a browser
  // reclaiming memory. The code only exists at the end, so a set lost part-way
  // through is work that cannot be handed in at all.
  {
    await page.goto(`${server.origin}/`);
    await page.waitForTimeout(150);
    if (await page.locator('[data-surface="welcome"]').isVisible()) await page.click('#begin');
    await page.click('#to-assignment');
    await page.fill('#assignment-key', 'CHEM-9A');
    await page.fill('#roster-number', '23');
    await page.click('#assignment-next');
    await page.locator('#topics button').first().click();
    await page.waitForTimeout(80);
    await page.locator('#difficulties button').first().click();
    await page.waitForTimeout(80);

    let side = startSession(
      { assignmentKey: 'CHEM-9A', topic: firstTopic, tier: 1, count: 5, mode: 'assignment', rosterNumber: 23 },
      { now: () => 0 },
    );
    for (let i = 0; i < 3; i += 1) {
      const problem = currentProblem(side);
      const stage = currentStage(side);
      const entry = correctEntryFor(problem, solve(problem), stage, SCRATCH_SIG_FIGS);
      if (entry.kind === 'choice') await page.locator('.choice').nth(entry.option).click();
      else {
        await page.fill('#answer', entry.text);
        await page.locator('#entry .primary').click();
      }
      await page.waitForTimeout(20);
      side = submit(side, entry, { now: () => 0 }).session;
    }
    const wasOn = await page.locator('#step-prompt').innerText();

    // A REAL RELOAD, not a state reset.
    await page.reload();
    await page.waitForTimeout(200);
    if (await page.locator('[data-surface="welcome"]').isVisible()) await page.click('#begin');
    await page.waitForTimeout(120);
    check((await visibleSurface(page)).join() === 'resume', 'a set closed part-way through is offered back');
    const what = await page.locator('#resume-what').innerText();
    check(what.includes('23'), 'and it says whose it is, so nobody finishes somebody else’s set', what);
    check(what.includes('CHEM-9A'), 'and which set it was');

    await page.click('#resume-go');
    await page.waitForTimeout(150);
    check((await visibleSurface(page)).join() === 'work', 'carrying on goes back to the questions');
    check(
      (await page.locator('#step-prompt').innerText()) === wasOn,
      'at the step it stopped on rather than the start of the set',
    );

    /* ---- and forgetting it means forgetting it ---- */
    await page.reload();
    await page.waitForTimeout(200);
    if (await page.locator('[data-surface="welcome"]').isVisible()) await page.click('#begin');
    await page.waitForTimeout(120);
    check((await visibleSurface(page)).join() === 'resume', 'it is still there on the next visit');
    await page.click('#resume-drop');
    await page.waitForTimeout(100);
    check((await visibleSurface(page)).join() === 'start', 'and forgetting it goes to the topics');
    check(
      await page.evaluate(() => globalThis.localStorage.getItem('solvent.unfinished') === null),
      'with nothing left on the device — not an empty value, gone',
    );
  }

  /* ---- and read back on the page for whoever set it ---- */
  await page.goto(`${server.origin}/teacher/`);
  await page.waitForTimeout(150);
  check((await visibleSurface(page)).join() === 'teacher', 'reading a code is a page in this app');
  check(
    (await page.locator('a[href*="github"]').count()) === 0,
    'and it links to no code host either',
  );

  await page.fill('#key', 'CHEM-7B');
  await page.fill('#code', code);
  await page.click('#read');
  await page.waitForTimeout(60);
  const said = await page.locator('#result-list').innerText();
  check(said.includes('Number 17'), 'the code reads back the number that was entered', said.split('\n')[0] ?? '');
  check(/Steps attempted: [1-9]/.test(said), 'and how far they got');
  check(!said.includes('CHEM-7B'), 'without echoing the key back as though it came out of the code');

  /* ---- and a stack of them, which is how a class's worth is read ---- */
  //
  // A CODE NOBODY CAN READ IN BULK is thirty pastes, which is the friction this
  // page exists to remove. Written here rather than earned by driving three
  // runs: the run that earns one end to end is the block above.
  {
    const noWrong = Object.fromEntries(COUNTER_SKILLS.map((skill) => [skill, 0]));
    const set = { key: 'CHEM-7B', topic: firstTopic, tier: 1 };
    const stack = [
      groupCode(writeCode({ rosterNumber: 17, attempted: 14, rightFirstTime: 11, wrongBySkill: { ...noWrong, SCALE: 2 }, elapsedMs: 420000 }, set)),
      groupCode(writeCode({ rosterNumber: 4, attempted: 15, rightFirstTime: 15, wrongBySkill: noWrong, elapsedMs: 300000 }, set)),
      groupCode(writeCode({ rosterNumber: 17, attempted: 9, rightFirstTime: 6, wrongBySkill: { ...noWrong, SCALE: 1, UNITS: 5 }, elapsedMs: 600000 }, set)),
      'ZZZZ-ZZZZ-ZZZZ-ZZZZ',
    ];
    await page.fill('#key', 'CHEM-7B');
    await page.fill('#code', stack.join('\n'));
    await page.click('#read');
    await page.waitForTimeout(80);

    check((await page.locator('#result-list > li').count()) === 4, 'a stack is read in one go, a block per line');
    const tally = await page.locator('#result-tally').innerText();
    check(tally.includes('Read: 3'), 'with a count of the ones that read', tally);
    check(tally.includes('Did not read: 1'), 'and of the ones that did not');
    check(
      (await page.locator('.code-refused').count()) === 1,
      'the one that did not read stays in place rather than being dropped from the list',
    );
    const all = await page.locator('#result-list').innerText();
    check(all.includes('also came up on line 1'), 'a number that appears twice is pointed out rather than merged');

    // THE PART WORTH TAKING BACK TO A LESSON: what went wrong across everybody,
    // rather than what each person did.
    const across = await page.locator('#across-list').innerText();
    check(!(await page.locator('#across').isHidden()), 'and the moves are added up across the stack');
    check(across.includes('3 wrong'), 'with the totals added rather than counted per code', across.split('\n')[0] ?? '');
    check(
      across.indexOf('carrying and cancelling units') < across.indexOf('scaling by a ratio'),
      'ordered by how much went wrong, so the first line is the one to teach again',
    );
  }

  /* ---- and a code that belongs to another set does not read ---- */
  await page.fill('#code', code);
  await page.fill('#key', 'CHEM-7C');
  await page.click('#read');
  await page.waitForTimeout(60);
  const refused = await page.locator('#result-list').innerText();
  check(
    refused.toLowerCase().includes('does not read against this set'),
    'a code from a different set is refused, and says which way it is wrong',
  );
  check(
    (await page.locator('#result-title').innerText()).toLowerCase().includes('did not read'),
    'and the heading says so rather than sitting over a list that said nothing',
  );
  check(
    (await page.locator('#result-tally').innerText()).includes('Read: 0'),
    'and the count agrees with the list under it',
  );
}

/* ---- the release notes page, reached the way a reader reaches it ---- */
await page.goto(`${server.origin}/whats-new`);
await page.waitForTimeout(150);
const notes = await page.locator('main').innerText();
check(notes.includes('Every release'), 'the release-notes page is a page in this app');
check(!/github|gitlab/i.test(await page.content()), 'and it links to no code host');

/* ---- what's new, on an upgrade ----
 *
 * The storage is seeded ONCE, on the page, and NOT through an init script on
 * the context. An init script runs on every load in that context including the
 * reload below — so the first version of this re-seeded the old version on the
 * way back in and then reported that dismissing the panel does not stick. The
 * harness was undoing the thing it was measuring.
 */
const upgraded = await context.newPage();
await upgraded.goto(`${server.origin}/`);
await upgraded.evaluate(() => {
  try {
    globalThis.localStorage.setItem('solvent.notes-seen', '0.0.1');
    globalThis.localStorage.setItem('solvent.welcomed', 'yes');
  } catch { /* nothing to do */ }
});
await upgraded.reload();
await upgraded.waitForTimeout(250);
check(await upgraded.locator('#whats-new[open]').isVisible(), 'a returning reader on a new version IS shown what changed');
const panel = await upgraded.locator('#whats-new').innerText();
check(/still missing/i.test(panel), 'and the panel says what is still missing, not only what was fixed');
check(
  (await upgraded.locator('#whats-new-list > li').count()) <= 5,
  'and the panel is bounded at five',
  `${String(await upgraded.locator('#whats-new-list > li').count())} shown`,
);
// DISMISS, then reload: the version is written on dismiss, so a reader who
// closed it is not shown it again — and one who reloaded past it is.
await upgraded.locator('#whats-new button[data-close]').click();
await upgraded.waitForTimeout(100);
await upgraded.reload();
await upgraded.waitForTimeout(250);
check(!(await upgraded.locator('#whats-new[open]').count()), 'dismissing it means it does not come back');
await upgraded.close();

/* ---- the network dropped, and a REAL reload ----
 *
 * THIS LINE USED TO ASSERT THE OPPOSITE. Until there was a service worker the
 * honest thing was to record that the app does NOT load offline, so the absence
 * stayed known rather than being rediscovered by somebody on a bus. It loads
 * now, and the full stale-app path — a first visit not being reloaded or told,
 * a returning reader being told, the open page staying on the release it
 * started on until the reader presses the control — is driven against a REAL
 * second worker by `tools/update-walk.mjs`. This is the shallow half, here so
 * the primary journey carries it too.
 */
await page.evaluate(async () => {
  // The worker has to have installed before there is anything to be offline
  // with, and the walk is faster than a first install.
  await globalThis.navigator.serviceWorker?.ready;
});
await context.setOffline(true);
const offlinePage = await context.newPage();
let reachedOffline = true;
try {
  await offlinePage.goto(`${server.origin}/`, { timeout: 8000 });
  await offlinePage.waitForTimeout(200);
} catch {
  reachedOffline = false;
}
check(reachedOffline, 'the app opens with the network gone');
if (reachedOffline) {
  check(
    (await offlinePage.locator('[data-surface="welcome"], #topics').count()) > 0,
    'and it is the app rather than a browser error page',
  );
}
await offlinePage.close();
await context.setOffline(false);

/* ---- nothing threw, anywhere ---- */
check(thrown.length === 0, 'nothing threw during the whole walk', thrown.join(' | '));

await browser.close();
await server.stop();

for (const { ok, what, detail } of steps) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail === '' ? '' : `  (${detail})`}`);
}

if (findings.length === 0) {
  console.log(`\n${String(steps.length)} step(s), walked rather than assumed.\n`);
  process.exit(0);
}
console.error(`\n${String(findings.length)} finding(s).\n`);
process.exit(1);
