#!/usr/bin/env node
/**
 * changelog.mjs — the release notes, from ONE source.
 *
 *   node tools/changelog.mjs           write src/report/releases.ts
 *   node tools/changelog.mjs --check   fail if it has drifted from CHANGELOG.md
 *
 * ## Why generate rather than type
 *
 * Doctrine §7d: notes maintained separately from the release drift from it, and
 * the drift is invisible. `CHANGELOG.md` is the source; the app reads what this
 * writes; nothing is typed twice. `--check` runs on EVERY COMMIT through
 * `.branch-guard`, because a generated artefact in the tree is a generated
 * artefact that goes stale in the tree.
 *
 * ## Why it is BOUNDED, and this is the part worth reading
 *
 * A list that grows by accumulation eventually becomes the app. What a reader
 * wants on opening a new build is *what changed*, and a little context for how
 * recently the rest changed — not an archive. So the app carries the newest
 * {@link MAX_SHOWN} releases and nothing else, and it is told how many it is
 * NOT showing so it can say so honestly rather than implying five is all there
 * has ever been.
 *
 * The rest live on a page in the app itself. **Never a link off to a code
 * host** — somebody who wants to know what changed in a maths trainer should
 * not land in a repository, and a test refuses any link that leaves the app.
 *
 * ## Two outputs, one source, and that is the whole point
 *
 * The PANEL carries {@link MAX_SHOWN} releases, because it interrupts somebody
 * who came to do maths. The PAGE carries every release, because that is what
 * "the rest live on a page" means and a page that also stopped at five would
 * make `OLDER_THAN_SHOWN` a number pointing at nothing.
 *
 * Both are written here, from `CHANGELOG.md`, and both are drift-checked. The
 * alternative — a hand-maintained page — is the same two-lists problem this
 * file exists to remove, one level along: the panel would say five things and
 * the page would say four of them and something from a version nobody shipped.
 *
 * The page is plain HTML with no script. Somebody landing on it from a link
 * should read it, not boot an application to be told what changed in it.
 *
 * ## What it refuses to generate
 *
 * A release with no "still missing" line. §7d: an app that lists only its fixes
 * is an advertisement, and the open items a reader would otherwise rediscover
 * belong beside the fixes. That is checked here rather than remembered, because
 * the release where somebody is proudest is the release it gets left off.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(REPO, 'CHANGELOG.md');
const TARGET = join(REPO, 'src/report/releases.ts');
const PAGE = join(REPO, 'public/whats-new/index.html');

/** How many releases the app itself carries. The current one plus four. */
export const MAX_SHOWN = 5;

/** The page the rest live on. In the app; never a code host. */
const NOTES_PAGE = '/whats-new';

const KINDS = ['VERSION', 'CAPABILITY', 'ITERATION'];

/**
 * Markdown down to the words, since the app renders text and not markup.
 *
 * WHITESPACE IS COLLAPSED FIRST, and the order is the whole of it. Emphasis in
 * a wrapped source file spans a line break, and `.` does not match a newline —
 * so stripping before collapsing leaves the asterisks on exactly the sentences
 * somebody bothered to emphasise, which is to say the headline of every
 * release. Caught by the test that reads what actually reaches a reader.
 */
function plain(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')
    .trim();
}

