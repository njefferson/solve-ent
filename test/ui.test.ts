/**
 * ui.test.ts — the two browser-layer decisions that are not about pixels.
 *
 * Everything else in `src/ui/` needs a document and is measured by
 * `tools/a11y.mjs` in a real browser, on every surface in both modes. These two
 * are pure, and being pure is what lets them be asserted here — which matters,
 * because one of them is a privacy rule and the other is the difference between
 * a panel that informs somebody and a panel that ambushes them.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTES_SEEN_KEY, decideNotes } from '../src/ui/notes.ts';
import {
  DEFAULT_PREFS,
  documentAttributes,
  memoryStore,
  readPrefs,
  writePrefs,
  type Prefs,
} from '../src/ui/prefs.ts';
import { VERSION } from '../src/version.ts';

/* ---------------------------------------------------------------- */
/* The what's-new panel                                              */
/* ---------------------------------------------------------------- */

test('a first-time visitor is never shown what they missed by never having been here', () => {
  const decision = decideNotes(null, '0.5.0');
  assert.equal(decision.show, false);
  // And their SECOND visit is not treated as an upgrade either.
  assert.equal(decision.show === false ? decision.remember : null, '0.5.0');
});

test('somebody who has been here before, on a version that has moved, is shown it', () => {
  assert.equal(decideNotes('0.4.0', '0.5.0').show, true);
});

test('the same version is not shown twice', () => {
  const decision = decideNotes('0.5.0', '0.5.0');
  assert.equal(decision.show, false);
  // Nothing to write: they have already been marked as having seen this one,
  // and rewriting it on every load would be a storage write per page view.
  assert.equal(decision.show === false ? decision.remember : 'x', null);
});

test('storage that is unavailable reads as a newcomer, not as a panel on every load', () => {
  // A browser that refuses storage returns null forever. Treating that as "the
  // version has moved" would show the panel on every single load, to the reader
  // least able to make it stop.
  assert.equal(decideNotes(null, VERSION).show, false);
});

/* ---------------------------------------------------------------- */
/* Preferences, and the rule they carry                              */
/* ---------------------------------------------------------------- */

test('a reader with nothing stored gets the defaults, and the defaults are off', () => {
  const prefs = readPrefs(memoryStore());
  assert.deepEqual(prefs, DEFAULT_PREFS);
  assert.equal(prefs.readAloud, false);
  assert.equal(prefs.oneStepAtATime, false);
});

test('a stored value that means nothing falls back rather than reaching the document', () => {
  const store = memoryStore({
    'solvent.mode': 'chartreuse',
    'solvent.text-size': '9000',
    'solvent.spacing': 'yes please',
  });
  const prefs = readPrefs(store);
  assert.equal(prefs.mode, 'system');
  assert.equal(prefs.textSize, 'normal');
  assert.equal(prefs.spacing, 'normal');
});

test('what is written comes back', () => {
  const store = memoryStore();
  const chosen: Prefs = {
    mode: 'night',
    textSize: 'largest',
    spacing: 'open',
    oneStepAtATime: true,
    readAloud: true,
  };
  writePrefs(store, chosen);
  assert.deepEqual(readPrefs(store), chosen);
});

test('matching the device sets no theme attribute, so the media query decides', () => {
  // Writing data-theme="system" would match neither attribute rule in
  // tokens.css and read as a broken cascade rather than as the absence of a
  // choice.
  const attributes = documentAttributes({ ...DEFAULT_PREFS, mode: 'system' });
  assert.equal('data-theme' in attributes, false);
  assert.equal(documentAttributes({ ...DEFAULT_PREFS, mode: 'night' })['data-theme'], 'night');
});

test('a store that throws on every access does not take the app down with it', () => {
  const hostile = {
    get(): string | null {
      throw new Error('this browser blocks site data');
    },
    set(): void {
      throw new Error('this browser blocks site data');
    },
  };
  // readPrefs does not catch — browserStore does, which is the layer that knows
  // it is talking to a browser. So this asserts the CONTRACT: a store handed in
  // here is one that has already been made safe.
  assert.throws(() => readPrefs(hostile));
});

/* ---------------------------------------------------------------- */
/* The rule that has no field                                        */
/* ---------------------------------------------------------------- */

test('no accommodation can reach a session, a code or a report, because there is no field', () => {
  // AN ACCOMMODATION IS DISABILITY INFORMATION. A completion code carrying one
  // would make a student disclose it by handing in their work, over a channel
  // they cannot opt out of.
  //
  // Asserted by READING THE SOURCE rather than by inspecting an object, because
  // the rule is about what can never exist rather than about what happens to be
  // absent from one instance. Omitting a field from an output is a rule
  // somebody has to remember; having nowhere to read it from is a rule that
  // holds by itself.
  //
  // COMMENTS ARE STRIPPED FIRST, and that is load-bearing here for the same
  // reason it is in `tools/copy-check.mjs`: `steps.ts` explains this rule in
  // its own header, naming the preferences it must never carry. The first
  // version of this test failed on that sentence — the file saying "spacing
  // never reaches a session" is not a session carrying spacing. A check that
  // fails on the documentation of the rule it enforces teaches people to word
  // around it, which is how the rule quietly stops being written down.
  const strip = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const stepsCode = strip(readFileSync(new URL('../src/engine/steps.ts', import.meta.url), 'utf8'));
  for (const forbidden of ['readAloud', 'textSize', 'oneStepAtATime', 'spacing', 'accommodat', 'prefs', 'localStorage']) {
    assert.equal(
      stepsCode.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `src/engine/steps.ts has a field for "${forbidden}" — a session must have nowhere to put one`,
    );
  }
  // And the engine cannot even import the module they live in.
  const engineFiles = ['../src/engine/steps.ts', '../src/engine/problem.ts', '../src/engine/taxonomy.ts', '../src/report/drill.ts'];
  for (const file of engineFiles) {
    const code = strip(readFileSync(new URL(file, import.meta.url), 'utf8'));
    assert.equal(code.includes('../ui/'), false, `${file} imports from the browser layer`);
    assert.equal(code.includes('./ui/'), false, `${file} imports from the browser layer`);
  }
});

test('the key a version is remembered under is device-local and says nothing about a reader', () => {
  // A key name is a disclosure too. Anything on a shared device is readable by
  // the next person to open it.
  assert.match(NOTES_SEEN_KEY, /^solvent\./);
  for (const word of ['accommodation', 'disability', 'dyslexia', 'iep', 'student', 'name']) {
    assert.equal(NOTES_SEEN_KEY.toLowerCase().includes(word), false);
  }
});

/* ---------------------------------------------------------------- */
/* Speech: one letter apart                                          */
/* ---------------------------------------------------------------- */

test('nothing anywhere in this app constructs a speech recogniser', () => {
  // Synthesis is allowed. RECOGNITION turns on a microphone in a room full of
  // children, and the two live one letter apart in the same corner of the
  // platform. Read across the whole browser layer, not just the speech module,
  // because the point is that there is no path to it from anywhere.
  const files = ['../src/ui/speech.ts', '../src/ui/app.ts', '../src/ui/prefs.ts', '../src/ui/notes.ts'];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    // Stripped of comments first: speech.ts NAMES the forbidden API in its
    // header in order to forbid it, and a check that failed on its own
    // documentation would teach people to word around it.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['SpeechRecognition', 'webkitSpeechRecognition', 'getUserMedia', 'mediaDevices']) {
      assert.equal(code.includes(forbidden), false, `${file} reaches for ${forbidden}`);
    }
  }
});
