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

import { TOPIC_NAMES, laddersFor, solve, type Problem, type Topic } from '../engine/problem.ts';
import { drillItem, type DrillItem } from '../engine/blocked.ts';
import {
  MAX_ROSTER_NUMBER,
  SessionError,
  currentProblem,
  currentStage,
  startSession,
  submit,
  type Session,
} from '../engine/steps.ts';
import {
  CLASS_MEANINGS,
  COUNTER_SKILLS,
  REMEDIES,
  SKILL_NAMES,
  choiceItemsFor,
  classify,
  formatUnit,
  readEntry,
  remediesFor,
  type CounterSkill,
  type ErrorClass,
  type Stage,
  type StudentEntry,
} from '../engine/taxonomy.ts';
import { evaluate } from '../num/arith.ts';
import { readRun, type Attempt, type DrillNote } from '../report/drill.ts';
import { MAX_SHOWN, NOTES_PAGE, OLDER_THAN_SHOWN, RELEASES } from '../report/releases.ts';
import { APP_NAME, VERSION } from '../version.ts';
import { NOTES_SEEN_KEY, decideNotes } from './notes.ts';
import {
  browserStore,
  documentAttributes,
  readPrefs,
  writePrefs,
  type Prefs,
  type Store,
} from './prefs.ts';
import { canSpeak, deviceVoice, type Voice } from './speech.ts';
import { heldCaches, watchForUpdate } from './update.ts';

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

/**
 * Which difficulty a run starts at where nothing chose one.
 *
 * The first the topic declares, read off the ladder rather than written here as
 * a number — two topics no longer have three difficulties and one has a single
 * one, so a constant would be a claim about every topic made in one place.
 */
const openingTier = (topic: Topic): number => (laddersFor(topic)[0] as { tier: number }).tier;

/** The key a practice run generates from when nobody has been given one. */
const PRACTICE_KEY = 'practice';

/* ------------------------------------------------------------------ *
 * A tiny amount of DOM, kept in one place.
 * ------------------------------------------------------------------ */

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (found === null) throw new Error(`the document has no ${selector}`);
  return found;
};

const clear = (node: HTMLElement): void => {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
};

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== '') node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

type SurfaceName = 'welcome' | 'start' | 'difficulty' | 'drill-pick' | 'drill' | 'work' | 'done';

/** One step the reader has already finished, in the words they finished it in. */
interface WorkingLine {
  /** What the step was, from the stage's own skill. Never typed out here. */
  readonly what: string;
  /** What the READER wrote, exactly. Never a value read off the solution. */
  readonly wrote: string;
}

interface Run {
  session: Session;
  readonly attempts: Attempt[];
  /** Notes already said during the run, so the once-only cadence holds across renders. */
  readonly saidNotes: Set<string>;
  /**
   * The steps already done on the question in front of the reader.
   *
   * **BUILT FROM WHAT THEY WROTE, never from the solution**, and that is the
   * reason it is safe rather than a thing to be careful about: there is no
   * future entry to show, so no arrangement of this list can reach a step
   * nobody has answered yet. A step only lands here once the grader has
   * accepted it, and a wrong step never advances, so every line is the reader's
   * own correct work.
   *
   * Cleared when the question changes. It is in memory for as long as the
   * screen is, and is written nowhere — practice records nothing.
   */
  working: WorkingLine[];
}

let run: Run | null = null;
let prefs: Prefs = { mode: 'system', textSize: 'normal', spacing: 'normal', oneStepAtATime: false, readAloud: false };
let store: Store;
let voice: Voice | null = null;

/* ------------------------------------------------------------------ *
 * Preferences, applied to the document
 * ------------------------------------------------------------------ */

function applyPrefs(): void {
  const root = document.documentElement;
  for (const name of ['data-theme', 'data-text-size', 'data-spacing']) root.removeAttribute(name);
  for (const [name, value] of Object.entries(documentAttributes(prefs))) root.setAttribute(name, value);
  // The status bar is painted per mode. A static theme-color is wrong in
  // whichever mode it was not written for.
  const painted = globalThis.getComputedStyle(root).getPropertyValue('--chrome').trim();
  if (painted !== '') $('meta[name="theme-color"]').setAttribute('content', painted);
}