/** Read CHANGELOG.md into releases, newest first. */
function parse(source) {
  const releases = [];
  const blocks = source.split(/^## /m).slice(1);
  for (const block of blocks) {
    const [heading = '', ...rest] = block.split('\n');
    const match = /^(\S+)\s+—\s+(\S+)/.exec(heading.trim());
    if (match === null) throw new Error(`a release heading this cannot read: "## ${heading.trim()}"`);
    const [, version, kind] = match;
    if (!KINDS.includes(kind)) {
      throw new Error(`${version} is a ${kind} release, and the kinds are ${KINDS.join(', ')}`);
    }

    const body = rest.join('\n');
    const lines = [];
    let stillMissing = '';
    // Paragraphs and bullets, in order. A "still missing" paragraph is pulled
    // out rather than left in the list, because the app shows it differently:
    // what changed reads as news, what is missing reads as a caveat, and
    // running them together makes the caveat look like a feature.
    for (const chunk of body.split(/\n\s*\n/)) {
      const trimmed = chunk.trim();
      if (trimmed === '') continue;
      if (/^\*\*Still missing/i.test(trimmed)) {
        stillMissing = plain(trimmed).replace(/^Still missing[^:]*:\s*/i, '');
        continue;
      }
      if (trimmed.startsWith('- ')) {
        for (const bullet of trimmed.split(/\n(?=- )/)) lines.push(plain(bullet.replace(/^- /, '')));
        continue;
      }
      lines.push(plain(trimmed));
    }
    releases.push({ version, kind, lines, stillMissing });
  }
  return releases;
}

const source = readFileSync(SOURCE, 'utf8');
const all = parse(source);

/* ---- what every release owes a reader ---- */
const missing = all.filter((release) => release.stillMissing === '');
if (missing.length > 0) {
  console.error(
    `\nThese releases list only what was fixed: ${missing.map((r) => r.version).join(', ')}.\n` +
      'An app that lists only its fixes is an advertisement. Every entry says what is\n' +
      'still missing, so a reader does not have to rediscover it (Doctrine §7d).\n',
  );
  process.exit(1);
}

const shown = all.slice(0, MAX_SHOWN);
const olderThanShown = all.length - shown.length;

const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const generated = `/**
 * releases.ts — GENERATED by tools/changelog.mjs. Do not edit here.
 *
 * The source is CHANGELOG.md, and there is exactly one. Notes maintained
 * separately from the release drift from it, and the drift is invisible until a
 * reader is told about a change that is not in the build they are running.
 *
 * BOUNDED at ${MAX_SHOWN}: what changed, and four before it. A list that grows by
 * accumulation eventually becomes the app. Everything older lives at
 * {@link NOTES_PAGE}, which is a page in this app — never a link off to a code
 * host, because somebody who wants to know what changed in a maths trainer
 * should not land in a repository.
 *
 * Regenerate: node tools/changelog.mjs
 * Check: node tools/changelog.mjs --check   (runs on every commit)
 */

/** Which slot of the version moved, and therefore what kind of change it was. */
export type ReleaseKind = 'VERSION' | 'CAPABILITY' | 'ITERATION';

/** One release, in the words a reader would use for it. */
export interface Release {
  readonly version: string;
  readonly kind: ReleaseKind;
  /** What changed. Never empty. */
  readonly lines: readonly string[];
  /** What is still missing. Never empty either — see the generator's header. */
  readonly stillMissing: string;
}

/** How many releases the app carries: the current one plus four. */
export const MAX_SHOWN = ${MAX_SHOWN};

/** The page the rest live on. A path in this app, never another site. */
export const NOTES_PAGE = ${quote(NOTES_PAGE)};

/**
 * How many releases exist that are NOT in the list below.
 *
 * Carried so the app can say so. A panel showing five with no hint that there
 * are more implies five is all there has ever been, which is a small lie that
 * costs nothing to avoid.
 *
 * ANNOTATED \`number\` ON PURPOSE. Without it this infers the literal type of
 * whatever today's count happens to be, and the screen's branch on it becomes a
 * comparison between two literals — which type-checks while the count is one
 * value and fails the day it changes. It failed on the release that first made
 * it non-zero, which is also the first release on which that branch had ever
 * been reachable.
 */
export const OLDER_THAN_SHOWN: number = ${olderThanShown};

/** Newest first. */
export const RELEASES: readonly Release[] = [
${shown
  .map(
    (release) => `  {
    version: ${quote(release.version)},
    kind: ${quote(release.kind)},
    lines: [
${release.lines.map((l) => `      ${quote(l)},`).join('\n')}
    ],
    stillMissing: ${quote(release.stillMissing)},
  },`,
  )
  .join('\n')}
];
`;

/* ---- the page, which carries every release ---- */
const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>What changed — Solve-ent</title>
<meta name="description" content="Every release of Solve-ent, in the words somebody using it would use, including what is still missing from each.">
<meta name="theme-color" content="#1a1a1a">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/app.css">
<!-- GENERATED by tools/changelog.mjs from CHANGELOG.md. Do not edit here.
     No application: somebody landing here from a link should read the page, not
     boot an app to be told what changed in it. The one script is the shared
     first-frame file, which also paints the status bar — a static theme-color
     is wrong in whichever mode it was not written for, and this page has no
     application to correct it afterwards. -->
<script src="/js/theme.js"></script>
</head>
<body>
<a class="skip" href="#main">Skip to the list</a>
<header class="bar">
  <h1 class="wordmark">Solve-ent</h1>
  <a class="ghost" href="/">Back to the questions</a>
</header>
<main id="main" tabindex="-1">
<section data-surface="notes">
<h2 tabindex="-1">Every release</h2>
<p>Newest first. Written for the people who use this, not for programmers: if a release changed something you can see or do, it says so in the words you would use; if it changed something under the surface, it says that plainly.</p>
<p class="aside">Every release also says what is <strong>still missing</strong>, because a list of only fixes is an advertisement.</p>
<ul class="releases">
${all
  .map(
    (release) => `  <li>
    <h3>${escape(release.version)}</h3>
    <ul>
${release.lines.map((line) => `      <li>${escape(line)}</li>`).join('\n')}
    </ul>
    <p class="still-missing">Still missing: ${escape(release.stillMissing)}</p>
  </li>`,
  )
  .join('\n')}
</ul>
</section>
</main>
</body>
</html>
`;

if (process.argv.includes('--check')) {
  const failures = [];
  const compare = (path, want, label) => {
    let current = null;
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      failures.push(`${label} is missing. Run: node tools/changelog.mjs`);
      return;
    }
    if (current !== want) failures.push(`${label} has drifted from CHANGELOG.md`);
  };
  compare(TARGET, generated, 'src/report/releases.ts');
  compare(PAGE, page, 'public/whats-new/index.html');

  console.log(
    `\n=== release notes · Solve-ent ===\n`,
  );
  if (failures.length === 0) {
    console.log(`  ok    ${all.length} release(s) in CHANGELOG.md, ${shown.length} in the panel, all ${all.length} on the page`);
    console.log('  ok    every release says what is still missing');
    console.log(`  ok    the panel and the page both match their one source`);
    console.log('\nOne source, two outputs, so the panel and the page cannot say different things.\n');
    process.exit(0);
  }
  for (const failure of failures) console.log(`  FAIL  ${failure}`);
  console.error(
    '\nThe notes are generated from one source so the app cannot tell a reader about a\n' +
      'change that is not in the build they are running, and so the panel and the page\n' +
      'cannot disagree. Run: node tools/changelog.mjs\n',
  );
  process.exit(1);
}

writeFileSync(TARGET, generated);
mkdirSync(dirname(PAGE), { recursive: true });
writeFileSync(PAGE, page);
console.log(
  `wrote src/report/releases.ts (${shown.length} of ${all.length}) and public/whats-new/index.html (all ${all.length}), page at ${NOTES_PAGE}`,
);
