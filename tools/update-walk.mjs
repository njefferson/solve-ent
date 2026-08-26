#!/usr/bin/env node
/**
 * update-walk.mjs — the stale-app path, driven by a REAL second worker.
 *
 *   node tools/update-walk.mjs
 *
 * ## Why this exists even though the hub's pwa gate passes
 *
 * That gate says so itself: it reads source text and cannot run the app, so it
 * catches NEVER IMPLEMENTED and not "implemented subtly wrong". It cannot tell a
 * worker that waits from one that appears to, and it cannot tell a strip that
 * appears from one that appears **on a first visit**, which is the thing this
 * app got wrong on its first attempt.
 *
 * So this serves release A, installs it, then serves a genuinely different
 * release B from the same origin, and walks what a reader actually experiences.
 *
 * ## What it refuses to accept
 *
 * **A strip on a first visit.** Being told about an update on the visit where
 * you arrived is being told about a version you never had.
 *
 * **A reload nobody asked for.** `clients.claim()` fires `controllerchange` on a
 * first install exactly as a replacement does, so a naive reload-on-change
 * reloads every newcomer. That defect was real here and is asserted below.
 *
 * **A page that changed under the reader.** Until the control is pressed, the
 * open page must still be release A — markup and modules together. A worker that
 * took over during install would leave old markup calling new modules with
 * nothing said, which is what §7h.1 is about and what shipped in a sibling app
 * for twenty-two releases.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const findings = [];
const steps = [];
const check = (ok, what, detail = '') => {
  steps.push({ ok, what, detail });
  if (!ok) findings.push(`${what}${detail === '' ? '' : ` — ${detail}`}`);
};

/**
 * Two releases of the site, in one directory that is swapped between them.
 *
 * The ORIGIN has to stay the same, because a service worker's scope is an
 * origin and a second origin would be a second app. So release B is written
 * over release A in place while the browser is still open — which is exactly
 * what a deploy looks like from the browser's side.
 */
