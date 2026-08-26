/**
 * teacher.ts — reading a completion code back, on the device it is read on.
 *
 * ## Why this decodes rather than describes
 *
 * The readout is produced by `readCode`, which is the same file that wrote the
 * code. A page that took the numbers from somewhere else and printed them
 * beside a code would be two accounts of one run, and the day they disagreed
 * the one on screen would be the one believed.
 *
 * ## Nothing here leaves the device
 *
 * No network call, no storage, nothing kept between codes. Whoever is reading
 * codes is holding a list of numbers, and this application has no business
 * keeping a copy of it.
 */

import { LADDERS, TOPIC_NAMES, type Topic } from '../engine/problem.ts';
import { SKILL_NAMES, COUNTER_SKILLS } from '../engine/taxonomy.ts';
import { CODE_LIMITS, readCode } from '../report/code.ts';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const option = (value: string, label: string): HTMLOptionElement => {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
};

const topicField = $<HTMLSelectElement>('topic');
const tierField = $<HTMLSelectElement>('tier');

for (const [topic, name] of Object.entries(TOPIC_NAMES) as [Topic, string][]) {
  topicField.append(option(topic, name));
}

/**
 * The difficulties of whichever topic is chosen.
 *
 * READ OFF `LADDERS`, so a topic that has one difficulty offers one here.
 * Listing three for every topic would ask whoever set the work to pick
 * something the application cannot pose.
 */
function fillTiers(): void {
  const topic = topicField.value as Topic;
  tierField.replaceChildren();
  for (const difficulty of LADDERS[topic]) {
    tierField.append(option(String(difficulty.tier), difficulty.name));
  }
}
topicField.addEventListener('change', fillTiers);
fillTiers();

/** What a refusal means, in the words of the thing that actually went wrong. */
const WHY: Readonly<Record<string, string>> = {
  EMPTY: 'There is no code in the box yet.',
  LENGTH: 'A code is sixteen characters. That one is a different length, so something was dropped or added on the way.',
  CHARACTER: 'There is a character in that which a code never contains. Codes leave out I, L, O and U so that handwriting cannot turn one into another.',
  CHECK: 'That does not read against this set. Either a character is wrong, or the code belongs to a different key, topic or difficulty from the one entered above.',
  VERSION: 'That code was written by a different version of this app, and reading it with this one would mean guessing at what its parts stand for.',
};

function show(): void {
  const result = $('result');
  const list = $('result-list');
  const limits = $('result-limits');
  list.replaceChildren();
  limits.hidden = true;

  const reading = readCode($<HTMLInputElement>('code').value, {
    key: $<HTMLInputElement>('key').value.trim(),
    topic: topicField.value as Topic,
    tier: Number(tierField.value),
  });

  const line = (text: string): void => {
    const item = document.createElement('li');
    item.textContent = text;
    list.append(item);
  };

  if (reading.kind === 'unreadable') {
    $('result-title').textContent = 'That code did not read';
    line(WHY[reading.why] ?? 'That did not read as a code.');
    result.hidden = false;
    return;
  }

  const it = reading.contents;
  $('result-title').textContent = 'What the code says';
  line(`Number ${String(it.rosterNumber)}.`);
  line(`Steps attempted: ${String(it.attempted)}.`);
  line(`Right first time: ${String(it.rightFirstTime)}.`);
  line(`Time taken: about ${String(it.minutes)} minute${it.minutes === 1 ? '' : 's'}.`);

  const wrong = COUNTER_SKILLS.filter((skill) => it.wrongBySkill[skill] > 0);
  if (wrong.length === 0) {
    line('No step went wrong more than once.');
  } else {
    for (const skill of wrong) {
      const n = it.wrongBySkill[skill];
      const atCeiling = n === CODE_LIMITS.perSkill;
      line(`${SKILL_NAMES[skill]}: ${String(n)}${atCeiling ? ' or more' : ''} wrong.`);
    }
  }

  if (it.atLimit.length > 0) {
    // A SATURATED FIELD IS A FLOOR, NOT A NUMBER, and saying so is the whole
    // difference between a reading and a guess.
    limits.textContent =
      'One or more parts of this code ran out of room, so they are the most the code can say rather than what happened: ' +
      `${it.atLimit.join(', ')}. A longer run than the code was built for is the usual reason.`;
    limits.hidden = false;
  }
  result.hidden = false;
}

$('read').addEventListener('click', show);
$<HTMLInputElement>('code').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    show();
  }
});
