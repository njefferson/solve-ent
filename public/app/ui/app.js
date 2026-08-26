/**
 * app.ts — the screen. The ONLY module in this repository that touches a document.
 *
 * ## The wall, and why it is a type rather than a rule
 *
 * A screen renders a `Problem` and a `Stage`. Neither carries an answer, an
 * intermediate or a prediction — `solve`, `predictionsFor` and `correctEntryFor`
 * are the grader's, and nothing here calls them. **The correct answer is never
 * shown before the attempt at that step**, and the way that is kept is that the
 * data reaching this file does not contain it. A rule would have to be
 * remembered by whoever adds the next surface; a type is checked.
 *
 * The base `tsconfig.json` excludes this directory and has no DOM in `lib`, so
 * the same wall stands from the other side: an engine file that reached for
 * `document` does not compile.
 *
 * ## What is never said here
 *
 * No score, no streak, no target, no congratulation, and nothing that locates a
 * failure in the reader. What replaces praise is CHANGE — `readRun` says what
 * happened and says a repeated mistake stopped only where it did, and the
 * cadence (once is never named, twice in the closing, three times said during
 * the run with what fixes it) belongs to that module, not to this one.
 * `tools/copy-check.mjs` reads this file on every commit.
 *
 * ## Surfaces
 *
 * Every state a reader can be in is a `[data-surface]` element, and the a11y
 * gate walks that list. A surface that is not in it ships unmeasured — which is
 * hub LESSONS §28, and it has cost a release elsewhere. **Add a surface here and
 * to `tools/a11y.mjs` in the same commit.**
 */
import { TOPIC_NAMES } from "../engine/problem.js";
import { MAX_ROSTER_NUMBER, SessionError, currentProblem, currentStage, startSession, submit, } from "../engine/steps.js";
import { CLASS_MEANINGS, REMEDIES, choiceItemsFor, formatUnit, readEntry, remediesFor, } from "../engine/taxonomy.js";
import { readRun } from "../report/drill.js";
import { MAX_SHOWN, NOTES_PAGE, OLDER_THAN_SHOWN, RELEASES } from "../report/releases.js";
import { APP_NAME, VERSION } from "../version.js";
import { NOTES_SEEN_KEY, decideNotes } from "./notes.js";
import { browserStore, documentAttributes, readPrefs, writePrefs, } from "./prefs.js";
import { canSpeak, deviceVoice } from "./speech.js";
/* ------------------------------------------------------------------ *
 * Constants. Every threshold is named, with the judgement beside it.
 * ------------------------------------------------------------------ */
/** How many problems a practice run serves. Long enough for a pattern, short enough to finish. */
const PRACTICE_COUNT = 5;
/**
 * How many a warm-up serves.
 *
 * TWO, because the classroom feedback on the sibling app was that a short
 * opener at the start of a lesson is the thing that actually gets used, and a
 * five-problem "short" opener is not short.
 */
const WARM_UP_COUNT = 2;
/** Which difficulty a run starts at. Tier 1 is the one somebody can do. */
const OPENING_TIER = 1;
/** The key a practice run generates from when nobody has been given one. */
const PRACTICE_KEY = 'practice';
/* ------------------------------------------------------------------ *
 * A tiny amount of DOM, kept in one place.
 * ------------------------------------------------------------------ */
const $ = (selector) => {
    const found = document.querySelector(selector);
    if (found === null)
        throw new Error(`the document has no ${selector}`);
    return found;
};
const clear = (node) => {
    while (node.firstChild !== null)
        node.removeChild(node.firstChild);
};
function make(tag, attrs = {}, text = '') {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs))
        node.setAttribute(key, value);
    if (text !== '')
        node.textContent = text;
    return node;
}
let run = null;
let prefs = { mode: 'system', textSize: 'normal', spacing: 'normal', oneStepAtATime: false, readAloud: false };
let store;
let voice = null;
/* ------------------------------------------------------------------ *
 * Preferences, applied to the document
 * ------------------------------------------------------------------ */
