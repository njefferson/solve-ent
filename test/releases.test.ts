/**
 * releases.test.ts — the release notes the app carries.
 *
 * Three things, and the first is the one that gets undone by accident: the list
 * is BOUNDED. A what's-new panel that grows by accumulation eventually becomes
 * the app, and the release where somebody adds "just this one more" is the
 * release nobody notices.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_SHOWN,
  NOTES_PAGE,
  OLDER_THAN_SHOWN,
  RELEASES,
  type Release,
} from '../src/report/releases.ts';
import { VERSION } from '../src/version.ts';

const changelog = (): string => readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

test('the app carries the current release and four more, and no more than that', () => {
  assert.equal(MAX_SHOWN, 5, 'what changed, plus four for context');
  assert.ok(RELEASES.length <= MAX_SHOWN, `the app carries ${RELEASES.length} releases`);
  assert.ok(RELEASES.length >= 1, 'the app carries no release notes at all');
});

test('the newest note is the version actually running', () => {
  // The whole point of a what's-new panel is that it describes the build in
  // front of the reader. A panel one release behind is a panel telling somebody
  // about a change they do not have.
  assert.equal(RELEASES[0]?.version, VERSION, `the notes lead with ${RELEASES[0]?.version} and the app is ${VERSION}`);
});

test('every carried release says what changed AND what is still missing', () => {
  for (const release of RELEASES) {
    assert.ok(release.lines.length > 0, `${release.version} says nothing about what changed`);
    for (const written of release.lines) {
      assert.ok(written.trim().length > 0, `${release.version} carries an empty line`);
    }
    // An app that lists only its fixes is an advertisement.
    assert.ok(
      release.stillMissing.trim().length > 10,
      `${release.version} lists only what was fixed`,
    );
    assert.ok(
      ['VERSION', 'CAPABILITY', 'ITERATION'].includes(release.kind),
      `${release.version} is a ${release.kind} release`,
    );
  }
});

test('the notes carry no markup and no developer vocabulary', () => {
  // GENERATED FROM MARKDOWN, so the stripping is a real step that can fail
  // rather than an assumption. What reaches a reader is words.
  for (const release of RELEASES) {
    for (const written of [...release.lines, release.stillMissing]) {
      assert.ok(!/[*`]/.test(written), `${release.version} carries markup: ${written}`);
      assert.ok(!/\]\(/.test(written), `${release.version} carries a raw link: ${written}`);
      assert.ok(
        !/[\w/.-]+\.(?:ts|mjs|js|json|yml)\b/.test(written),
        `${release.version} names a file: ${written}`,
      );
      assert.ok(!/`?[a-z]+[A-Z]\w*\(\)/.test(written), `${release.version} names a function: ${written}`);
    }
  }
});

test('the page the rest live on is in this app, and is never a code host', () => {
  // Somebody who wants to know what changed in a maths trainer should not land
  // in a repository. Asserted on the VALUE rather than trusted to a comment,
  // because this is the line somebody edits when a page is slow to build and a
  // link to the source feels like a reasonable stopgap.
  assert.ok(NOTES_PAGE.startsWith('/'), `${NOTES_PAGE} is not a path in this app`);
  assert.ok(!NOTES_PAGE.startsWith('//'), `${NOTES_PAGE} points at another host`);
  assert.ok(!/:\/\//.test(NOTES_PAGE), `${NOTES_PAGE} is an absolute URL`);
  for (const host of ['github', 'gitlab', 'bitbucket', 'sourceforge', 'codeberg']) {
    assert.ok(!NOTES_PAGE.toLowerCase().includes(host), `${NOTES_PAGE} names a code host`);
  }
});

test('the app knows how many releases it is NOT showing', () => {
  // So it can say so. A panel showing five with no hint that there are more
  // implies five is all there has ever been.
  const inSource = changelog().split(/^## /m).length - 1;
  assert.equal(
    OLDER_THAN_SHOWN,
    Math.max(0, inSource - RELEASES.length),
    'the count of what is on the page disagrees with what is in the source',
  );
  assert.ok(OLDER_THAN_SHOWN >= 0);
});

test('the notes have not drifted from their one source', () => {
  // The generator's `--check` is what enforces this on every commit; this is
  // the same fact asserted where a test run can see it, because a repository
  // whose only drift check lives in a commit hook is a repository that drifts
  // the first time somebody commits without the hook installed.
  const source = changelog();
  for (const release of RELEASES) {
    assert.ok(
      source.includes(`## ${release.version} — ${release.kind}`),
      `${release.version} is in the app and not in CHANGELOG.md`,
    );
  }
  // Newest first, and the order is the source's order.
  const order = [...source.matchAll(/^## (\S+) — /gm)].map((m) => m[1]);
  assert.deepEqual(
    RELEASES.map((r: Release) => r.version),
    order.slice(0, RELEASES.length),
    'the app lists releases in a different order from the source',
  );
});
