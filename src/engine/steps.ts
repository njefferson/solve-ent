/**
 * steps.ts — one step at a time, each graded and diagnosed on its own.
 *
 * WHY STEP-GATED AT ALL. A student who gets a stoichiometry answer wrong has
 * made one mistake somewhere in six moves, and marking the answer tells them
 * nothing about which. Gating the steps is what makes attribution possible:
 * every entry is judged against the predictions for THAT move, so a diagnosis
 * names the move rather than the problem.
 *
 * THE ANSWER IS NEVER SHOWN BEFORE THE ATTEMPT. `correctEntryFor` and
 * `predictionsFor` are the grader's, and a `Problem` carries neither. That is
 * a fact about the types rather than about anybody remembering it, and it does
 * not stop applying when the delivery is audio: reading the question aloud is
 * reading the question, and a read-aloud that reached the answer would be the
 * same disclosure through a different channel.
 *
 * NO STUDENT PII, EVER. Identity here is a teacher-assigned roster number and
 * there is no other field for a person. Not a name, not an email, not a device
 * id, not a class period that narrows to one student.
 *
 * THERE IS NO ACCOMMODATION FIELD ON A SESSION, and its absence is deliberate.
 * Text size, spacing, one-step-at-a-time and read-aloud are DEVICE-LOCAL
 * preferences that never leave the device — so a session, which is the thing
 * that becomes a completion code and a teacher's report, has nowhere to put
 * one. A code carrying an accommodation would make a student disclose it by
 * using it, over a channel they cannot opt out of. Omitting it from the output
 * would be a rule to remember; omitting it from the TYPE is a rule that holds.
 *
 * NO DATE ACCESS OUTSIDE THE INJECTED CLOCK. A test that cannot control the
 * time cannot check anything that carries one.
 *
 * PURE apart from the clock handed to it.
 */

import { generateProblem, type Problem, type Solution, type Topic, solve } from './problem.ts';
import {
  classify,
  correctEntryFor,
  stagesFor,
  type Classification,
  type CounterSkill,
  type ErrorClass,
  type Stage,
  type StudentEntry,
} from './taxonomy.ts';
import { COUNTER_SKILLS } from './taxonomy.ts';
import { SCRATCH_SIG_FIGS } from './tolerance.ts';

/* ------------------------------------------------------------------ */
/* The clock                                                           */
/* ------------------------------------------------------------------ */

/** The only way anything here learns what time it is. */
export interface Clock {
  now(): number;
}

/** A clock stuck at one moment. */
export function fixedClock(atMs: number): Clock {
  return { now: () => atMs };
}

/** A clock a test can wind forward. */
export interface ControllableClock extends Clock {
  advance(byMs: number): void;
}

/** A clock a test can wind forward, starting at a stated moment. */
export function controllableClock(startMs: number): ControllableClock {
  let at = startMs;
  return {
    now: () => at,
    advance: (byMs: number) => {
      at += byMs;
    },
  };
}

/* ------------------------------------------------------------------ */
/* A session                                                           */
/* ------------------------------------------------------------------ */

/**
 * Which door a session came through.
 *
 * THE DOORS ARE A WALL, MADE VISIBLE. Practice will show an answer on request,
 * so if practice could also produce a completion code then "practice" would be
 * the route to credit for work the app did in front of you. The refusal lives
 * in {@link completionCounts}, which THROWS on a practice session rather than
 * returning something a caller is trusted to discard — a screen that must
 * remember not to render a button is not a wall; a function that refuses is.
 */
export type SessionMode = 'assignment' | 'practice';

/** What a session was started with. */
export interface SessionConfig {
  /**
   * The key the set is generated from — written on a board, in a message, or
   * at the top of a worksheet. The problems are a pure function of it, which is
   * what lets one key produce the same set for everybody working from it.
   */
  readonly assignmentKey: string;
  readonly topic: Topic;
  readonly tier: number;
  readonly count: number;
  readonly mode: SessionMode;
  /**
   * An assigned number from 1 to 4095, and the ONLY identity in this
   * application. Never a name. `null` in practice, where nothing is reported.
   *
   * Assigned by whoever set the work — which is a teacher in a classroom and is
   * not always a teacher. The words a reader sees never assume one.
   */
  readonly rosterNumber: number | null;
}

/** How many steps went wrong, per skill. */
export type SkillCounts = { readonly [K in CounterSkill]: number };