const stage = join(tmpdir(), `solvent-update-${process.pid}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(REPO, 'public'), stage, { recursive: true });

const RELEASE_A = /const CACHE_NAME = '([^']+)'/.exec(readFileSync(join(stage, 'sw.js'), 'utf8'))?.[1];
const RELEASE_B = `${RELEASE_A ?? 'solvent'}-next`;

/** Make the staged copy a genuinely different release. */
function stageReleaseB() {
  const swPath = join(stage, 'sw.js');
  writeFileSync(
    swPath,
    readFileSync(swPath, 'utf8').replace(`const CACHE_NAME = '${RELEASE_A}'`, `const CACHE_NAME = '${RELEASE_B}'`),
  );
  // Something a reader could actually see, so "the open page is still release A"
  // is an observation rather than an article of faith.
  const indexPath = join(stage, 'index.html');
  writeFileSync(
    indexPath,
    readFileSync(indexPath, 'utf8').replace('<h1 class="wordmark">Solve-ent</h1>', '<h1 class="wordmark">Solve-ent B</h1>'),
  );
}

console.log('\n=== the stale-app path, with a real second worker · Solve-ent ===\n');

if (!existsSync(join(stage, 'sw.js'))) {
  console.error('there is no service worker to walk.\n');
  process.exit(1);
}

const server = await serve(stage);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const thrown = [];
page.on('pageerror', (error) => thrown.push(String(error)));

/* ---- release A, first visit ---- */
let reloads = 0;
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) reloads += 1;
});
await page.goto(`${server.origin}/`);
await page.waitForFunction(() => globalThis.navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
  .catch(() => {});
await page.waitForTimeout(600);

const navigationsAfterFirstLoad = reloads - 1;
check(
  navigationsAfterFirstLoad === 0,
  'a first visit is NOT reloaded when the worker takes control',
  `${String(navigationsAfterFirstLoad)} extra navigation(s)`,
);
check(
  await page.locator('#update-strip').isHidden(),
  'and a first visit is NOT told about an update it never missed',
);
check(
  (await page.evaluate(() => (globalThis.caches ? globalThis.caches.keys() : []))).includes(RELEASE_A ?? ''),
  'release A is cached under a name carrying its version',
  RELEASE_A ?? '(none)',
);

/* ---- it works with the network gone ---- */
await context.setOffline(true);
const offline = await context.newPage();
let offlineOk = true;
try {
  await offline.goto(`${server.origin}/`, { timeout: 8000 });
  await offline.waitForTimeout(300);
} catch {
  offlineOk = false;
}
check(offlineOk, 'the app opens with the network gone');
if (offlineOk) {
  check((await offline.locator('#topics, [data-surface="welcome"]').count()) > 0, 'and it is the app, not an error page');
  await offline.click('#begin').catch(() => {});
  await offline.waitForTimeout(200);
  check((await offline.locator('#topics button').count()) === 7, 'and it still works offline — seven topics');
}
const notesOffline = await context.newPage();
let notesOk = true;
try {
  await notesOffline.goto(`${server.origin}/whats-new`, { timeout: 8000 });
} catch {
  notesOk = false;
}
check(notesOk, 'and the release-notes page is there offline too');
await offline.close();
await notesOffline.close();
await context.setOffline(false);

/* ---- release B is deployed ---- */
stageReleaseB();
reloads = 0;
await page.evaluate(async () => {
  const registration = await globalThis.navigator.serviceWorker.getRegistration();
  await registration?.update();
});
await page
  .waitForFunction(() => !document.getElementById('update-strip')?.hidden, null, { timeout: 15000 })
  .catch(() => {});

// EVERY STEP BELOW DEPENDS ON THE STRIP HAVING APPEARED, so whether it did is
// established once and the rest are guarded by it. The first version of this
// walked straight on and died in Playwright's click timeout — a thirty-line
// stack trace, a non-zero exit, and not one word about what was wrong. A gate
// that fails without saying why costs the next person the whole diagnosis, and
// on THIS gate the likeliest cause is a worker that took over during install,
// which is the exact thing the file exists to catch.
const offered = await page.locator('#update-strip').isVisible();
check(offered, 'a returning reader IS told a newer version is ready');

// THIS IS THE skipWaiting()-IN-INSTALL SIGNATURE, and it is worth naming
// separately: the strip never appears because there was never a waiting worker
// to tell anybody about — the new one took over instead.
if (!offered) {
  const controlled = await page.evaluate(
    () => globalThis.navigator.serviceWorker.controller?.scriptURL ?? '(none)',
  );
  const wordmark = (await page.locator('.wordmark').innerText()).trim();
  check(
    false,
    'nothing was waiting to be released',
    wordmark === 'Solve-ent B'
      ? 'the page is ALREADY release B — the new worker took over without asking, which is skipWaiting() during install'
      : `no waiting worker and the page is still ${wordmark}; controller ${controlled}`,
  );
  check(reloads === 0, 'and nothing reloaded on its own', `${String(reloads)} navigation(s)`);
}

if (offered) {
  const said = await page.locator('#update-said').innerText();
  check(/new(er)? version/i.test(said), 'in words a reader can see', said.slice(0, 60));
  check(
    (await page.locator('#update-strip').evaluate((n) => n.tagName)) !== 'DIALOG',
    'as a standing strip rather than a dialog that has to be dismissed',
  );

  /* ---- and the open page is STILL release A until the reader says so ---- */
  check(reloads === 0, 'nothing reloaded on its own', `${String(reloads)} navigation(s)`);
  check(
    (await page.locator('.wordmark').innerText()).trim() === 'Solve-ent',
    'and the open page is still the release the reader started on',
    'old markup with new modules underneath is the failure §7h.1 is about',
  );
  check(
    (await page.evaluate(() => (globalThis.caches ? globalThis.caches.keys() : []))).includes(RELEASE_A ?? ''),
    'with release A still cached, so nothing has been swapped underneath it',
  );

  /* ---- "not now" leaves the reader alone ---- */
  await page.click('#update-later');
  await page.waitForTimeout(200);
  check(await page.locator('#update-strip').isHidden(), '"Not now" puts it away');
  check(reloads === 0, 'and still nothing reloaded');

  /* ---- the reader takes it ---- */
  await page.evaluate(() => {
    const strip = document.getElementById('update-strip');
    if (strip !== null) strip.hidden = false;
  });
  await page.click('#update-take');
}
if (offered) {
  await page
    .waitForFunction(() => document.querySelector('.wordmark')?.textContent?.trim() === 'Solve-ent B', null, {
      timeout: 15000,
    })
    .catch(() => {});

  check(
    (await page.locator('.wordmark').innerText()).trim() === 'Solve-ent B',
    'pressing the control brings the new version in',
  );
  const held = await page.evaluate(() => (globalThis.caches ? globalThis.caches.keys() : []));
  check(held.includes(RELEASE_B), 'the new release is cached under its own name', held.join(', '));
  check(!held.includes(RELEASE_A ?? ''), 'and the old cache is gone rather than kept forever');
}

check(thrown.length === 0, 'nothing threw during the whole path', thrown.join(' | '));

await browser.close();
await server.stop();
rmSync(stage, { recursive: true, force: true });

for (const { ok, what, detail } of steps) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail === '' ? '' : `  (${detail})`}`);
}
if (findings.length === 0) {
  console.log(`\n${String(steps.length)} step(s), against a real second worker.\n`);
  process.exit(0);
}
console.error(`\n${String(findings.length)} finding(s).\n`);
process.exit(1);