function applyPrefs() {
    const root = document.documentElement;
    for (const name of ['data-theme', 'data-text-size', 'data-spacing'])
        root.removeAttribute(name);
    for (const [name, value] of Object.entries(documentAttributes(prefs)))
        root.setAttribute(name, value);
    // The status bar is painted per mode. A static theme-color is wrong in
    // whichever mode it was not written for.
    const painted = globalThis.getComputedStyle(root).getPropertyValue('--chrome').trim();
    if (painted !== '')
        $('meta[name="theme-color"]').setAttribute('content', painted);
}
function setPref(key, value) {
    prefs = { ...prefs, [key]: value };
    writePrefs(store, prefs);
    applyPrefs();
    renderPrefControls();
}
/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */
function show(surface) {
    for (const node of document.querySelectorAll('[data-surface]')) {
        const isIt = node.dataset['surface'] === surface;
        node.hidden = !isIt;
    }
    // Focus moves to the heading of the surface that just arrived, or a reader
    // using a keyboard is left where the control they pressed used to be.
    const heading = document.querySelector(`[data-surface="${surface}"] h2`);
    heading?.focus();
}
/* ------------------------------------------------------------------ *
 * The work surface
 * ------------------------------------------------------------------ */
/** The unit a step wants, in words, or empty where it wants a bare number. */
function unitLabel(stage) {
    if (!stage.needsUnit)
        return '';
    const written = formatUnit(stage.unit);
    return written === '' ? '' : written;
}
function renderQuestion(problem, stage) {
    const questionNode = $('#question');
    clear(questionNode);
    // ONE STEP AT A TIME hides the question body until asked for, never the step.
    // The step is what is being answered; hiding it would hide the question.
    const body = make('p', { class: 'question-body', id: 'question-body' }, problem.prompt);
    body.hidden = prefs.oneStepAtATime;
    questionNode.append(body);
    if (prefs.oneStepAtATime) {
        const reveal = make('button', { type: 'button', class: 'ghost', id: 'reveal' }, 'Show the question');
        reveal.addEventListener('click', () => {
            body.hidden = false;
            reveal.remove();
        });
        questionNode.append(reveal);
    }
    $('#step-prompt').textContent = stage.prompt;
    $('#topic-label').textContent = TOPIC_NAMES[problem.topic];
    const unit = unitLabel(stage);
    const unitNode = $('#unit-hint');
    unitNode.textContent = unit === '' ? '' : `Answer in ${unit}.`;
    unitNode.hidden = unit === '';
}
function renderEntry(problem, stage) {
    const entryNode = $('#entry');
    clear(entryNode);
    if (stage.kind === 'CHOICE') {
        const options = stage.options ?? choiceItemsFor(problem);
        const group = make('div', { role: 'group', 'aria-labelledby': 'step-prompt', class: 'choices' });
        options.forEach((option, index) => {
            const button = make('button', { type: 'button', class: 'choice' }, option);
            button.addEventListener('click', () => answer({ kind: 'choice', option: index }));
            group.append(button);
        });
        entryNode.append(group);
        return;
    }
    const label = make('label', { for: 'answer', class: 'entry-label' }, stage.kind === 'COUNT' ? 'How many' : 'Your answer');
    const field = make('input', {
        id: 'answer',
        type: 'text',
        inputmode: stage.kind === 'COUNT' ? 'numeric' : 'text',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
    });
    const go = make('button', { type: 'button', class: 'primary' }, 'Check this step');
    const sendIt = () => {
        // `readEntry` is used only to tell "no number at all" from "a number this
        // step will have something to say about". The ENTRY handed to the grader is
        // the raw text: the grader has to see exactly what was typed, including the
        // trailing figures and the unit, because those are what several classes are
        // about. Parsing it here and passing the parse would throw away the
        // evidence the diagnosis is made from.
        if (readEntry(field.value) === null) {
            say('That did not read as a number. A number, and a unit if the step asks for one.');
            field.focus();
            return;
        }
        answer({ kind: 'text', text: field.value });
    };
    go.addEventListener('click', sendIt);
    field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendIt();
        }
    });
    entryNode.append(label, field, go);
    field.focus();
}
/** Say something in the live region. Never praise, never blame; what happened. */
function say(text) {
    const live = $('#said');
    live.textContent = text;
}
function renderWork() {
    if (run === null)
        return;
    const problem = currentProblem(run.session);
    const stage = currentStage(run.session);
    renderQuestion(problem, stage);
    renderEntry(problem, stage);
    $('#diagnosis').hidden = true;
    renderReadAloud(problem, stage);
    show('work');
}
function renderReadAloud(problem, stage) {
    const holder = $('#read-aloud');
    clear(holder);
    // Offered only where the device can actually speak. A control that silently
    // does nothing teaches a reader the app is broken, and they are not wrong.
    if (!prefs.readAloud || voice === null) {
        holder.hidden = true;
        return;
    }
    holder.hidden = false;
    const button = make('button', { type: 'button', class: 'ghost' }, 'Read this aloud');
    button.addEventListener('click', () => {
        // THE QUESTION AND THE STEP. Never the answer, never an intermediate, never
        // the diagnosis before the attempt — the same rule as the screen, because
        // audio is a channel and not an exemption.
        voice?.speak(`${problem.prompt}. ${stage.prompt}`);
    });
    holder.append(button);
}
/* ------------------------------------------------------------------ *
 * Answering
 * ------------------------------------------------------------------ */
