/**
 * cli.ts — the command-line harness.
 *
 * **THIS IS NOT A STUDENT SURFACE. IT PRINTS ANSWERS.** It exists so the engine
 * can be exercised end to end by somebody changing it, and it says so on every
 * command that shows one. There is no student-facing anything in this
 * repository yet, and when there is, nothing in it will call this file.
 *
 *   node tools/cli.ts problem --topic UNITS --tier 2 --index 0
 *   node tools/cli.ts stages  --topic REARRANGE --tier 3 --index 4
 *   node tools/cli.ts diagnose --topic POWERS --tier 1 --index 0 --stage W3 --entry "0.051 mol/(L·s)"
 *   node tools/cli.ts session --topic PROPORTION --tier 2 --count 3
 *   node tools/cli.ts drill   --topic PROPORTION --tier 2 --count 8 --wrong E-PROP-INVERTED --until 5
 *   node tools/cli.ts scan    --count 500
 *
 * `scan` is the one that prints the two numbers this project is measured by:
 * the taxonomy collision count, which must be zero, and the E-UNCLASSIFIED
 * rate, which is reported rather than suppressed.
 */

import {
  TIERS,
  posesTier,
  TOPICS,
  generateProblem,
  generationReport,
  solve,
  statedValues,
  type Problem,
  type Topic,
} from '../src/engine/problem.ts';
import {
  classify,
  collisionsFor,
  correctEntryFor,
  predictionsFor,
  remediesFor,
  REMEDIES,
  requiredSigFigs,
  stagesFor,
  type Collision,
  type ErrorClass,
  type Stage,
} from '../src/engine/taxonomy.ts';
import { readRun, type Attempt } from '../src/report/drill.ts';
import {
  completionCounts,
  controllableClock,
  currentProblem,
  currentStage,
  startSession,
  submit,
  type SessionConfig,
} from '../src/engine/steps.ts';
import { SCRATCH_SIG_FIGS } from '../src/engine/tolerance.ts';
import { formatUnit } from '../src/num/units.ts';
import { APP_NAME, VERSION } from '../src/version.ts';

const argv = process.argv.slice(2);
const command = argv[0] ?? '';

function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] !== undefined ? (argv[at + 1] as string) : fallback;
}

function topicFlag(fallback: Topic): Topic {
  const given = flag('topic', fallback).toUpperCase();
  const found = TOPICS.find((t) => t === given);
  if (found === undefined) {
    console.error(`unknown topic "${given}" — one of ${TOPICS.join(', ')}`);
    process.exit(2);
  }
  return found;
}

const line = (text = '') => console.log(text);
const rule = () => line('─'.repeat(72));

/** The answers banner. Printed wherever this file shows one. */
function answersWarning(): void {
  line('  (this harness prints answers — it is not a student surface)');
}

function showProblem(problem: Problem): void {
  rule();
  line(`  ${problem.topic} · tier ${problem.tier} · ${problem.answerSigFigs} significant figures`);
  rule();
  line();
  line(`  ${problem.prompt}`);
  const stated = statedValues(problem);
  if (stated.length > 0) {
    line();
    for (const value of stated) {
      line(`    ${value.symbol} = ${value.written}${value.unit.num.length > 0 ? ` ${formatUnit(value.unit)}` : ''}   ${value.label}`);
    }
  }
  line();
}

function showStages(problem: Problem, withAnswers: boolean): void {
  const solution = solve(problem);
  for (const stage of stagesFor(problem)) {
    line(`  ${stage.id}  [${stage.counter}]  ${stage.kind}${stage.gradesSigFigs ? ' · graded on figures' : ''}`);
    line(`      ${stage.prompt}`);
    for (const [i, option] of (stage.options ?? []).entries()) line(`        ${i + 1}. ${option}`);
    if (withAnswers) {
      const entry = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
      line(`      ANSWER: ${entry.kind === 'choice' ? `option ${entry.option + 1}` : entry.text}`);
      const predicted = predictionsFor(problem, solution, stage);
      for (const prediction of predicted.predictions) {
        const shown =
          prediction.choice !== undefined
            ? `option ${prediction.choice + 1}`
            : prediction.sigFigs !== undefined
              ? `the right value at ${prediction.sigFigs} figures`
              : String(prediction.value);
        line(`        ${prediction.errorClass.padEnd(24)} ${shown}`);
      }
      for (const drop of predicted.dropped) {
        line(`        ${drop.errorClass.padEnd(24)} (dropped — it lands on the correct answer)`);
      }
    }
    line();
  }
}

