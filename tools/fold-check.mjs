/**
 * fold-check.mjs — is it on the screen, or only in the document?
 *
 * ## Why this exists
 *
 * Every other browser gate in this repository runs at 390x844 — a phone with
 * nothing covering it. **That is not the device this app is used on when things
 * go wrong.** A tablet or a phone with the keyboard up has roughly 380 usable
 * pixels of height, and in that viewport this app has twice shipped a control
 * that was correct, measured, contrast-checked, target-checked, axe-clean and
 * completely invisible:
 *
 * - The calculator sat under the answer box, below the button that checks the
 *   step. A whole work screen was read and reported as having no calculator.
 * - Before that, the diagnosis — the entire product — rendered under a keyboard
 *   that the code had just put back over it.
 *
 * **Conformance is not reachability** (Doctrine §4, hub LESSONS §95). Every
 * accessibility measure this repository takes is defined for input methods in
 * general and answers "is what is rendered legible". None of them asks the
 * question a finger asks, which is *can I see it without scrolling*.
 *
 * MoleBridge got here first: it drives a wrong step at 390x380 and requires the
 * reason to be inside the viewport. This is that check, generalised to a
 * DECLARED LIST, so a new control has to join the list rather than quietly not
 * being measured — the same discipline `tools/a11y.mjs` applies to surfaces.
 *
 * ## Two strengths, because they are two different promises
 *
 * **`pressed`** — the whole box is inside the viewport. For anything a finger
 * has to hit: half a button is not a button.
 *
 * **`seen`** — the top edge is inside the viewport. For prose. A long diagnosis
 * may run past the fold and that is fine; a reader who can see it starting will
 * scroll. A reader who cannot see it at all does not know it is there, which is
 * the defect.
 *
 * ## The top of the screen is not y = 0
 *
 * **THE FIRST VERSION OF THIS GATE CERTIFIED SOMETHING HIDDEN BEHIND THE
 * HEADER.** Making the chrome sticky — which this gate's own first finding
 * required — put an opaque bar over the top 65px of the viewport, and a
 * programmatic scroll to the diagnosis landed its top edge at 8px. Fully on
 * screen by the arithmetic, fully invisible to a reader.
 *
 * So the usable area is measured from the sticky chrome's own box on the page
 * being tested, rather than assumed. A gate with the same blind spot as the
 * defect it hunts is worse than no gate: it certifies the thing it was built to
 * find.
 */

import { chromium } from 'playwright';
import { serve } from './serve.mjs';

/** A small phone with the keyboard up. MoleBridge's number, adopted. */
const VIEWPORT = { width: 390, height: 380 };

/** Get one step wrong on purpose, so the diagnosis is on screen. */
async function wrongStep(page, answer = '#answer', entry = '#entry', panel = '#diagnosis') {
  if ((await page.locator(answer).count()) > 0) {
    await page.fill(answer, '0.00042');
    await page.locator(`${entry} .primary`).click();
    return;
  }
  for (let i = 0; i < 6; i += 1) {
    const buttons = page.locator(`${entry} .choice`);
    if ((await buttons.count()) === 0) return;
    await buttons.first().click();
    if (!(await page.locator(panel).isHidden())) return;
  }
}

async function startRun(page) {
  if (await page.locator('#begin').isVisible()) await page.click('#begin');
  await page.locator('#topics button').first().click();
  const difficulties = page.locator('#difficulties button');
  if ((await difficulties.count()) > 0) await difficulties.first().click();
}

/**
 * WHAT HAS TO BE ON THE SCREEN, AND WHERE.
 *
 * Every entry is a moment a reader is actually in, not a surface that exists.
 * Adding a control to the chrome or to a step means adding it here, and a
 * control absent from this list is a control this gate cannot fail on.
 */