function answer(entry) {
    if (run === null)
        return;
    const stage = currentStage(run.session);
    const result = submit(run.session, entry, { now: () => Date.now() });
    run.session = result.session;
    run.attempts.push({ skill: stage.counter, errorClass: result.classification.errorClass });
    if (result.classification.correct) {
        say('That step is right. Next one.');
        if (run.session.finished) {
            renderDone();
            return;
        }
        renderWork();
        return;
    }
    renderDiagnosis(result.classification.errorClass, result.classification.why, result.classification.logError);
    // The step does NOT advance. A gate that opens on a wrong answer is a list of
    // questions rather than a thing that teaches a move.
    renderEntry(currentProblem(run.session), currentStage(run.session));
    renderDuringRunNote();
}
/**
 * The engine's phrases, as a sentence somebody can read.
 *
 * `CLASS_MEANINGS` are deliberately FRAGMENTS — "used the ratio the wrong way
 * up", "left a link out of the chain" — because the engine has no business
 * deciding how a screen frames them. Rendered raw they arrive as a bold
 * lowercase clause with no subject, which reads like an accusation with the
 * accusing part cut off. That is what the first screenshot of this showed.
 *
 * **The subject is THE ANSWER, and that is not a stylistic choice.** "That
 * answer used the ratio the wrong way up" is a statement about a move; "you
 * used the ratio the wrong way up" is a statement about a person, and this app
 * does not make those. The frame is where that distinction actually gets made,
 * so it lives here rather than being left to whoever writes the next surface.
 *
 * A few of the engine's strings are already whole clauses — "that is not a
 * number", "there is no number here to read" — and those are used as they
 * stand, capitalised.
 */
function asSentence(phrase) {
    const text = phrase.trim();
    if (text === '')
        return '';
    const whole = /^(?:that|there)\b/i.test(text);
    const framed = whole ? text : `That answer ${text}`;
    return `${framed.charAt(0).toUpperCase()}${framed.slice(1)}.`;
}
function renderDiagnosis(errorClass, why, logError) {
    const panel = $('#diagnosis');
    clear(panel);
    panel.hidden = false;
    panel.append(make('h3', {}, 'What happened at this step'));
    if (errorClass === null || errorClass === 'E-UNCLASSIFIED') {
        // THE APP'S LIMIT, NEVER A VERDICT. When attribution fails, say so — the
        // alternative is picking something plausible and telling somebody they hold
        // a misunderstanding they may not have.
        //
        // The specific reason is kept where there is one: "that is not a number" is
        // a great deal more use than "something went wrong", and throwing it away
        // to print one general sentence would be losing information in order to
        // sound tidier.
        const specific = asSentence(why);
        const general = 'This app cannot work out which move produces that number. ' +
            'That is a limit of the app and not a reading of the work. Try the step again.';
        const said = specific === '' || specific.startsWith('That answer is not a number this')
            ? general
            : `${specific} ${general}`;
        panel.append(make('p', { class: 'why' }, said));
        say(said);
        return;
    }
    const sentence = asSentence(why === '' ? CLASS_MEANINGS[errorClass] : why);
    panel.append(make('p', { class: 'why' }, sentence));
    const remedies = remediesFor(errorClass, logError);
    if (remedies.length > 0) {
        // A HEADING, because the list underneath is gerund phrases and a bare
        // bullet reading "undoing an operation on both sides" is not a sentence
        // either. This is the move to go and practise, which is the thing a
        // diagnosis is for.
        panel.append(make('h4', {}, 'The move underneath this step'));
        const list = make('ul', { class: 'remedies' });
        for (const remedy of remedies)
            list.append(make('li', {}, REMEDIES[remedy]));
        panel.append(list);
    }
    say(sentence);
}
/**
 * The three-times note, said during the run, once.
 *
 * `readRun` owns the cadence — once is never named, twice goes in the closing,
 * three times is said here with what fixes it and then never again. This only
 * has to not say it twice, which is what `saidNotes` is for: the run is re-read
 * from the top on every attempt, so the same note is produced again every time.
 */