function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  prefs = { ...prefs, [key]: value };
  writePrefs(store, prefs);
  applyPrefs();
  renderPrefControls();
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

/**
 * Surfaces that are SCREENS: exactly one is on at a time.
 *
 * The update strip is a `[data-surface]` too — the accessibility gate walks that
 * attribute and a state it cannot see ships unmeasured — but it is a standing
 * indicator ALONGSIDE a screen rather than one of them. Hiding it here would
 * mean the app noticed a new version, said so, and then silently took the words
 * away the next time the reader pressed anything.
 */
const SCREENS: readonly string[] = ['welcome', 'start', 'difficulty', 'drill-pick', 'drill', 'work', 'done'];

function show(surface: SurfaceName): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-surface]')) {
    const name = node.dataset['surface'] ?? '';
    if (!SCREENS.includes(name)) continue;
    node.hidden = name !== surface;
  }
  // Focus moves to the heading of the surface that just arrived, or a reader
  // using a keyboard is left where the control they pressed used to be.
  const heading = document.querySelector<HTMLElement>(`[data-surface="${surface}"] h2`);
  heading?.focus();
}

/* ------------------------------------------------------------------ *
 * The work surface
 * ------------------------------------------------------------------ */

/** The unit a step wants, in words, or empty where it wants a bare number. */
function unitLabel(stage: Stage): string {
  if (!stage.needsUnit) return '';
  const written = formatUnit(stage.unit);
  return written === '' ? '' : written;
}

function renderQuestion(problem: Problem, stage: Stage): void {
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

function renderEntry(problem: Problem, stage: Stage): void {
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

  const label = make(
    'label',
    { for: 'answer', class: 'entry-label' },
    stage.kind === 'COUNT' ? 'How many' : 'Your answer',
  );
  const field = make('input', {
    id: 'answer',
    type: 'text',
    inputmode: stage.kind === 'COUNT' ? 'numeric' : 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });
  const go = make('button', { type: 'button', class: 'primary' }, 'Check this step');

  const sendIt = (): void => {
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
function say(text: string): void {
  const live = $('#said');
  live.textContent = text;
}

function renderWorking(): void {
  const holder = $('#working');
  const list = $('#working-list');
  clear(list);
  const lines = run?.working ?? [];
  holder.hidden = lines.length === 0;
  for (const line of lines) {
    const item = make('li', {});
    item.append(make('span', { class: 'what' }, `${line.what}: `), make('span', { class: 'wrote' }, line.wrote));
    list.append(item);
  }
}

/**
 * The keys, in the order a hand expects them.
 *
 * `EE` is here because this application's readers meet 6.022 × 10²³ on the
 * first day and nobody types twenty-three zeros. `C` clears and `⌫` deletes,
 * both spelled as the words a screen reader should say rather than left as
 * punctuation nobody can hear.
 */
const SCRATCH_KEYS: readonly { readonly key: string; readonly says: string; readonly puts: string }[] = [
  { key: '7', says: '7', puts: '7' },
  { key: '8', says: '8', puts: '8' },
  { key: '9', says: '9', puts: '9' },
  { key: '÷', says: 'divided by', puts: '÷' },
  { key: 'C', says: 'clear', puts: '' },
  { key: '4', says: '4', puts: '4' },
  { key: '5', says: '5', puts: '5' },
  { key: '6', says: '6', puts: '6' },
  { key: '×', says: 'times', puts: '×' },
  { key: '⌫', says: 'delete', puts: '' },
  { key: '1', says: '1', puts: '1' },
  { key: '2', says: '2', puts: '2' },
  { key: '3', says: '3', puts: '3' },
  { key: '−', says: 'minus', puts: '−' },
  { key: '(', says: 'open bracket', puts: '(' },
  { key: '0', says: '0', puts: '0' },
  { key: '.', says: 'point', puts: '.' },
  { key: 'EE', says: 'times ten to the', puts: 'e' },
  { key: '+', says: 'plus', puts: '+' },
  { key: ')', says: 'close bracket', puts: ')' },
];

/**
 * Working it out, in the app, without being handed anything.
 *
 * **IT NEVER ROUNDS AND IT NEVER SEES THE QUESTION.** It multiplies the numbers
 * the reader chose in the order they chose them, which is what a calculator on
 * the desk beside them would do — and the reason that is not a solver is that
 * choosing what to multiply is the entire thing being taught.
 */
function wireScratch(): void {
  const line = $('#scratch-line') as HTMLInputElement;
  const result = $('#scratch-result');
  const use = $('#scratch-use') as HTMLButtonElement;
  const body = $('#scratch-body');
  const toggle = $('#scratch-toggle');

  const show = (): void => {
    const worked = evaluate(line.value);
    if (worked.kind === 'value') {
      result.textContent = `= ${String(worked.value)}`;
      use.disabled = false;
      return;
    }
    // A LINE BEING TYPED IS NOT AN ERROR. This runs on every keystroke, so half
    // a sum is the ordinary case and saying so on each character would be a
    // screen telling somebody off for typing.
    result.textContent = worked.kind === 'empty' ? '' : '…';
    use.disabled = true;
  };

  toggle.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) line.focus();
  });
  line.addEventListener('input', show);
  for (const { key, says, puts } of SCRATCH_KEYS) {
    const button = make('button', { type: 'button', class: 'scratch-key', 'aria-label': says }, key);
    button.addEventListener('click', () => {
      if (key === 'C') line.value = '';
      else if (key === '⌫') line.value = line.value.slice(0, -1);
      else line.value += puts;
      show();
      line.focus();
    });
    $('#scratch-keys').append(button);
  }
  use.addEventListener('click', () => {
    const worked = evaluate(line.value);
    if (worked.kind !== 'value') return;
    const field = document.querySelector<HTMLInputElement>('#answer');
    if (field === null) {
      say('This step is a choice rather than a number, so there is nothing to put it in.');
      return;
    }
    // THE VALUE, NOT A ROUNDED ONE. What the step asks for is a number written
    // to so many significant figures, and rounding it here would do that part
    // of the question — which is a topic in its own right — without saying so.
    field.value = String(worked.value);
    field.focus();
    say('That is in the answer box. Round it to the figures the step asks for.');
  });
  show();
}

