/**
 * resume.ts — an unfinished set, kept on the device so closing a tab does not
 * lose it.
 *
 * ## Why this is narrow on purpose
 *
 * **Only an assigned set is remembered, because practice records nothing.** A
 * practice run has no code at the end, nothing to hand in and nothing to lose;
 * remembering it would be storing something about somebody for no reason at
 * all, which is the thing this application spends most of its rules avoiding.
 *
 * ## The tension, said out loud
 *
 * Picking a set back up means remembering the roster number, and **a device
 * that remembers a roster number is a device that says who used it.** On a
 * shared tablet the next person can see that number.
 *
 * That is not solvable, only bounded, and this is where the bounds are:
 *
 * - It is stored ONLY while the set is unfinished, and removed the moment a
 *   code is produced. The window is the length of one unfinished set.
 * - It expires. {@link RESUME_WINDOW_MS} is a working session, not a week — an
 *   unfinished set from yesterday should not surface for whoever picks the
 *   device up tomorrow.
 * - The offer NAMES the number rather than hiding it. Hiding it would be worse:
 *   somebody else would carry on and finish a set under a number that was not
 *   theirs, which is the disclosure plus a wrong record.
 * - One control removes it, and it says that is what it does.
 *
 * ## It refuses to cross a release
 *
 * The problems are a pure function of the key, the topic, the difficulty and
 * the index. A release that changes how a problem is generated changes the
 * question sitting at the same index — so a set picked up across a version
 * would carry counts from questions that no longer exist, under questions
 * nobody answered. The version is stored and a mismatch is refused.
 */
import { MAX_ROSTER_NUMBER } from '../engine/steps.js';
import { TOPIC_NAMES, posesTier } from '../engine/problem.js';
import { VERSION } from '../version.js';
/**
 * Where it lives. DULL ON PURPOSE, like the preference keys: on a shared device
 * the next person can read the key names, and a key name is a disclosure too.
 */
export const RESUME_KEY = 'solvent.unfinished';
/**
 * How long an unfinished set stays offered.
 *
 * TWELVE HOURS. Long enough to survive a lesson, a break, a bus and a battery;
 * short enough that a set left on a shared device does not come back to
 * somebody else the following day. It is a bound on how long a roster number
 * sits on a device, which is the reason it is short rather than convenient.
 */
export const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;
/**
 * Remember an unfinished assigned set.
 *
 * PRECONDITION: none. A practice session, a finished session and a session with
 * no roster number are all simply not stored — the caller does not have to know
 * which of those it is holding.
 */
export function saveRun(store, session, clock) {
    if (session.config.mode !== 'assignment' || session.finished) {
        clearRun(store);
        return;
    }
    const stored = { version: VERSION, savedAtMs: clock.now(), session };
    store.set(RESUME_KEY, JSON.stringify(stored));
}
/** Forget it. Called when a set finishes, and when a reader says to. */
export function clearRun(store) {
    store.remove(RESUME_KEY);
}
const isCounts = (value) => typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((n) => typeof n === 'number' && Number.isFinite(n));
/**
 * Whether what came back off the device is a session this build can carry on.
 *
 * READ RATHER THAN TRUSTED. What is in storage was written by some version of
 * this application, edited by anybody with the developer tools open, or
 * truncated by a browser reclaiming space. Every field is checked, and anything
 * that does not read is dropped rather than repaired — a half-understood
 * session would resume into questions nobody answered.
 */
function readsAsSession(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const s = value;
    const config = s['config'];
    if (config === undefined)
        return false;
    if (config['mode'] !== 'assignment')
        return false;
    if (typeof config['assignmentKey'] !== 'string' || config['assignmentKey'] === '')
        return false;
    const topic = config['topic'];
    if (typeof topic !== 'string' || !(topic in TOPIC_NAMES))
        return false;
    const tier = config['tier'];
    if (typeof tier !== 'number' || !posesTier(topic, tier))
        return false;
    const count = config['count'];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1)
        return false;
    const roster = config['rosterNumber'];
    if (typeof roster !== 'number' || !Number.isInteger(roster) || roster < 1 || roster > MAX_ROSTER_NUMBER) {
        return false;
    }
    for (const key of ['problemIndex', 'stageIndex', 'attempted', 'rightFirstTime', 'elapsedBeforeMs', 'startedAtMs']) {
        const n = s[key];
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0)
            return false;
    }
    if (s['problemIndex'] >= count)
        return false;
    if (typeof s['stageAttempted'] !== 'boolean')
        return false;
    if (s['finished'] !== false)
        return false;
    if (!isCounts(s['wrongBySkill']) || !isCounts(s['wrongByClass']))
        return false;
    return true;
}
/**
 * What is waiting, if anything.
 *
 * ANYTHING THAT DOES NOT READ IS REMOVED on the way out, so a value that cannot
 * be used cannot sit there being refused every time the application opens.
 */
export function readRun(store, clock) {
    const raw = store.get(RESUME_KEY);
    if (raw === null || raw === '')
        return { kind: 'none', why: 'NONE' };
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        clearRun(store);
        return { kind: 'none', why: 'UNREADABLE' };
    }
    const stored = parsed;
    if (stored === null || typeof stored !== 'object' || typeof stored.savedAtMs !== 'number') {
        clearRun(store);
        return { kind: 'none', why: 'UNREADABLE' };
    }
    if (stored.version !== VERSION) {
        clearRun(store);
        return { kind: 'none', why: 'OTHER_VERSION' };
    }
    if (clock.now() - stored.savedAtMs > RESUME_WINDOW_MS) {
        clearRun(store);
        return { kind: 'none', why: 'STALE' };
    }
    if (!readsAsSession(stored.session)) {
        clearRun(store);
        return { kind: 'none', why: 'UNREADABLE' };
    }
    return { kind: 'run', session: stored.session, savedAtMs: stored.savedAtMs };
}
