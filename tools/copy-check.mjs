#!/usr/bin/env node
/**
 * copy-check.mjs — the two rules about WORDS, held by a gate rather than by
 * whoever is editing the file at the time.
 *
 *   node tools/copy-check.mjs
 *
 * ## Rule one: no score, no streak, no target, no congratulation
 *
 * Streaks, badges, points and fractions teach a student to chase the animation
 * and make stopping feel like failing. That is exactly wrong for the person who
 * most needs to do twenty of these, who is usually the one who has been told
 * longest that they are bad at it.
 *
 * **This is the rule a later session undoes in one well-meaning commit.** It is
 * an afternoon's work to add a streak counter and it feels like kindness. So it
 * is a gate.
 *
 * ## Rule two: do not assume a classroom
 *
 * Homeschoolers are a real audience and the structure already serves them; the
 * WORDS are what excludes them. "Your teacher", "hand this to your teacher",
 * anything naming a gradebook or a learning-management system. Same code, same
 * features, no second mode — just copy that does not assume a room.
 *
 * Note what is NOT banned: the word "teacher" on its own. This app is built for
 * one, the repository documentation says so, and a rule that fired on that
 * would push people into writing around it. What is banned is SECOND-PERSON
 * ADDRESS assuming one — "your teacher", "ask your teacher", "hand it in".
 *
 * ## Comments are stripped first, and that is load-bearing
 *
 * The comments are exactly where the words that must NOT be built are written
 * down — this file's own header is four paragraphs of them. A gate that read
 * comments would fail on the prose explaining the rule, which is the failure
 * mode MoleBridge's permissions gate had: it matched a sentence promising to
 * obey it, and a gate that fails on its own documentation teaches people to
 * word things around it.
 *
 * Stripping is CONSERVATIVE, because a stripper that removes too much creates
 * false negatives and those are the ones this cannot afford: block comments come
 * out whole, and a line comment comes out only where the line is entirely a
 * comment, so `//` inside a URL cannot hide anything after it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where reader-facing words can live. Grows to `public/` when there is a screen. */
const ROOTS = ['src', 'tools'];

/**
 * This file is not scanned, and it is the only exemption.
 *
 * Its patterns ARE the banned words, so scanning it would fail on the list of
 * things the list exists to forbid. Named here rather than skipped quietly,
 * because a whole-file exemption is where material collects — that is the hub's
 * privacy gate's own history, where green meant "not looked at".
 */
const SELF = 'tools/copy-check.mjs';

/** Rule one, with what each pattern is for. */
const PRAISE = [
  [/\bstreaks?\b/i, 'a streak makes stopping feel like failing'],
  [/\bbadges?\b/i, 'a badge is a thing to chase instead of a thing to learn'],
  [/\b(?:points|score|scored|scoring|high\s*score)\b/i, 'a score is a number about a person, not about a mistake'],
  [/\btrophy|trophies|medals?|stars?\s+earned\b/i, 'an award is a congratulation'],
  [/\b(?:great|nice|good|well|awesome|amazing|excellent|brilliant|perfect)\s+(?:job|work|going|done|one)\b/i, 'praise'],
  [/\bkeep\s+it\s+up\b|\byou'?re\s+on\s+a\s+roll\b|\bwell\s+done\b/i, 'praise'],
  [/\b\d+\s*(?:\/|out\s+of)\s*\d+\b/, 'a fraction is the "five out of seven" this app does not say'],
  [/\b(?:you\s+got|got)\s+\d+\s+(?:right|correct|wrong)\b/i, 'a count of right answers'],
  [/\bgoal\b|\btargets?\s+(?:of|is|reached)\b|\bmilestones?\b/i, 'a target makes stopping short of it a failure'],
];

/** Rule two. Anchored on ADDRESS, never on the bare word. */
const CLASSROOM = [
  [/\byour\s+teacher\b/i, 'assumes a teacher — a homeschooler has none'],
  [/\b(?:ask|tell|show|give|hand)\s+(?:it\s+|this\s+)?(?:to\s+)?your\s+teacher\b/i, 'assumes a teacher'],
  [/\bhand\s+(?:it|this)\s+in\b/i, 'assumes a class to hand it in to'],
  [/\byour\s+(?:class|classroom|teacher'?s)\b/i, 'assumes a room'],
  [/\bgradebook\b/i, 'names a system not everyone has'],
  [/\b(?:canvas|schoology|google\s+classroom|powerschool)\b/i, 'names one school’s software'],
  [/\byour\s+(?:homework|assignment)\s+is\s+due\b/i, 'assumes a due date somebody else set'],
];

/** Every tracked source file under the roots. */
function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(?:ts|mjs|js|html|css)$/.test(name)) out.push(full);
    }
  };
  for (const root of ROOTS) {
    try {
      walk(join(REPO, root));
    } catch {
      // A root that does not exist yet is reported below, never skipped.
    }
  }
  return out;
}

/** Remove comments, conservatively. See the header. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

const files = sourceFiles().filter((file) => relative(REPO, file) !== SELF);
const findings = [];
let scanned = 0;

for (const file of files) {
  const where = relative(REPO, file);
  const stripped = stripComments(readFileSync(file, 'utf8'));
  scanned += 1;
  const lines = stripped.split('\n');
  lines.forEach((line, i) => {
    for (const [pattern, why] of [...PRAISE, ...CLASSROOM]) {
      if (pattern.test(line)) findings.push({ where, line: i + 1, why, text: line.trim().slice(0, 90) });
    }
  });
}

console.log('\n=== the words · Solve-ent ===\n');

// A GATE THAT SCANS NOTHING MUST SAY SO. There is no screen yet, so most of
// what this exists to cover does not exist — and a check reporting "no
// problems" over an empty set reads exactly like a check that passed.
const missing = ROOTS.filter((root) => {
  try {
    return !statSync(join(REPO, root)).isDirectory();
  } catch {
    return true;
  }
});
for (const root of missing) console.log(`  note  ${root}/ does not exist yet — nothing there was checked`);

if (findings.length === 0) {
  console.log(`  ok    ${scanned} file(s) scanned, comments stripped first`);
  console.log(`  ok    no score, no streak, no target, no congratulation`);
  console.log(`  ok    nothing addressed to a reader who is assumed to be in a classroom`);
  console.log('\nWhat replaces praise is change: say what happened, and say it stopped only where it did.\n');
  process.exit(0);
}

for (const finding of findings) {
  console.log(`  FAIL  ${finding.where}:${finding.line}  ${finding.why}`);
  console.log(`        ${finding.text}`);
}
console.error(
  `\n${findings.length} finding(s). A streak is an afternoon's work and feels like kindness;\n` +
    'it teaches a student to chase the animation and makes stopping feel like failing.\n' +
    'And a reader without a teacher is not a reader this app turns away.\n',
);
process.exit(1);