const MOMENTS = [
  {
    name: 'a step, before answering',
    why: 'the three things a reader needs to make one move: what to type, the way to send it, and the way to work it out',
    async reach(page) {
      await startRun(page);
    },
    pressed: ['#open-calc', '#open-report'],
    seen: ['#step-prompt'],
  },
  {
    name: 'a step got wrong',
    why: 'attribution is the product, and the reason is the product',
    async reach(page) {
      await startRun(page);
      await wrongStep(page);
    },
    seen: ['#diagnosis'],
    pressed: ['#open-calc'],
  },
  {
    name: 'a drill step got wrong',
    why: 'the drill has its own diagnosis panel, and it is the same shape as the one that failed this gate first',
    async reach(page) {
      if (await page.locator('#begin').isVisible()) await page.click('#begin');
      await page.click('#to-drill');
      await page.locator('#moves button').first().click();
      await wrongStep(page, '#drill-answer', '#drill-entry', '#drill-diagnosis');
    },
    seen: ['#drill-diagnosis'],
    pressed: ['#open-calc'],
  },
  {
    name: 'a drill step',
    why: 'the drill is its own screen and the same three things have to be on it',
    async reach(page) {
      if (await page.locator('#begin').isVisible()) await page.click('#begin');
      await page.click('#to-drill');
      await page.locator('#moves button').first().click();
    },
    pressed: ['#open-calc', '#open-report'],
    seen: ['#drill-question'],
  },
];

const server = await serve(new URL('../public', import.meta.url).pathname);
const browser = await chromium.launch();
const findings = [];
let measured = 0;

for (const moment of MOMENTS) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${server.origin}/`);
  await moment.reach(page);
  await page.waitForTimeout(40);

  // WHERE THE SCREEN ACTUALLY STARTS. Read off the page rather than assumed:
  // the chrome is sticky, so everything under it is on screen and unreadable.
  const ceiling = await page.evaluate(() => {
    const bar = document.querySelector('.bar');
    if (bar === null) return 0;
    return getComputedStyle(bar).position === 'sticky' ? Math.round(bar.getBoundingClientRect().bottom) : 0;
  });

  for (const [strength, selectors] of [
    ['pressed', moment.pressed ?? []],
    ['seen', moment.seen ?? []],
  ]) {
    for (const selector of selectors) {
      measured += 1;
      const node = page.locator(selector).first();
      if ((await node.count()) === 0) {
        findings.push({ moment: moment.name, selector, why: 'is not in the document at all here' });
        continue;
      }
      const box = await node.boundingBox();
      if (box === null) {
        findings.push({ moment: moment.name, selector, why: 'has no box — hidden, or laid out nowhere' });
        continue;
      }
      const bottom = strength === 'pressed' ? box.y + box.height : box.y;
      // The chrome itself is the ceiling and cannot be under it.
      const floor = selector === '.bar' || (await node.evaluate((el) => el.closest('.bar') !== null)) ? 0 : ceiling;
      if (box.y < floor) {
        const under = Math.round(floor - box.y);
        findings.push({
          moment: moment.name,
          selector,
          why:
            box.y < 0
              ? `starts ${String(Math.round(-box.y))}px ABOVE the top of the screen`
              : `starts ${String(under)}px UNDER the sticky bar — on the screen by arithmetic, behind an opaque strip to a reader`,
        });
      } else if (bottom > VIEWPORT.height) {
        const over = Math.round(bottom - VIEWPORT.height);
        findings.push({
          moment: moment.name,
          selector,
          why:
            strength === 'pressed'
              ? `is ${String(over)}px past the bottom of the screen — a finger cannot reach it without scrolling`
              : `starts ${String(over)}px past the bottom of the screen — a reader does not know it is there`,
        });
      }
    }
  }
  await context.close();
}

await browser.close();
await server.stop?.();

console.log(`\n=== on the screen, not just in the document · Solve-ent ===\n`);
console.log(`  Measured at ${String(VIEWPORT.width)}x${String(VIEWPORT.height)} — a small phone with the keyboard up.\n`);

if (findings.length === 0) {
  console.log(`  ok    ${String(measured)} thing(s) a reader needs, all reachable without scrolling`);
  console.log('\nConformance is not reachability. This is the reachability half.\n');
  process.exit(0);
}

for (const finding of findings) {
  console.log(`  FAIL  ${finding.moment}`);
  console.log(`        ${finding.selector} ${finding.why}`);
}
console.log(
  `\n${String(findings.length)} of ${String(measured)} unreachable. A control nobody can see is not a control,\n` +
    `and its presence in the source answers "is this handled" for everybody after.\n`,
);
process.exit(1);