function renderDuringRunNote() {
    if (run === null)
        return;
    const outcome = readRun(run.attempts);
    const latest = outcome.notes[outcome.notes.length - 1];
    if (latest === undefined)
        return;
    const key = `${latest.errorClass}@${String(latest.afterAttempt)}`;
    if (run.saidNotes.has(key))
        return;
    run.saidNotes.add(key);
    const holder = $('#run-note');
    holder.hidden = false;
    clear(holder);
    holder.append(make('p', {}, latest.text));
}
/* ------------------------------------------------------------------ *
 * The closing
 * ------------------------------------------------------------------ */
function renderDone() {
    if (run === null)
        return;
    const outcome = readRun(run.attempts);
    const list = $('#closing');
    clear(list);
    // NO COUNT. `DrillOutcome` has no field for one, so there is nothing here to
    // render even if somebody wanted to.
    for (const line of outcome.closing)
        list.append(make('li', {}, line));
    $('#run-note').hidden = true;
    show('done');
}
/* ------------------------------------------------------------------ *
 * Starting
 * ------------------------------------------------------------------ */
function begin(topic, count, key) {
    try {
        const session = startSession({
            assignmentKey: key,
            topic,
            tier: OPENING_TIER,
            count,
            mode: 'practice',
            // Practice records nothing and reports to nobody, so there is no
            // identity to carry. The roster number exists for assigned work and is
            // the only identity this app has anywhere.
            rosterNumber: null,
        }, { now: () => Date.now() });
        run = { session, attempts: [], saidNotes: new Set() };
        $('#run-note').hidden = true;
        renderWork();
    }
    catch (error) {
        const why = error instanceof SessionError ? error.message : 'that set could not be built';
        say(`This run did not start: ${why}`);
    }
}
function renderStart() {
    const list = $('#topics');
    clear(list);
    for (const [topic, name] of Object.entries(TOPIC_NAMES)) {
        const button = make('button', { type: 'button', class: 'topic' }, name);
        button.addEventListener('click', () => begin(topic, PRACTICE_COUNT, PRACTICE_KEY));
        list.append(make('li', {}).appendChild(button).parentElement);
    }
    show('start');
}
/* ------------------------------------------------------------------ *
 * The (i) panel, the what's-new panel, and routing
 * ------------------------------------------------------------------ */
function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog instanceof HTMLDialogElement)
        dialog.showModal();
}
function renderWhatsNew() {
    const list = $('#whats-new-list');
    clear(list);
    for (const release of RELEASES) {
        const item = make('li', {});
        item.append(make('h3', {}, `${release.version} — what changed`));
        const lines = make('ul', {});
        for (const line of release.lines)
            lines.append(make('li', {}, line));
        item.append(lines);
        item.append(make('p', { class: 'still-missing' }, `Still missing: ${release.stillMissing}`));
        list.append(item);
    }
    const more = $('#whats-new-more');
    // SAY HOW MANY ARE NOT SHOWN. A list of five with no hint that there are more
    // implies five is all there has ever been, which is a small lie that costs
    // nothing to avoid.
    more.textContent =
        OLDER_THAN_SHOWN === 0
            ? `Every release so far is listed. This panel never shows more than ${String(MAX_SHOWN)}.`
            : `${String(OLDER_THAN_SHOWN)} older release${OLDER_THAN_SHOWN === 1 ? '' : 's'} not shown here.`;
    for (const link of document.querySelectorAll('a[data-notes-page]')) {
        link.href = NOTES_PAGE;
    }
}
/**
 * Route from the hash.
 *
 * **A hash-only URL change is same-document**, so a link into an already-open
 * tab fires `hashchange` and nothing else. Without this listener the link looks
 * fine and the page simply does not move, which is a silent failure and the
 * exact trap recorded against the warm-up path.
 */
function route() {
    if (globalThis.location.hash === '#/warm-up') {
        const topics = Object.keys(TOPIC_NAMES);
        const first = topics[0];
        if (first !== undefined)
            begin(first, WARM_UP_COUNT, PRACTICE_KEY);
        return;
    }
    if (globalThis.location.hash === '#/about') {
        openDialog('info');
        return;
    }
    if (run === null)
        renderStart();
}
/* ------------------------------------------------------------------ *
 * Preference controls
 * ------------------------------------------------------------------ */
