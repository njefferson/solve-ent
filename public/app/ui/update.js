/**
 * update.ts — noticing that a newer version is ready, and saying so.
 *
 * ## The failure this exists to prevent is invisible by construction
 *
 * Caching IS the business of not asking the network, so a stale app looks
 * perfectly fine. It is just old. There is no error, no symptom, and the version
 * on screen is the old one reporting itself accurately. **Nobody finds this by
 * using the app** — which is why Doctrine §7h makes it a thing every app ships
 * rather than a thing anybody asks for.
 *
 * ## The new version WAITS, and the reader releases it
 *
 * `sw.js` deliberately does not call `skipWaiting()` during install. If it did,
 * the new worker would take over under the OPEN page — still running the
 * previous release's markup and modules — and `activate` would delete the old
 * cache, so that page would be served NEW files from then on. Old markup, new
 * modules, no reload, nothing said. Two sibling apps shipped exactly that, one
 * of them for twenty-two releases.
 *
 * So the worker waits, this puts a standing indicator on screen saying so in
 * words a reader can see, and pressing the control posts `SKIP_WAITING`. The
 * page reloads once the new worker takes control, and only then.
 *
 * ## A newcomer is never told anything
 *
 * A first install has no waiting worker and no controller, so there is nothing
 * to say and nothing is said. Being told about an update on your first visit is
 * being told about a version you never had.
 *
 * ## It never interrupts
 *
 * A strip, not a dialog. Somebody part-way through a question is not
 * interrupted, and there is no modal to dismiss before answering. Reloading
 * mid-run would lose the run, so the reader chooses when.
 */
/** Where the worker lives, and the scope it claims. */
const WORKER_URL = '/sw.js';
/** What the page posts to release a waiting worker. `sw.js` listens for exactly this. */
const RELEASE = 'SKIP_WAITING';
/** True where this browser can run a service worker at all. */
export function canCache() {
    return typeof globalThis.navigator !== 'undefined' && 'serviceWorker' in globalThis.navigator;
}
/**
 * Which copies of the app this device is holding.
 *
 * For the §7f diagnostic, which otherwise cannot tell "current" from "what the
 * cache still holds" — the version stamp reports the code that is RUNNING, and
 * on a stale app that is the old code reporting itself accurately.
 *
 * `caches?.keys()` with the optional chaining is deliberate: the Cache API is
 * absent in some privacy modes and older WebViews, and touching it bare throws
 * where the whole point is to report rather than to crash.
 */
export async function heldCaches() {
    try {
        return (await globalThis.caches?.keys()) ?? [];
    }
    catch {
        return [];
    }
}
/**
 * Register the worker and watch for a newer version.
 *
 * PRECONDITION: none. Does nothing at all where service workers are unavailable,
 * which is a normal state and not an error.
 */
export function watchForUpdate(surface) {
    if (!canCache())
        return;
    const container = globalThis.navigator.serviceWorker;
    /** Whether this page was already being served by a worker, read BEFORE registering. */
    const hadController = container.controller !== null;
    /** Set when the reader presses the control, so the reload that follows is theirs. */
    let expectingSwap = false;
    let reloading = false;
    /**
     * RELOAD ONLY WHEN A WORKER REPLACES ANOTHER ONE.
     *
     * `activate` calls `clients.claim()` so the worker starts serving the page it
     * was registered from — and claiming fires `controllerchange` exactly as a
     * replacement does. Without this, every first-time visitor got a reload they
     * did not ask for, on the visit where they had just arrived. Caught by the
     * accessibility gate, whose page navigated out from under it mid-measure; a
     * reader would have seen a flash and thought nothing of it, which is worse.
     *
     * Two things count as a replacement. `expectingSwap` is this reader pressing
     * the control. `hadController` covers the other tab: somebody takes the update
     * elsewhere, that worker claims every client, and THIS page is now old markup
     * being served new modules — which is the §7h.1 hazard arriving sideways.
     */
    container.addEventListener('controllerchange', () => {
        if (reloading)
            return;
        if (!hadController && !expectingSwap)
            return;
        reloading = true;
        globalThis.location.reload();
    });
    void container
        .register(WORKER_URL)
        .then((registration) => {
        const offer = (worker) => {
            surface.offer(() => {
                expectingSwap = true;
                worker.postMessage(RELEASE);
            });
        };
        /**
         * A WAITING WORKER BESIDE AN ACTIVE ONE IS AN UPDATE. A waiting worker
         * with no active one is a first install — nothing was replaced, so there
         * is nothing to tell anybody about.
         *
         * Read from the REGISTRATION rather than from `controller`, and read at
         * the moment it matters rather than once at boot. The first attempt used
         * `hadController`, captured before registering, which is correct for the
         * first paint and wrong forever after: a page that arrived as a newcomer
         * could never be offered an update, however long it stayed open.
         */
        if (registration.active !== null && registration.waiting !== null)
            offer(registration.waiting);
        registration.addEventListener('updatefound', () => {
            const incoming = registration.installing;
            if (incoming === null)
                return;
            // Read NOW, before the state changes: once the new worker is installed,
            // `active` is still the old one, but reading it here says plainly that
            // there was something to replace when this began.
            const replacing = registration.active !== null;
            incoming.addEventListener('statechange', () => {
                if (incoming.state === 'installed' && replacing)
                    offer(registration.waiting ?? incoming);
                if (incoming.state === 'redundant')
                    surface.withdraw();
            });
        });
    })
        .catch(() => {
        // A registration that fails is an app without offline support, which is
        // the state it was in before this existed. It is not a reason to break the
        // screen somebody came to use.
    });
}