/** One working session. Plain data: numbers, booleans and a config of primitives. */
export interface Session {
  readonly config: SessionConfig;
  /** Which problem of the set. */
  readonly problemIndex: number;
  /** Which stage of that problem. */
  readonly stageIndex: number;
  /** Steps attempted, and steps right first time. */
  readonly attempted: number;
  readonly rightFirstTime: number;
  /** Whether the current step has already been attempted once. */
  readonly stageAttempted: boolean;
  /** Wrong steps by skill, which is what a report reads. */
  readonly wrongBySkill: SkillCounts;
  /** Wrong steps by class, which is what says whether the taxonomy is working. */
  readonly wrongByClass: Readonly<Record<string, number>>;
  readonly finished: boolean;
  /**
   * TIME ACCUMULATES ACROSS STRETCHES. `elapsedBeforeMs` is what earlier
   * stretches came to and `startedAtMs` is when this one began, so a student
   * who stops for forty minutes does not have forty minutes added to what
   * their session reports. The label on that number is "how long you had it
   * open", which a break is exactly not — and worse, a code showing two hours
   * for twenty minutes of work would make a student who took a break look like
   * they took ages, which is reporting the accommodation.
   */
  readonly elapsedBeforeMs: number;
  readonly startedAtMs: number;
}

const ZERO_SKILLS: SkillCounts = {
  SETUP: 0,
  REARRANGE: 0,
  SCALE: 0,
  EVALUATE: 0,
  UNITS: 0,
  PRECISION: 0,
};

/** A session that cannot be started. */
export class SessionError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'SessionError';
  }
}

/** The largest roster number that can be assigned. Twelve bits, and no name. */
export const MAX_ROSTER_NUMBER = 4095;

/**
 * Begin a set.
 *
 * PRECONDITION: `config.count` is at least 1, and in assignment mode
 * `rosterNumber` is an integer from 1 to {@link MAX_ROSTER_NUMBER}. Both are
 * checked rather than assumed, because the roster number is the one identity
 * this application has and a session carrying a bad one would report against
 * nobody.
 */
export function startSession(config: SessionConfig, clock: Clock): Session {
  if (config.count < 1) throw new SessionError('a set has at least one problem in it');
  if (config.mode === 'assignment') {
    const roster = config.rosterNumber;
    if (roster === null || !Number.isInteger(roster) || roster < 1 || roster > MAX_ROSTER_NUMBER) {
      throw new SessionError(`a roster number is a whole number from 1 to ${MAX_ROSTER_NUMBER}`);
    }
  }
  return {
    config,
    problemIndex: 0,
    stageIndex: 0,
    attempted: 0,
    rightFirstTime: 0,
    stageAttempted: false,
    wrongBySkill: ZERO_SKILLS,
    wrongByClass: {},
    finished: false,
    elapsedBeforeMs: 0,
    startedAtMs: clock.now(),
  };
}

/** How long the session has been worked on, across every stretch. */
export function elapsedFor(session: Session, clock: Clock): number {
  return session.elapsedBeforeMs + Math.max(0, clock.now() - session.startedAtMs);
}

/**
 * Pick a session back up after a break.
 *
 * PRECONDITION: `endedAtMs` is when the previous stretch stopped being worked
 * on. The stretch is FOLDED IN here, so `elapsedFor` stays a single reading —
 * two readings of "how long" is how the report and the screen come to disagree
 * about the same number.
 */
export function resumeSession(session: Session, clock: Clock, endedAtMs: number): Session {
  const stretch = Math.max(0, endedAtMs - session.startedAtMs);
  return { ...session, elapsedBeforeMs: session.elapsedBeforeMs + stretch, startedAtMs: clock.now() };
}

/** The problem the session is on. */
export function currentProblem(session: Session): Problem {
  return generateProblem(
    session.config.assignmentKey,
    session.config.topic,
    session.config.tier,
    session.problemIndex,
  );
}

/** The stage the session is on. */
export function currentStage(session: Session): Stage {
  const stages = stagesFor(currentProblem(session));
  const stage = stages[session.stageIndex];
  if (stage === undefined) throw new SessionError('this session has run off the end of its problem');
  return stage;
}

/** What one submission did. */
export interface SubmitResult {
  readonly session: Session;
  readonly classification: Classification;
  /** True where the session moved on to the next step. */
  readonly advanced: boolean;
}

/**
 * Submit one entry at the current step.
 *
 * PRECONDITION: `session.finished` is false.
 *
 * A wrong entry does NOT advance. The step stays where it is, diagnosed, and
 * the student tries again — which is the whole shape of the thing: a step is a
 * gate, and a gate that opens on a wrong answer is a list of questions.
 */