function renderPrefControls() {
    for (const button of document.querySelectorAll('[data-pref]')) {
        const name = button.dataset['pref'] ?? '';
        const value = button.dataset['value'] ?? '';
        let on = false;
        if (name === 'mode')
            on = prefs.mode === value;
        else if (name === 'textSize')
            on = prefs.textSize === value;
        else if (name === 'spacing')
            on = prefs.spacing === value;
        else if (name === 'oneStepAtATime')
            on = prefs.oneStepAtATime;
        else if (name === 'readAloud')
            on = prefs.readAloud;
        // aria-pressed, so the state is in the accessibility tree and not only in
        // the colour of the button. Colour is never the sole carrier.
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    // Read-aloud is not offered at all where the device cannot speak.
    $('#read-aloud-setting').hidden = !canSpeak();
}
/* ------------------------------------------------------------------ *
 * The diagnostic (Doctrine §7f)
 * ------------------------------------------------------------------ */
/**
 * A TEXT report, never a screenshot, and it carries what the browser string
 * hides: iPadOS Safari reports itself as a Mac, so `maxTouchPoints` is the
 * thing that tells a tablet from a desktop.
 *
 * IT CARRIES NO PREFERENCE. A diagnostic that listed which accommodations were
 * switched on would make a reader disclose them by reporting a problem, which
 * is the one channel they cannot avoid using when something is broken.
 */
function diagnosticText() {
    const nav = globalThis.navigator;
    const lines = [
        `${APP_NAME} ${VERSION}`,
        `screen ${String(globalThis.innerWidth)}x${String(globalThis.innerHeight)} at ${String(globalThis.devicePixelRatio)}x`,
        `touch points ${String(nav.maxTouchPoints)}`,
        `language ${nav.language}`,
        `user agent ${nav.userAgent}`,
        `reduced motion ${String(globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches)}`,
        `colour scheme ${globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'}`,
        `storage ${(() => {
            try {
                globalThis.localStorage.setItem('solvent.probe', '1');
                globalThis.localStorage.removeItem('solvent.probe');
                return 'available';
            }
            catch {
                return 'unavailable';
            }
        })()}`,
        'settings: not included, on purpose',
    ];
    return lines.join('\n');
}
/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
export function boot(storeForTests) {
    store = storeForTests ?? browserStore();
    prefs = readPrefs(store);
    applyPrefs();
    voice = deviceVoice();
    renderPrefControls();
    renderWhatsNew();
    $('#version').textContent = VERSION;
    $('#roster-max').textContent = String(MAX_ROSTER_NUMBER);
    $('#diagnostic-text').textContent = diagnosticText();
    for (const button of document.querySelectorAll('[data-pref]')) {
        button.addEventListener('click', () => {
            const name = button.dataset['pref'] ?? '';
            const value = button.dataset['value'] ?? '';
            if (name === 'mode')
                setPref('mode', value);
            else if (name === 'textSize')
                setPref('textSize', value);
            else if (name === 'spacing')
                setPref('spacing', value);
            else if (name === 'oneStepAtATime')
                setPref('oneStepAtATime', !prefs.oneStepAtATime);
            else if (name === 'readAloud')
                setPref('readAloud', !prefs.readAloud);
        });
    }
    $('#open-info').addEventListener('click', () => openDialog('info'));
    $('#begin').addEventListener('click', () => {
        // FIRST-RUN ORIENTATION SURVIVES WHAT A READER PRESSES TO BEGIN: the block
        // is MOVED into the (i) panel rather than copied, so there is one copy of
        // those words and it is permanently reachable.
        $('#info-orientation-slot').append($('#orientation'));
        renderStart();
    });
    $('#again').addEventListener('click', () => {
        run = null;
        renderStart();
    });
    for (const closer of document.querySelectorAll('[data-close]')) {
        closer.addEventListener('click', () => {
            const dialog = closer.closest('dialog');
            dialog?.close();
        });
    }
    // WHAT'S NEW: never to a first-time visitor, and the version is written on
    // DISMISS rather than on show, because a panel closed by a reload is a panel
    // nobody read.
    const decision = decideNotes(store.get(NOTES_SEEN_KEY), VERSION);
    if (decision.show) {
        const dialog = document.getElementById('whats-new');
        if (dialog instanceof HTMLDialogElement) {
            dialog.addEventListener('close', () => store.set(NOTES_SEEN_KEY, VERSION), { once: true });
            dialog.showModal();
        }
    }
    else if (decision.remember !== null) {
        store.set(NOTES_SEEN_KEY, decision.remember);
    }
    globalThis.addEventListener('hashchange', route);
    const seenWelcome = store.get('solvent.welcomed') === VERSION || store.get('solvent.welcomed') === 'yes';
    if (seenWelcome) {
        $('#info-orientation-slot').append($('#orientation'));
        route();
    }
    else {
        store.set('solvent.welcomed', 'yes');
        show('welcome');
    }
}
