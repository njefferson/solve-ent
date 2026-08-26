#!/usr/bin/env node
/**
 * copy-check.mjs — the four rules about WORDS, held by a gate rather than by
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
 * ## Rule two: never tell a reader the fault is in them
 *
 * **An app that fails to teach must not leave a kid concluding they cannot be
 * taught.** That is the failure this whole repository is aimed at, one level up
 * — a student who has been told longest that they are bad at maths, using a
 * tool that quietly agrees.
 *
 * So the copy never locates the problem in the person. Not their effort, not
 * their attention, not their capacity. Every diagnosis this app makes is about
 * a MOVE — *that went upside down* — and never about who made it. This is the
 * mirror image of the praise ban rather than a separate idea: praise and blame
 * are both statements about a person where a statement about a move belongs.
 *
 * Two words are banned that look harmless and are not. "Simply" and
 * "obviously" tell a reader that what they could not do was easy, which means
 * the only thing left to explain the failure is them. Bare "just" is NOT
 * banned: it usually means *only* — "apply just that first conversion" — and a
 * gate with false positives on ordinary copy teaches people to word things
 * around it.
 *
 * ## Rule three: do not assume a classroom
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
 * ## Rule four: the release notes are for the people who use this
 *
 * **Homeschool teachers and students are the core audience of `CHANGELOG.md`**,
 * not programmers and not whoever wrote the commit. A note naming a function, a
 * type, a filename or a gate is a note written for the wrong person — and it is
 * written that way by default, because the person writing it has just spent
 * hours inside those names.
 *
 * So the changelog is scanned for what a programmer's note LOOKS like rather
 * than for how it reads: identifiers in backticks, camelCase and
 * SCREAMING_SNAKE tokens, and `.ts` or `.mjs` filenames. Those are values, not
 * wording — a check on the wording would fire on the prose explaining the rule.
 *
 * ## The release notes the app CARRIES are held to rule four, not rules one to
 * three — and this is the interesting one
 *
 * `src/report/releases.ts` is generated from `CHANGELOG.md` and lives under
 * `src/`, so the first version of this scanned it like any other source file.
 * It failed. On the 0.2.0 note, whose entire job is to tell a reader that this
 * app has **no streaks**.
 *
 * **A gate that bans a word cannot scan the copy that exists to say the word is
 * absent.** The two lines it caught are the product keeping its promise, said
 * out loud to the person it is a promise to, and the only way to word around
 * the gate is to stop saying it — which would make the note worse in exactly
 * proportion to how well the gate is working.
 *
 * So the artefact is scanned under rule four, which is the rule that actually
 * applies to it, since release notes are what it is. Rules one to three are
 * about copy addressed to somebody about their own work: praise, blame and an
 * assumed classroom are register errors in a sentence spoken TO a student
 * mid-run. A release note is about the app, and describing an absence requires
 * naming it.
 *
 * NOT AN EXEMPTION, and the difference is the whole point: the file is scanned,
 * in this run, and the line saying so is printed. What changes is which rules,
 * and only its STRING LITERALS are read — the generated header names a filename
 * on two lines and none of that reaches anybody.
 *
 * ## Regex literals are stripped too, and for the same reason
 *
 * A harness that asserts the banned words are ABSENT has to write them down:
 *
 *     check(!/streak|badge|great job/i.test(closing), 'nothing congratulating anybody')
 *
 * That line is the rule being enforced, and this gate failed on it four times in
 * one sitting — on the release notes, on a test about accommodations, on the
 * §7f diagnostic, and on the walk. Every one of them was the same shape, and
 * every one of them was the rule keeping itself.
 *
 * A REGEX LITERAL IS A PATTERN, NOT COPY. Nothing inside `/…/` is ever shown to
 * anybody, so it is removed before matching, exactly as comments are. This is a
 * rule about SYNTAX rather than an exemption for a file — the same file's plain
 * strings are still read, so a harness that actually printed praise would still
 * be caught.
 *
 * The stripping is CONSERVATIVE about what counts as a regex, because `/` is
 * also division: only a literal preceded by an operator, a bracket, a comma or
 * the start of an expression, containing no unescaped `/`. Anything ambiguous
 * is left in and therefore still scanned, which is the direction that fails
 * closed.
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

/**
 * The release notes the app carries, generated from CHANGELOG.md.
 *
 * Held to rule four rather than to rules one to three — see the header. It is
 * scanned in this same run and the fact is printed; what changes is which rules
 * apply, because a release note describing what this app refuses to do has to
 * name the thing it refuses.
 */