switch (command) {
  case 'problem': {
    const problem = generateProblem(
      flag('key', 'CLI'),
      topicFlag('REARRANGE'),
      Number(flag('tier', '2')),
      Number(flag('index', '0')),
    );
    showProblem(problem);
    break;
  }

  case 'stages': {
    const problem = generateProblem(
      flag('key', 'CLI'),
      topicFlag('REARRANGE'),
      Number(flag('tier', '2')),
      Number(flag('index', '0')),
    );
    showProblem(problem);
    answersWarning();
    line();
    showStages(problem, true);
    const solution = solve(problem);
    line(`  working (shown only after an attempt):`);
    for (const step of solution.working) line(`    ${step}`);
    line();
    break;
  }

  case 'diagnose': {
    const problem = generateProblem(
      flag('key', 'CLI'),
      topicFlag('REARRANGE'),
      Number(flag('tier', '2')),
      Number(flag('index', '0')),
    );
    const solution = solve(problem);
    const wanted = flag('stage', '');
    const stages = stagesFor(problem);
    const stage = (wanted === '' ? stages[stages.length - 1] : stages.find((s) => s.id === wanted)) as Stage;
    if (stage === undefined) {
      console.error(`no stage "${wanted}" — this problem has ${stages.map((s) => s.id).join(', ')}`);
      process.exit(2);
    }
    const text = flag('entry', '');
    const asChoice = /^\d+$/.test(text) && stage.kind === 'CHOICE';
    const entry = asChoice
      ? ({ kind: 'choice', option: Number(text) - 1 } as const)
      : ({ kind: 'text', text } as const);

    showProblem(problem);
    line(`  ${stage.id}: ${stage.prompt}`);
    for (const [i, option] of (stage.options ?? []).entries()) line(`      ${i + 1}. ${option}`);
    line();
    line(`  entered: ${text}`);
    const result = classify(problem, solution, stage, entry);
    line();
    if (result.correct) {
      line('  CORRECT');
    } else {
      line(`  ${result.collision ? 'COLLISION — two classes matched, which is a defect' : result.errorClass}`);
      line(`  that ${result.why}`);
      if (result.matched.length > 1) line(`  matched: ${result.matched.join(', ')}`);
      const remedies = remediesFor(result.errorClass ?? 'E-UNCLASSIFIED', result.logError);
      for (const remedy of remedies) line(`  → ${remedy}: ${REMEDIES[remedy]}`);
    }
    if (result.logError !== null) line(`  (log10 of the error: ${result.logError.toFixed(3)})`);
    line();
    break;
  }

  case 'session': {
    const config: SessionConfig = {
      assignmentKey: flag('key', 'CLI'),
      topic: topicFlag('PROPORTION'),
      tier: Number(flag('tier', '2')),
      count: Number(flag('count', '2')),
      mode: 'assignment',
      rosterNumber: Number(flag('roster', '17')),
    };
    // An INJECTED clock, here as everywhere. Nothing in this repository reads
    // the time from anywhere else, so a run of this harness is reproducible.
    const clock = controllableClock(0);
    let session = startSession(config, clock);
    answersWarning();
    line();
    let steps = 0;
    while (!session.finished) {
      const problem = currentProblem(session);
      const solution = solve(problem);
      const stage = currentStage(session);
      if (session.stageIndex === 0) showProblem(problem);
      const entry = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
      const result = submit(session, entry, clock);
      line(
        `    ${stage.id.padEnd(4)} ${stage.counter.padEnd(10)} ` +
          `${entry.kind === 'choice' ? `option ${entry.option + 1}` : entry.text}` +
          `${result.classification.correct ? '' : `  ← ${result.classification.errorClass}`}`,
      );
      session = result.session;
      steps += 1;
      clock.advance(20_000);
    }
    const counts = completionCounts(session, clock);
    line();
    rule();
    line(`  ${steps} steps · ${counts.rightFirstTime} right first time · ${Math.round(counts.elapsedMs / 1000)}s`);
    line(`  roster number ${counts.rosterNumber} — the only identity this app has`);
    for (const [skill, count] of Object.entries(counts.wrongBySkill)) {
      line(`    ${skill.padEnd(10)} ${count} wrong`);
    }
    rule();
    line();
    break;
  }

  case 'drill': {
    // A DRILL IS A LOOP AROUND THE CLASSIFIER. No session, no completion code,
    // nothing recorded — which is the whole reason blocked practice costs
    // almost nothing to build, and is only true while `classify` stays a pure
    // function of (problem, stage, entry).
    //
    // It is here to drive `readRun` against REAL classifications. Until this
    // existed the cadence had only ever been exercised by hand-built fixtures,
    // which is the shape of a check that agrees with whoever wrote it.
    const topic = topicFlag('PROPORTION');
    const tier = Number(flag('tier', '2'));
    const count = Number(flag('count', '8'));
    // Which misconception the simulated student holds, and when they stop
    // holding it. `--until 0` means they never do.
    const held = flag('wrong', '') as ErrorClass | '';
    const until = Number(flag('until', String(count)));

    answersWarning();
    line();
    const attempts: Attempt[] = [];
    for (let index = 0; index < count; index += 1) {
      const problem = generateProblem(flag('key', 'CLI'), topic, tier, index);
      const solution = solve(problem);
      // The LAST stage of each problem, which is the one the whole topic is
      // about. A real drill picks the stage by skill; this picks one.
      const stages = stagesFor(problem).filter((s) => s.kind === 'NUMERIC');
      const stage = stages[stages.length - 1];
      if (stage === undefined) continue;

      const correct = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
      let entry = correct;
      if (held !== '' && index < until) {
        const predicted = predictionsFor(problem, solution, stage).predictions.find(
          (p) => p.errorClass === held && p.value !== undefined,
        );
        if (predicted !== undefined) {
          const text = (predicted.value as number).toPrecision(Math.max(6, requiredSigFigs(problem, solution)));
          entry = { kind: 'text', text: stage.needsUnit ? `${text} ${formatUnit(stage.unit)}` : text };
        }
      }

      const result = classify(problem, solution, stage, entry);
      attempts.push({ skill: stage.counter, errorClass: result.correct ? null : result.errorClass });
      line(
        `  ${String(index + 1).padStart(2)}. ${stage.id.padEnd(4)} ` +
          `${(entry.kind === 'text' ? entry.text : '').padEnd(22)} ` +
          `${result.correct ? 'right' : (result.errorClass ?? 'COLLISION')}`,
      );
      // The notes are said AS THEY FIRE, which is the whole point of the
      // cadence — a note that only appears in a summary is not said during the
      // run at all.
      for (const note of readRun(attempts).notes) {
        if (note.afterAttempt === index) line(`      → ${note.text}`);
      }
    }

    const outcome = readRun(attempts);
    line();
    rule();
    for (const closing of outcome.closing) line(`  ${closing}`);
    rule();
    line();
    break;
  }

  case 'scan': {
    const per = Number(flag('count', '500'));
    const collisions: Collision[] = [];
    const rejections: Record<string, number> = {};
    const byClass: Record<string, number> = {};
    let problems = 0;
    let predictions = 0;
    let entries = 0;
    let unclassified = 0;

    for (const topic of TOPICS) {
      for (const tier of TIERS) {
        if (!posesTier(topic, tier)) continue;
        for (let index = 0; index < per; index += 1) {
          const problem = generateProblem('CLI-SCAN', topic, tier, index);
          const solution = solve(problem);
          problems += 1;
          collisions.push(...collisionsFor(problem, solution));
          for (const [name, count] of Object.entries(generationReport('CLI-SCAN', topic, tier, index).rejected)) {
            rejections[name] = (rejections[name] ?? 0) + count;
          }
          for (const stage of stagesFor(problem)) {
            const predicted = predictionsFor(problem, solution, stage);
            predictions += predicted.predictions.length;
            if (stage.kind !== 'NUMERIC') continue;
            const correct = predicted.correctValue;
            if (correct === null) continue;
            const required = requiredSigFigs(problem, solution);
            const candidates = [
              ...predicted.predictions.filter((p) => p.sigFigs === undefined).map((p) => p.value as number),
              correct * 1.02,
              correct * 0.97,
              correct * 1.1,
              correct * 10,
            ];
            for (const value of candidates) {
              if (!Number.isFinite(value)) continue;
              const text = `${value.toPrecision(Math.max(6, required))}${stage.needsUnit ? ` ${formatUnit(stage.unit)}` : ''}`;
              const result = classify(problem, solution, stage, { kind: 'text', text });
              if (result.correct) continue;
              entries += 1;
              const name = result.collision ? 'COLLISION' : (result.errorClass as string);
              byClass[name] = (byClass[name] ?? 0) + 1;
              if (name === 'E-UNCLASSIFIED') unclassified += 1;
            }
          }
        }
      }
    }

    rule();
    line(`  ${APP_NAME} ${VERSION} · scan`);
    rule();
    line();
    line(`  problems scanned        ${problems}`);
    line(`  predicted wrong values  ${predictions}`);
    line(`  TAXONOMY COLLISIONS     ${collisions.length}${collisions.length === 0 ? '' : '   ← a defect in the decomposition'}`);
    line(`  wrong entries judged    ${entries}`);
    line(
      `  E-UNCLASSIFIED          ${unclassified} (${((unclassified / entries) * 100).toFixed(2)}%)`,
    );
    line();
    line('  by class:');
    for (const [name, count] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) {
      line(`    ${name.padEnd(24)} ${count}`);
    }
    line();
    line('  candidates the generator refused, by guarantee:');
    for (const [name, count] of Object.entries(rejections).sort((a, b) => b[1] - a[1])) {
      line(`    ${name.padEnd(28)} ${count}`);
    }
    line();
    for (const collision of collisions.slice(0, 10)) {
      line(`  COLLISION  ${collision.topic}/${collision.stage}  ${collision.classes.join(' vs ')}  at ${collision.value}`);
    }
    if (collisions.length > 0) process.exit(1);
    break;
  }

  default:
    console.error(
      `unknown command "${command}" — try problem, stages, diagnose, session or scan.\n` +
        `Topics: ${TOPICS.join(', ')}. Tiers: ${TIERS.join(', ')}.`,
    );
    process.exit(2);
}
