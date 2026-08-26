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
 * ## What it refuses to generate
 *
 * A release with no "still missing" line. §7d: an app that lists only its fixes
 * is an advertisement, and the open items a reader would otherwise rediscover
 * belong beside the fixes. That is checked here rather than remembered, because
 * the release where somebody is proudest is the release it gets left off.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(REPO, 'CHANGELOG.md');
const TARGET = join(REPO, 'src/report/releases.ts');

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
 */
export const OLDER_THAN_SHOWN = ${olderThanShown};

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

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    console.error('\nsrc/report/releases.ts is missing. Run: node tools/changelog.mjs\n');
    process.exit(1);
  }
  if (current !== generated) {
    console.error(
      '\nsrc/report/releases.ts has drifted from CHANGELOG.md.\n' +
        'The notes are generated from one source so the app cannot tell a reader about\n' +
        'a change that is not in the build they are running. Run: node tools/changelog.mjs\n',
    );
    process.exit(1);
  }
  console.log(
    `\n=== release notes · Solve-ent ===\n\n` +
      `  ok    ${all.length} release(s) in CHANGELOG.md, ${shown.length} carried by the app, ${olderThanShown} on the page\n` +
      `  ok    every release says what is still missing\n` +
      `  ok    src/report/releases.ts matches its source\n`,
  );
  process.exit(0);
}

writeFileSync(TARGET, generated);
console.log(
  `wrote src/report/releases.ts — ${shown.length} of ${all.length} release(s), ${olderThanShown} on ${NOTES_PAGE}`,
);
