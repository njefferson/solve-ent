/**
 * notes.ts — when the what's-new panel appears, and when it must not.
 *
 * The decision is a pure function of (what was stored, what is running), so it
 * can be asserted without a browser and without a clock. The storage and the
 * rendering are somebody else's job.
 *
 * ## Never to a first-time visitor
 *
 * A newcomer has nothing to catch up on. **A list of what they missed by never
 * having been here is the second-worst possible first screen**, after a list of
 * what they missed by never having been here that they cannot dismiss. So no
 * stored version means no panel — and the current version is written straight
 * away, so their SECOND visit is not treated as an upgrade either.
 *
 * ## The version is written on DISMISS, not on show
 *
 * A panel closed by a reload is a panel nobody read. Writing on show means one
 * accidental refresh silently spends the only time the app had to say what
 * changed. Writing on dismiss means a reader who wants it gets it; the cost is
 * that somebody who reloads past it sees it again, which is the right way round.
 *
 * The one exception is the newcomer, where nothing is shown, so there is
 * nothing to dismiss and the write happens immediately.
 */
/**
 * Decide, from the stored version and the running one.
 *
 * `stored` is null for a first-time visitor and for anybody whose storage was
 * cleared or is unavailable — which are the same thing from here, and are
 * treated the same on purpose. Somebody with storage switched off should never
 * be shown a what's-new panel on every single load.
 */
export function decideNotes(stored, running) {
    if (stored === null)
        return { show: false, remember: running };
    if (stored === running)
        return { show: false, remember: null };
    return { show: true };
}
/** The key the version is stored under. Device-local, like every other preference. */
export const NOTES_SEEN_KEY = 'solvent.notes-seen';
