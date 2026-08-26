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
import { generateProblem, posesTier, TOPIC_NAMES, solve } from './problem.js';
import { classify, correctEntryFor, stagesFor, } from './taxonomy.js';
import { COUNTER_SKILLS } from './taxonomy.js';
import { SCRATCH_SIG_FIGS } from './tolerance.js';
/** A clock stuck at one moment. */
export function fixedClock(atMs) {
    return { now: () => atMs };
}
/** A clock a test can wind forward, starting at a stated moment. */
export function controllableClock(startMs) {
    let at = startMs;
    return {
        now: () => at,
        advance: (byMs) => {
            at += byMs;
        },
    };
}
const ZERO_SKILLS = {
    SETUP: 0,
    REARRANGE: 0,
    SCALE: 0,
    EVALUATE: 0,
    UNITS: 0,
    PRECISION: 0,
};
/** A session that cannot be started. */
export class SessionError extends Error {
    constructor(detail) {
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
export function startSession(config, clock) {
    if (config.count < 1)
        throw new SessionError('a set has at least one problem in it');
    // THE DIFFICULTY IS CHECKED HERE RATHER THAN AT THE FIRST PROBLEM. Topics do
    // not all have the same number of difficulties, so a key or a screen naming
    // one a topic does not pose is a thing to say plainly at the start rather
    // than a generator throwing part-way into a set somebody has begun.
    if (!posesTier(config.topic, config.tier)) {
        throw new SessionError(`${TOPIC_NAMES[config.topic]} does not have that difficulty`);
    }
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
export function elapsedFor(session, clock) {
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
export function resumeSession(session, clock, endedAtMs) {
    const stretch = Math.max(0, endedAtMs - session.startedAtMs);
    return { ...session, elapsedBeforeMs: session.elapsedBeforeMs + stretch, startedAtMs: clock.now() };
}
/** The problem the session is on. */
export function currentProblem(session) {
    return generateProblem(session.config.assignmentKey, session.config.topic, session.config.tier, session.problemIndex);
}
/** The stage the session is on. */
export function currentStage(session) {
    const stages = stagesFor(currentProblem(session));
    const stage = stages[session.stageIndex];
    if (stage === undefined)
        throw new SessionError('this session has run off the end of its problem');
    return stage;
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
export function submit(session, entry, clock) {
    if (session.finished)
        throw new SessionError('this session is finished');
    const problem = currentProblem(session);
    const solution = solve(problem);
    const stages = stagesFor(problem);
    const stage = stages[session.stageIndex];
    if (stage === undefined)
        throw new SessionError('this session has run off the end of its problem');
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
export function completionCounts(session, clock) {
    if (session.config.mode !== 'assignment') {
        throw new SessionError('a practice session has no completion code — practice will show you the answers');
    }
    const roster = session.config.rosterNumber;
    if (roster === null)
        throw new SessionError('an assignment session carries a roster number');
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
export function driveCorrectly(session, clock) {
    let live = session;
    let guard = 0;
    while (!live.finished) {
        guard += 1;
        if (guard > 10000)
            throw new SessionError('this session will not finish');
        const problem = currentProblem(live);
        const solution = solve(problem);
        const stage = currentStage(live);
        const entry = correctEntryFor(problem, solution, stage, SCRATCH_SIG_FIGS);
        const result = submit(live, entry, clock);
        if (!result.advanced) {
            throw new SessionError(`the grader refused its own answer at ${problem.topic} ${stage.id}: ${result.classification.why}`);
        }
        live = result.session;
    }
    return live;
}
/** Re-exported so a caller reads one definition. */
export { COUNTER_SKILLS };
