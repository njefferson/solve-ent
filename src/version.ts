/**
 * version.ts — the release triplet, written once and read everywhere.
 *
 * Doctrine §7 and §7b. `tools/version-check.mjs` holds every other copy to
 * this one, and `.branch-guard` runs that check on every commit — because the
 * way a triplet drifts is never dramatic. One of the copies is missed, the app
 * reports a version its code is not, and the next screenshot sends somebody
 * after a defect that was fixed two releases ago.
 */

/** `version.capability.iteration`. */
export const VERSION = '0.14.2';

/** What the app is called, in one place, for anything that has to say it. */
export const APP_NAME = 'Solve-ent';