export function submit(session: Session, entry: StudentEntry, clock: Clock): SubmitResult {
  if (session.finished) throw new SessionError('this session is finished');
  const problem = currentProblem(session);
  const solution = solve(problem);
  const stages = stagesFor(problem);
  const stage = stages[session.stageIndex];
  if (stage === undefined) throw new SessionError('this session has run off the end of its problem');

  const classification = classify(problem, solution, stage, entry);
  const firstAttempt = !session.stageAttempted;

  if (!classification.correct) {
    const name = classification.errorClass ?? 'E-COLLISION';
    return {
      session: {
        ...session,
        stageAttempted: true,
        attempted: firstAttempt ? session.attempted + 1 : session.attempted,
        wrongBySkill: { ...session.wrongBySkill, [stage.counter]: session.wrongBySkill[stage.counter] + 1 },
        wrongByClass: { ...session.wrongByClass, [name]: (session.wrongByClass[name] ?? 0) + 1 },
      },
      classification,
      advanced: false,
    };
  }

  const lastStage = session.stageIndex + 1 >= stages.length;
  const lastProblem = session.problemIndex + 1 >= session.config.count;
  void clock;
  return {
    session: {
      ...session,
      attempted: firstAttempt ? session.attempted + 1 : session.attempted,
      rightFirstTime: firstAttempt ? session.rightFirstTime + 1 : session.rightFirstTime,
      stageAttempted: false,
      stageIndex: lastStage ? 0 : session.stageIndex + 1,
      problemIndex: lastStage ? session.problemIndex + 1 : session.problemIndex,
      finished: lastStage && lastProblem,
    },
    classification,
    advanced: true,
  };
}

/**
 * What a completion code would carry.
 *
 * THE WALL IS HERE, NOT ON A SCREEN. This THROWS on a practice session rather
 * than returning counts a caller is trusted to discard. Practice shows answers
 * on request, so a practice session that could produce a code would be a route
 * to credit for work the app did in front of you.
 *
 * WHAT IT CARRIES AND WHAT IT CANNOT. Counts, a roster number and a duration.
 * There is no field here for an answer the student typed, for a name, or for
 * an accommodation — and there is nowhere for one to be added without changing
 * this type, which is the point.
 *
 * PRECONDITION: `session.config.mode` is `assignment`.
 */
export interface CompletionCounts {
  readonly rosterNumber: number;
  readonly attempted: number;
  readonly rightFirstTime: number;
  readonly wrongBySkill: SkillCounts;
  readonly elapsedMs: number;
}

export function completionCounts(session: Session, clock: Clock): CompletionCounts {
  if (session.config.mode !== 'assignment') {
    throw new SessionError('a practice session has no completion code — practice will show you the answers');
  }
  const roster = session.config.rosterNumber;
  if (roster === null) throw new SessionError('an assignment session carries a roster number');
  return {
    rosterNumber: roster,
    attempted: session.attempted,
    rightFirstTime: session.rightFirstTime,
    wrongBySkill: session.wrongBySkill,
    elapsedMs: elapsedFor(session, clock),
  };
}

/**
 * Drive a session to the end, answering every step correctly.
 *
 * THE GRADER'S, and it is what the tests and the harness run on. It carries
 * {@link SCRATCH_SIG_FIGS} at every stage that does not grade figures, because
 * a simulated student who rounded an intermediate would trip
 * E-SIG-ROUND-EARLY by accident and the suite would be measuring its own
 * scratch paper rather than the engine.
 *
 * PRECONDITION: none. Returns the finished session, or throws if a correct
 * entry was ever refused — which is a defect in the grader, not in the driver.
 */
export function driveCorrectly(session: Session, clock: Clock): Session {
  let live = session;
  let guard = 0;
  while (!live.finished) {
    guard += 1;
    if (guard > 10000) throw new SessionError('this session will not finish');
    const problem = currentProblem(live);
    const solution = solve(problem);
    const stage = currentStage(live);
    const entry = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
    const result = submit(live, entry, clock);
    if (!result.advanced) {
      throw new SessionError(
        `the grader refused its own answer at ${problem.topic} ${stage.id}: ${result.classification.why}`,
      );
    }
    live = result.session;
  }
  return live;
}

/** Re-exported so a caller reads one definition. */
export { COUNTER_SKILLS, type CounterSkill, type ErrorClass, type Solution };
