/**
 * prefs.ts — everything a reader can change about how this looks and sounds.
 *
 * **EVERY ONE OF THESE IS DEVICE-LOCAL AND NONE OF THEM LEAVES THE DEVICE.**
 * Text size, letter and line spacing, one step at a time, read-aloud: they live
 * in `localStorage` and nowhere else. They reach no completion code, no problem
 * report and no teacher's page.
 *
 * The reason is not tidiness. A student's accommodations are disability
 * information, and a code that carried one would make a student disclose an
 * accommodation by handing in their work — over a channel they cannot opt out
 * of, to a person they did not choose to tell. **The app must never store or
 * transmit WHICH accommodations a student has.**
 *
 * That is why this module exports no serialiser, and why `Session` has no field
 * for a preference and must never gain one. Omitting a field from an output is
 * a rule somebody has to remember at the moment they add the output; having
 * nowhere to read it from is a rule that holds by itself.
 *
 * The keys are namespaced but deliberately DULL — `solvent.text-size` and not
 * `solvent.accommodation.dyslexia`. Anything on a shared device is readable by
 * the next person to open it, and a key name is a disclosure too.
 */
/** What a reader gets before choosing anything. */
export const DEFAULT_PREFS = {
    mode: 'system',
    textSize: 'normal',
    spacing: 'normal',
    oneStepAtATime: false,
    readAloud: false,
};
const KEYS = {
    mode: 'solvent.mode',
    textSize: 'solvent.text-size',
    spacing: 'solvent.spacing',
    oneStepAtATime: 'solvent.one-step',
    readAloud: 'solvent.read-aloud',
};
const MODES = ['system', 'day', 'night'];
const SIZES = ['normal', 'large', 'largest'];
const SPACINGS = ['normal', 'open'];
/** The browser's own storage, or a store that forgets, where it is unavailable. */
export function browserStore() {
    return {
        get(key) {
            try {
                return globalThis.localStorage.getItem(key);
            }
            catch {
                return null;
            }
        },
        set(key, value) {
            try {
                globalThis.localStorage.setItem(key, value);
            }
            catch {
                // A reader who cannot store preferences still gets to use them for this
                // visit. Losing them on reload is worse than nothing; it is not a crash.
            }
        },
        remove(key) {
            try {
                globalThis.localStorage.removeItem(key);
            }
            catch {
                // Nothing to do: a store that cannot be written to cannot be holding
                // anything that needed removing.
            }
        },
    };
}
/** A store held in memory. For tests, and for a browser that refuses storage. */
export function memoryStore(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        get: (key) => map.get(key) ?? null,
        set: (key, value) => void map.set(key, value),
        remove: (key) => void map.delete(key),
    };
}
const oneOf = (allowed, raw, fallback) => allowed.includes(raw) ? raw : fallback;
/** Read what a reader has chosen. Anything unrecognised falls back to the default. */
export function readPrefs(store) {
    return {
        mode: oneOf(MODES, store.get(KEYS.mode), DEFAULT_PREFS.mode),
        textSize: oneOf(SIZES, store.get(KEYS.textSize), DEFAULT_PREFS.textSize),
        spacing: oneOf(SPACINGS, store.get(KEYS.spacing), DEFAULT_PREFS.spacing),
        oneStepAtATime: store.get(KEYS.oneStepAtATime) === 'on',
        readAloud: store.get(KEYS.readAloud) === 'on',
    };
}
/** Write what a reader has chosen. Device-local; there is no other destination. */
export function writePrefs(store, prefs) {
    store.set(KEYS.mode, prefs.mode);
    store.set(KEYS.textSize, prefs.textSize);
    store.set(KEYS.spacing, prefs.spacing);
    store.set(KEYS.oneStepAtATime, prefs.oneStepAtATime ? 'on' : 'off');
    store.set(KEYS.readAloud, prefs.readAloud ? 'on' : 'off');
}
/**
 * The attributes a document carries for a set of preferences.
 *
 * Returned as data rather than applied here, so the mapping can be asserted
 * without a browser — and so the one place that touches the document is the one
 * place that touches the document.
 */
export function documentAttributes(prefs) {
    const out = {
        'data-text-size': prefs.textSize,
        'data-spacing': prefs.spacing,
    };
    // 'system' sets NOTHING, so the media query in tokens.css decides. Writing
    // data-theme="system" would match neither attribute rule and look like a bug
    // in the cascade rather than the absence of a choice.
    if (prefs.mode !== 'system')
        out['data-theme'] = prefs.mode;
    return out;
}