const GENERATED_NOTES = 'src/report/releases.ts';

/** Rule one, with what each pattern is for. */
const PRAISE = [
  [/\bstreaks?\b/i, 'a streak makes stopping feel like failing'],
  [/\bbadges?\b/i, 'a badge is a thing to chase instead of a thing to learn'],
  [/\b(?:score|scored|scoring|high\s*score)\b/i, 'a score is a number about a person, not about a mistake'],
  // POINTS AS A REWARD, never the bare word. `points` on its own fired on
  // `maxTouchPoints` in the §7f diagnostic — the one property that tells an
  // iPad from a Mac, since iPadOS Safari reports itself as macOS, so the
  // doctrine effectively requires that line to exist. A hardware count is not a
  // number about a person, and a gate that cannot tell the difference gets
  // worded around rather than obeyed. Same shape as the release notes needing
  // to say "streaks" (hub LESSONS §146): the ban is on a MEANING and the
  // pattern can only see a spelling, so the pattern has to carry the meaning.
  [/\b\d+\s*points?\b|\bpoints?\s+(?:earned|awarded|scored|so\s+far)\b|\b(?:earn|win|lose|collect)\s+points?\b|\byour\s+points?\b/i,
    'points are a thing to chase instead of a thing to learn'],
  [/\btrophy|trophies|medals?|stars?\s+earned\b/i, 'an award is a congratulation'],
  [/\b(?:great|nice|good|well|awesome|amazing|excellent|brilliant|perfect)\s+(?:job|work|going|done|one)\b/i, 'praise'],
  [/\bkeep\s+it\s+up\b|\byou'?re\s+on\s+a\s+roll\b|\bwell\s+done\b/i, 'praise'],
  [/\b\d+\s*(?:\/|out\s+of)\s*\d+\b/, 'a fraction is the "five out of seven" this app does not say'],
  [/\b(?:you\s+got|got)\s+\d+\s+(?:right|correct|wrong)\b/i, 'a count of right answers'],
  [/\bgoal\b|\btargets?\s+(?:of|is|reached)\b|\bmilestones?\b/i, 'a target makes stopping short of it a failure'],
];

/**
 * Rule two. Never locate the failure in the reader.
 *
 * Narrow on purpose, and each of these is a sentence somebody writes in good
 * faith while trying to be encouraging.
 */
const BLAME = [
  [/\byou\s+should\s+(?:know|have|be\s+able\s+to)\b/i, 'tells a reader what they ought already to be'],
  [/\btry\s+harder\b|\bpay\s+attention\b|\bconcentrate\b/i, 'makes it a question of effort'],
  [/\b(?:this|that|it)(?:'|\u2019)?s?\s+(?:is\s+)?(?:easy|simple|straightforward|basic)\b/i,
    'calling it easy leaves only the reader to explain why it was not'],
  [/\byou\s+(?:always|never|keep)\b/i, 'a statement about a person where one about a move belongs'],
  [/\byou(?:'|\u2019)?re\s+not\s+(?:getting|understanding|listening)\b/i, 'locates the failure in the reader'],
  [/\bstill\s+(?:don'?t|do\s+not|can'?t|cannot)\s+(?:get|understand|see)\b/i, 'locates the failure in the reader'],
  [/\bsimply\b|\bobviously\b|\bof\s+course\b|\beveryone\s+knows\b/i,
    'tells a reader that what they could not do was easy'],
];

/** Rule three. Anchored on ADDRESS, never on the bare word. */
const CLASSROOM = [
  [/\byour\s+teacher\b/i, 'assumes a teacher — a homeschooler has none'],
  [/\b(?:ask|tell|show|give|hand)\s+(?:it\s+|this\s+)?(?:to\s+)?your\s+teacher\b/i, 'assumes a teacher'],
  [/\bhand\s+(?:it|this)\s+in\b/i, 'assumes a class to hand it in to'],
  [/\byour\s+(?:class|classroom|teacher'?s)\b/i, 'assumes a room'],
  [/\bgradebook\b/i, 'names a system not everyone has'],
  [/\b(?:canvas|schoology|google\s+classroom|powerschool)\b/i, 'names one school’s software'],
  [/\byour\s+(?:homework|assignment)\s+is\s+due\b/i, 'assumes a due date somebody else set'],
];

/**
 * Rule four, over CHANGELOG.md only. What a note written for a programmer looks
 * like, in shapes rather than in words.
 */
const DEVELOPER_VOICE = [
  [/`[A-Za-z_$][\w$]*\(\)`/, 'names a function'],
  [/`[a-z]+[A-Z]\w*`/, 'names something in camelCase'],
  [/`[A-Z][A-Z0-9]*_[A-Z0-9_]*`/, 'names a constant'],
  [/[\w/.-]+\.(?:ts|mjs|js|json|yml)\b/, 'names a file'],
  [/\bnpm run\b|\bgit \w+\b/, 'gives a command'],
  [/\brefactor(?:ed|ing)?\b|\bcodebase\b|\bAPI\b|\brepo(?:sitory)?\b/i, 'a word from the wrong vocabulary'],
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

/**
 * Remove regex literals. A pattern is not copy — see the header.
 *
 * Only where the `/` opens an expression: after `(`, `[`, `{`, `,`, `=`, `:`,
 * `!`, `&`, `|`, `?`, `;`, `+`, `return`, or the start of a line. `/` is also
 * division, and a stripper that guessed wrong in the other direction would
 * silently delete real copy — so anything ambiguous stays in and is scanned.
 */
function stripRegexLiterals(source) {
  return source.replace(
    /(^|[(\[{,=:!&|?;+]\s*)\/(?![*/])((?:\\.|\[(?:\\.|[^\]])*\]|[^\\/\n])+)\/[gimsuyd]*/g,
    (_match, before) => `${before}/…/`,
  );
}

const files = sourceFiles().filter((file) => {
  const where = relative(REPO, file);
  return where !== SELF && where !== GENERATED_NOTES;
});
const findings = [];
let scanned = 0;

for (const file of files) {
  const where = relative(REPO, file);
  const stripped = stripRegexLiterals(stripComments(readFileSync(file, 'utf8')));
  scanned += 1;
  const lines = stripped.split('\n');
  lines.forEach((line, i) => {
    for (const [pattern, why] of [...PRAISE, ...BLAME, ...CLASSROOM]) {
      if (pattern.test(line)) findings.push({ where, line: i + 1, why, text: line.trim().slice(0, 90) });
    }
  });
}

/* ---- rule four, over the release notes: the source AND the artefact ---- */
const CHANGELOG = join(REPO, 'CHANGELOG.md');
let notesLines = 0;
try {
  const notes = readFileSync(CHANGELOG, 'utf8');
  notes.split('\n').forEach((line, i) => {
    notesLines += 1;
    for (const [pattern, why] of DEVELOPER_VOICE) {
      if (pattern.test(line)) findings.push({ where: 'CHANGELOG.md', line: i + 1, why, text: line.trim().slice(0, 90) });
    }
  });
} catch {
  findings.push({ where: 'CHANGELOG.md', line: 0, why: 'there are no release notes at all', text: '' });
}

// And the generated artefact, by its STRING LITERALS, because that is the part
// a reader ever sees. Generated from the same source, so this should never fire
// on its own — but "should never" is what a check is for, and the generator is
// a program that could one day carry a filename through into a line.
let notesStrings = 0;
try {
  const artefact = readFileSync(join(REPO, GENERATED_NOTES), 'utf8');
  const lines = artefact.split('\n');
  lines.forEach((line, i) => {
    for (const [, literal] of line.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      const text = literal.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
      notesStrings += 1;
      for (const [pattern, why] of DEVELOPER_VOICE) {
        if (pattern.test(text)) {
          findings.push({ where: GENERATED_NOTES, line: i + 1, why, text: text.trim().slice(0, 90) });
        }
      }
    }
  });
} catch {
  // Missing is not silent: reported below with the roots that do not exist.
  notesStrings = -1;
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
  console.log(`  ok    nothing telling a reader the fault is in them`);
  console.log(`  ok    nothing addressed to a reader who is assumed to be in a classroom`);
  console.log(`  ok    ${notesLines} lines of release notes, none of them written for a programmer`);
  if (notesStrings < 0) {
    console.log(`  note  ${GENERATED_NOTES} is missing — the notes the app carries were not checked`);
  } else {
    console.log(
      `  ok    ${notesStrings} written line(s) in ${GENERATED_NOTES}, held to the same rule\n` +
        `        (and to that rule ONLY — a note saying this app has no streaks has to say "streaks")`,
    );
  }
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
    'An app that fails to teach must not leave a kid concluding they cannot be taught,\n' +
    'so nothing here locates the failure in the reader. And a reader without a\n' +
    'teacher is not a reader this app turns away.\n',
);
process.exit(1);