/** Put the scratch line away between steps, and empty it. */
function resetScratch(): void {
  const line = $('#scratch-line') as HTMLInputElement;
  line.value = '';
  $('#scratch-result').textContent = '';
  ($('#scratch-use') as HTMLButtonElement).disabled = true;
  $('#scratch-body').hidden = true;
  $('#scratch-toggle').setAttribute('aria-expanded', 'false');
}

function renderWork(): void {
  if (run === null) return;
  const problem = currentProblem(run.session);
  const stage = currentStage(run.session);
  renderQuestion(problem, stage);
  renderWorking();
  renderEntry(problem, stage);
  resetScratch();
  $('#diagnosis').hidden = true;
  renderReadAloud(problem, stage);
  show('work');
}

function renderReadAloud(problem: Problem, stage: Stage): void {
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

function answer(entry: Parameters<typeof submit>[1]): void {
  if (run === null) return;
  const stage = currentStage(run.session);
  const problem = currentProblem(run.session);
  const wasOn = run.session.problemIndex;
  const result = submit(run.session, entry, { now: () => Date.now() });
  run.session = result.session;
  run.attempts.push({ skill: stage.counter, errorClass: result.classification.errorClass });

  if (result.classification.correct) {
    // WHAT THEY WROTE, kept so the next step does not ask them to remember it.
    // A choice is recorded as the option they pressed rather than its number,
    // because "n ÷ r" is the thing worth having in front of you and "2" is not.
    const wrote =
      entry.kind === 'choice'
        ? ((stage.options ?? choiceItemsFor(problem))[entry.option] ?? '')
        : entry.text.trim();
    if (wrote !== '') run.working.push({ what: SKILL_NAMES[stage.counter], wrote });
    // A NEW QUESTION STARTS AN EMPTY LIST. The working belongs to the question
    // it was done on; carrying it forward would put one question's numbers
    // beside another question's prompt, which is worse than showing nothing.
    if (result.session.problemIndex !== wasOn) run.working = [];
    say('That step is right. Next one.');
    if (run.session.finished) {
      renderDone();
      return;
    }
    renderWork();
    return;
  }

  renderDiagnosis(
    result.classification.errorClass,
    result.classification.why,
    result.classification.logError,
    $('#diagnosis'),
  );
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
function asSentence(phrase: string): string {
  const text = phrase.trim();
  if (text === '') return '';
  const whole = /^(?:that|there)\b/i.test(text);
  const framed = whole ? text : `That answer ${text}`;
  return `${framed.charAt(0).toUpperCase()}${framed.slice(1)}.`;
}

function renderDiagnosis(
  errorClass: ErrorClass | null,
  why: string,
  logError: number | null,
  panel: HTMLElement = $('#diagnosis'),
): void {
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
    const general =
      'This app cannot work out which move produces that number. ' +
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
    for (const remedy of remedies) list.append(make('li', {}, REMEDIES[remedy]));
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
function renderDuringRunNote(): void {
  if (run === null) return;
  const outcome = readRun(run.attempts);
  const latest: DrillNote | undefined = outcome.notes[outcome.notes.length - 1];
  if (latest === undefined) return;
  const key = `${latest.errorClass}@${String(latest.afterAttempt)}`;
  if (run.saidNotes.has(key)) return;
  run.saidNotes.add(key);
  const holder = $('#run-note');
  holder.hidden = false;
  clear(holder);
  holder.append(make('p', {}, latest.text));
}

/* ------------------------------------------------------------------ *
 * The drill: one move, again
 *
 * NO SESSION. `drillItem` and `classify` are pure, so a drill is a loop and
 * nothing here accumulates — there is no code to produce and nothing to hand
 * in. The attempts are kept only so `readRun` can say what happened, and they
 * go when the reader leaves.
 * ------------------------------------------------------------------ */

interface Drill {
  readonly skill: CounterSkill;
  index: number;
  item: DrillItem | null;
  readonly attempts: Attempt[];
  readonly saidNotes: Set<string>;
}

let drill: Drill | null = null;

/** Where the closing came from, so "again" goes back to the right place. */
let closingFrom: 'run' | 'drill' = 'run';

function renderDrillPick(): void {
  const list = $('#moves');
  clear(list);
  // ALL SIX, unconditionally. A move quietly missing from a menu is worse than
  // a loud failure at build time, and `blocked.test.ts` holds every one of them
  // reachable — including isolating the unknown, which lives in about one
  // tier-3 rearrangement in twelve and in nothing else.
  for (const skill of COUNTER_SKILLS) {
    const item = make('li', {});
    const button = make('button', { type: 'button', class: 'topic' }, SKILL_NAMES[skill]);
    button.addEventListener('click', () => beginDrill(skill));
    item.append(button);
    list.append(item);
  }
  show('drill-pick');
}

function beginDrill(skill: CounterSkill): void {
  drill = { skill, index: 0, item: null, attempts: [], saidNotes: new Set() };
  $('#drill-note').hidden = true;
  nextDrillItem();
}

function nextDrillItem(): void {
  if (drill === null) return;
  const item = drillItem(drill.skill, PRACTICE_KEY, drill.index);
  drill.item = item;
  if (item === null) {
    // SAY SO. A drill that cannot pose its move must not quietly serve a
    // different one, and it must not sit there empty either.
    say(`This app cannot build any more of those right now. ${SKILL_NAMES[drill.skill]} is the move; try another.`);
    renderDrillPick();
    return;
  }
  renderDrill(item);
}

function renderDrill(item: DrillItem): void {
  if (drill === null) return;
  $('#drill-label').textContent = SKILL_NAMES[drill.skill];

  const question = $('#drill-question');
  clear(question);
  // THE QUESTION IS CONTEXT, not the task. A move drilled with no question
  // around it is a move with nothing to hold on to; a whole question answered
  // step by step is not a drill. So the question is shown and only the one step
  // is asked.
  question.append(make('p', { class: 'question-body' }, item.problem.prompt));
  // The topic names are written lowercase because they are read mid-sentence
  // elsewhere — "seven kinds of algebra: rearranging a formula, ...". Dropped
  // after a full stop they read as a broken sentence, so this is a clause.
  question.append(
    make('p', { class: 'aside' }, `Only this one step, from ${TOPIC_NAMES[item.problem.topic]}.`),
  );

  $('#drill-step').textContent = item.stage.prompt;
  const unit = unitLabel(item.stage);
  const unitNode = $('#drill-unit');
  unitNode.textContent = unit === '' ? '' : `Answer in ${unit}.`;
  unitNode.hidden = unit === '';

  $('#drill-diagnosis').hidden = true;
  renderDrillEntry(item);
  show('drill');
}

function renderDrillEntry(item: DrillItem): void {
  const holder = $('#drill-entry');
  clear(holder);

  const answer = (entry: StudentEntry): void => answerDrill(item, entry);

  if (item.stage.kind === 'CHOICE') {
    const options = item.stage.options ?? choiceItemsFor(item.problem);
    const group = make('div', { role: 'group', 'aria-labelledby': 'drill-step', class: 'choices' });
    options.forEach((option, option_index) => {
      const button = make('button', { type: 'button', class: 'choice' }, option);
      button.addEventListener('click', () => answer({ kind: 'choice', option: option_index }));
      group.append(button);
    });
    holder.append(group);
    return;
  }

  const label = make(
    'label',
    { for: 'drill-answer', class: 'entry-label' },
    item.stage.kind === 'COUNT' ? 'How many' : 'Your answer',
  );
  const field = make('input', {
    id: 'drill-answer',
    type: 'text',
    inputmode: item.stage.kind === 'COUNT' ? 'numeric' : 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });
  const go = make('button', { type: 'button', class: 'primary' }, 'Check this move');
  const sendIt = (): void => {
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
  holder.append(label, field, go);
  field.focus();
}

function answerDrill(item: DrillItem, entry: StudentEntry): void {
  if (drill === null) return;
  // The whole loop: solve, classify, say what happened. No session, no clock,
  // nothing written down.
  const result = classify(item.problem, solve(item.problem), item.stage, entry);
  drill.attempts.push({ skill: item.stage.counter, errorClass: result.errorClass });

  if (result.correct) {
    say('That is the move. Here is another one.');
    drill.index += 1;
    nextDrillItem();
    return;
  }

  renderDiagnosis(result.errorClass, result.why, result.logError, $('#drill-diagnosis'));
  // THE MOVE DOES NOT ADVANCE ON A WRONG ANSWER, same as a whole question: a
  // gate that opens on a wrong answer is a list of questions.
  renderDrillEntry(item);
  renderDrillNote();
}

function renderDrillNote(): void {
  if (drill === null) return;
  const outcome = readRun(drill.attempts);
  const latest: DrillNote | undefined = outcome.notes[outcome.notes.length - 1];
  if (latest === undefined) return;
  const key = `${latest.errorClass}@${String(latest.afterAttempt)}`;
  if (drill.saidNotes.has(key)) return;
  drill.saidNotes.add(key);
  const holder = $('#drill-note');
  holder.hidden = false;
  clear(holder);
  holder.append(make('p', {}, latest.text));
}

function endDrill(): void {
  if (drill === null) return;
  const outcome = readRun(drill.attempts);
  const list = $('#closing');
  clear(list);
  if (outcome.closing.length === 0) {
    // NOT A COUNT AND NOT A CONGRATULATION. A drill somebody stopped after two
    // clean moves has nothing to report, and saying "nothing went wrong" is
    // closer to true than any number would be.
    list.append(make('li', {}, 'Nothing in those went wrong the same way twice.'));
  }
  for (const line of outcome.closing) list.append(make('li', {}, line));
  $('#drill-note').hidden = true;
  drill = null;
  closingFrom = 'drill';
  $('#again').textContent = 'Practise another move';
  show('done');
}

/* ------------------------------------------------------------------ *
 * The closing
 * ------------------------------------------------------------------ */

function renderDone(): void {
  if (run === null) return;
  const outcome = readRun(run.attempts);
  const list = $('#closing');
  clear(list);
  // NO COUNT. `DrillOutcome` has no field for one, so there is nothing here to
  // render even if somebody wanted to.
  for (const line of outcome.closing) list.append(make('li', {}, line));
  $('#run-note').hidden = true;
  closingFrom = 'run';
  $('#again').textContent = 'Work on something else';
  show('done');
}

/* ------------------------------------------------------------------ *
 * Starting
 * ------------------------------------------------------------------ */

function begin(topic: Topic, tier: number, count: number, key: string): void {
  try {
    const session = startSession(
      {
        assignmentKey: key,
        topic,
        tier,
        count,
        mode: 'practice',
        // Practice records nothing and reports to nobody, so there is no
        // identity to carry. The roster number exists for assigned work and is
        // the only identity this app has anywhere.
        rosterNumber: null,
      },
      { now: () => Date.now() },
    );
    run = { session, attempts: [], saidNotes: new Set(), working: [] };
    $('#run-note').hidden = true;
    renderWork();
  } catch (error) {
    const why = error instanceof SessionError ? error.message : 'that set could not be built';
    say(`This run did not start: ${why}`);
  }
}

function renderStart(): void {
  const list = $('#topics');
  clear(list);
  for (const [topic, name] of Object.entries(TOPIC_NAMES) as [Topic, string][]) {
    const button = make('button', { type: 'button', class: 'topic' }, name);
    button.addEventListener('click', () => chooseDifficulty(topic));
    list.append(make('li', {}).appendChild(button).parentElement as HTMLLIElement);
  }
  show('start');
}

/**
 * Choosing how the questions are set, for a topic that has more than one way.
 *
 * NO SCREEN WHERE THERE IS NOTHING TO CHOOSE. Difficulty is per topic, and one
 * topic poses a single kind of question — putting a picker in front of it with
 * one thing in it would make the reader press a button to agree with the only
 * option there was.
 *
 * NOTHING IS LOCKED AND NOTHING PROMOTES ITSELF. A difficulty that arrives
 * because of how the last run went is a verdict on the reader delivered as a
 * feature, and one that has to be unlocked is the same verdict from the other
 * side. Every one of them is here on the first visit.
 */
function chooseDifficulty(topic: Topic): void {
  const ladder = laddersFor(topic);
  const only = ladder.length === 1 ? ladder[0] : undefined;
  if (only !== undefined) {
    begin(topic, only.tier, PRACTICE_COUNT, PRACTICE_KEY);
    return;
  }
  $('#difficulty-topic').textContent = TOPIC_NAMES[topic];
  const list = $('#difficulties');
  clear(list);
  for (const difficulty of ladder) {
    const button = make('button', { type: 'button', class: 'topic' }, difficulty.name);
    button.addEventListener('click', () => begin(topic, difficulty.tier, PRACTICE_COUNT, PRACTICE_KEY));
    list.append(make('li', {}).appendChild(button).parentElement as HTMLLIElement);
  }
  show('difficulty');
}

/* ------------------------------------------------------------------ *
 * The (i) panel, the what's-new panel, and routing
 * ------------------------------------------------------------------ */

function openDialog(id: string): void {
  const dialog = document.getElementById(id);
  if (dialog instanceof HTMLDialogElement) dialog.showModal();
}

function renderWhatsNew(): void {
  const list = $('#whats-new-list');
  clear(list);
  for (const release of RELEASES) {
    const item = make('li', {});
    item.append(make('h3', {}, `${release.version} — what changed`));
    const lines = make('ul', {});
    for (const line of release.lines) lines.append(make('li', {}, line));
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
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-notes-page]')) {
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
function route(): void {
  if (globalThis.location.hash === '#/warm-up') {
    const topics = Object.keys(TOPIC_NAMES) as Topic[];
    const first = topics[0];
    if (first !== undefined) begin(first, openingTier(first), WARM_UP_COUNT, PRACTICE_KEY);
    return;
  }
  if (globalThis.location.hash === '#/about') {
    openDialog('info');
    return;
  }
  if (globalThis.location.hash === '#/practise') {
    renderDrillPick();
    return;
  }
  if (run === null) renderStart();
}

/* ------------------------------------------------------------------ *
 * Preference controls
 * ------------------------------------------------------------------ */

function renderPrefControls(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-pref]')) {
    const name = button.dataset['pref'] ?? '';
    const value = button.dataset['value'] ?? '';
    let on = false;
    if (name === 'mode') on = prefs.mode === value;
    else if (name === 'textSize') on = prefs.textSize === value;
    else if (name === 'spacing') on = prefs.spacing === value;
    else if (name === 'oneStepAtATime') on = prefs.oneStepAtATime;
    else if (name === 'readAloud') on = prefs.readAloud;
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
function diagnosticText(): string {
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
      } catch {
        return 'unavailable';
      }
    })()}`,
    'settings: not included, on purpose',
  ];
  return lines.join('\n');
}

/**
 * The line that says which COPY of the app this device is holding.
 *
 * Filled in after the caches answer, which is why it is separate: the version
 * stamp above reports the code that is RUNNING, and on a stale app that is the
 * old code reporting itself perfectly accurately. The cache names are the only
 * thing that can tell "current" from "what this device still has".
 */
async function addCacheLine(): Promise<void> {
  const held = await heldCaches();
  const line = held.length === 0 ? 'stored copies: none' : `stored copies: ${held.join(', ')}`;
  const node = document.getElementById('diagnostic-text');
  if (node !== null) node.textContent = `${node.textContent ?? ''}\n${line}`;
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

export function boot(storeForTests?: Store): void {
  store = storeForTests ?? browserStore();
  prefs = readPrefs(store);
  applyPrefs();
  voice = deviceVoice();
  renderPrefControls();
  renderWhatsNew();

  $('#version').textContent = VERSION;
  $('#roster-max').textContent = String(MAX_ROSTER_NUMBER);

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-pref]')) {
    button.addEventListener('click', () => {
      const name = button.dataset['pref'] ?? '';
      const value = button.dataset['value'] ?? '';
      if (name === 'mode') setPref('mode', value as Prefs['mode']);
      else if (name === 'textSize') setPref('textSize', value as Prefs['textSize']);
      else if (name === 'spacing') setPref('spacing', value as Prefs['spacing']);
      else if (name === 'oneStepAtATime') setPref('oneStepAtATime', !prefs.oneStepAtATime);
      else if (name === 'readAloud') setPref('readAloud', !prefs.readAloud);
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
    if (closingFrom === 'drill') renderDrillPick();
    else renderStart();
  });
  $('#to-drill').addEventListener('click', () => {
    run = null;
    renderDrillPick();
  });
  $('#difficulty-back').addEventListener('click', () => {
    renderStart();
  });
  $('#drill-back').addEventListener('click', () => {
    drill = null;
    renderStart();
  });
  $('#drill-stop').addEventListener('click', () => endDrill());

  for (const closer of document.querySelectorAll<HTMLButtonElement>('[data-close]')) {
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
  } else if (decision.remember !== null) {
    store.set(NOTES_SEEN_KEY, decision.remember);
  }

  $('#diagnostic-text').textContent = diagnosticText();
  void addCacheLine();

  // A NEWER VERSION IS READY. The worker waits rather than taking over under
  // this page; this puts the words on screen and the reader decides when.
  watchForUpdate({
    offer(take) {
      const strip = $('#update-strip');
      strip.hidden = false;
      $('#update-take').addEventListener('click', () => take(), { once: true });
      $('#update-later').addEventListener('click', () => {
        strip.hidden = true;
      });
      // Said once, in the live region, so somebody not looking at the top of the
      // page is told too. Never repeated: the strip is standing, and repeating
      // it would talk over whatever they are doing.
      say($('#update-said').textContent ?? '');
    },
    withdraw() {
      $('#update-strip').hidden = true;
    },
  });

  wireScratch();
  globalThis.addEventListener('hashchange', route);

  const seenWelcome = store.get('solvent.welcomed') === VERSION || store.get('solvent.welcomed') === 'yes';
  if (seenWelcome) {
    $('#info-orientation-slot').append($('#orientation'));
    route();
  } else {
    store.set('solvent.welcomed', 'yes');
    show('welcome');
  }
}
