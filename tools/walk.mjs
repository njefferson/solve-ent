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
import { correctEntryFor } from '../src/engine/taxonomy.ts';
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

/* ---- working ---- */
await page.locator('#topics button').first().click();
await page.waitForTimeout(150);
check((await visibleSurface(page)).join() === 'work', 'picking a topic starts the run');
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
  // Advance the shadow only where the screen advanced, so a disagreement shows
  // up as the walk stopping rather than as the two silently diverging.
  const stillHere = (await page.locator('#step-prompt').innerText()) === stage.prompt;
  if (stillHere && !(await page.locator('#diagnosis').isHidden())) {
    check(false, 'a correct entry was marked wrong by the screen', `${stage.id}: "${entry.kind === 'text' ? entry.text : String(entry.option)}"`);
    break;
  }
  shadow = submit(shadow, entry, { now: () => 0 }).session;
  stepsDriven += 1;
}
check(stepsDriven > 0, 'correct answers are accepted and carry the run forward', `${String(stepsDriven)} step(s)`);
check((await visibleSurface(page)).join() === 'done', 'the run finishes');
const closing = await page.locator('#closing').innerText();
check(closing.trim().length > 0, 'and says what happened', closing.slice(0, 70).replace(/\n/g, ' | '));
check(!/\b\d+\s*(?:\/|out of)\s*\d+\b/.test(closing), 'with no fraction of right answers');
check(!/\b(?:streak|badge|great job|well done)\b/i.test(closing), 'and nothing congratulating anybody');

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

/* ---- the network dropped, and a REAL reload ---- */
await context.setOffline(true);
const offlinePage = await context.newPage();
let reachedOffline = true;
try {
  await offlinePage.goto(`${server.origin}/`, { timeout: 5000 });
} catch {
  reachedOffline = false;
}
// THERE IS NO SERVICE WORKER YET, so this is expected to fail — and it is
// reported as a fact rather than skipped, because the day one is added this
// line is what says whether it works.
check(
  !reachedOffline,
  'offline: the app does NOT load — there is no service worker yet, and this line is how that stays known',
  reachedOffline ? 'it loaded, which means a worker was added and this expectation is now stale' : 'as expected',
);
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
