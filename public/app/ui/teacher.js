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
import { LADDERS, TOPIC_NAMES } from '../engine/problem.js';
import { SKILL_NAMES, COUNTER_SKILLS } from '../engine/taxonomy.js';
import { CODE_LIMITS, readCode } from '../report/code.js';
const $ = (id) => document.getElementById(id);
const option = (value, label) => {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    return node;
};
const topicField = $('topic');
const tierField = $('tier');
for (const [topic, name] of Object.entries(TOPIC_NAMES)) {
    topicField.append(option(topic, name));
}
/**
 * The difficulties of whichever topic is chosen.
 *
 * READ OFF `LADDERS`, so a topic that has one difficulty offers one here.
 * Listing three for every topic would ask whoever set the work to pick
 * something the application cannot pose.
 */
function fillTiers() {
    const topic = topicField.value;
    tierField.replaceChildren();
    for (const difficulty of LADDERS[topic]) {
        tierField.append(option(String(difficulty.tier), difficulty.name));
    }
}
topicField.addEventListener('change', fillTiers);
fillTiers();
/** What a refusal means, in the words of the thing that actually went wrong. */
const WHY = {
    EMPTY: 'There is no code in the box yet.',
    LENGTH: 'A code is sixteen characters. That one is a different length, so something was dropped or added on the way.',
    CHARACTER: 'There is a character in that which a code never contains. Codes leave out I, L, O and U so that handwriting cannot turn one into another.',
    CHECK: 'That does not read against this set. Either a character is wrong, or the code belongs to a different key, topic or difficulty from the one entered above.',
    VERSION: 'That code was written by a different version of this app, and reading it with this one would mean guessing at what its parts stand for.',
};
/** The set as whoever gave it out has just described it. */
const currentSet = () => ({
    key: $('key').value.trim(),
    topic: topicField.value,
    tier: Number(tierField.value),
});
/**
 * One code, rendered as its own block.
 *
 * NEVER A ROW IN A GRID. This is read on a tablet with a stack of paper beside
 * it, and columns are where that falls apart first.
 *
 * IT RETURNS THE READING AS WELL AS THE NODE, because the totals underneath
 * need it. The first version decoded each code twice and told the two apart by
 * reading a CSS class off the element it had just built — a second source of
 * truth for a question the first one had already answered.
 */
function renderOne(index, raw) {
    const node = document.createElement('li');
    const reading = readCode(raw, currentSet());
    const head = document.createElement('p');
    head.className = 'code-head';
    const body = document.createElement('ul');
    const line = (text) => {
        const item = document.createElement('li');
        item.textContent = text;
        body.append(item);
    };
    if (reading.kind === 'unreadable') {
        head.textContent = `Line ${String(index + 1)} — did not read`;
        node.className = 'code-refused';
        line(WHY[reading.why] ?? 'That did not read as a code.');
        // THE LINE ITSELF, so whoever is holding the paper can find the one they
        // are looking at.
        if (raw.trim() !== '')
            line(`What was on the line: ${raw.trim().slice(0, 40)}`);
        node.append(head, body);
        return { node, reading };
    }
    const it = reading.contents;
    head.textContent = `Number ${String(it.rosterNumber)}`;
    line(`Steps attempted: ${String(it.attempted)}.`);
    line(`Right first time: ${String(it.rightFirstTime)}.`);
    line(`Time taken: about ${String(it.minutes)} minute${it.minutes === 1 ? '' : 's'}.`);
    const wrong = COUNTER_SKILLS.filter((skill) => it.wrongBySkill[skill] > 0);
    if (wrong.length === 0) {
        line('No step went wrong more than once.');
    }
    else {
        for (const skill of wrong) {
            const n = it.wrongBySkill[skill];
            line(`${SKILL_NAMES[skill]}: ${String(n)}${n === CODE_LIMITS.perSkill ? ' or more' : ''} wrong.`);
        }
    }
    if (it.atLimit.length > 0) {
        line(`Ran out of room, so these are the most the code can say rather than what happened: ${it.atLimit.join(', ')}.`);
    }
    node.append(head, body);
    return { node, reading };
}
function show() {
    const result = $('result');
    const list = $('result-list');
    const across = $('across');
    const acrossList = $('across-list');
    list.replaceChildren();
    acrossList.replaceChildren();
    // ONE PER LINE, and a blank line is nothing rather than a failure — a pasted
    // stack has them at the end and sometimes in the middle.
    const lines = $('code').value.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) {
        $('result-title').textContent = 'Nothing to read yet';
        $('result-tally').textContent = 'Paste the codes into the box above, one on each line.';
        result.hidden = false;
        across.hidden = true;
        return;
    }
    /** Which line each roster number first appeared on. */
    const seen = new Map();
    const totals = new Map();
    let readCount = 0;
    lines.forEach((raw, index) => {
        const { node, reading } = renderOne(index, raw);
        if (reading.kind === 'read') {
            readCount += 1;
            const roster = reading.contents.rosterNumber;
            const before = seen.get(roster);
            if (before === undefined) {
                seen.set(roster, index + 1);
            }
            else {
                // A NUMBER TWICE IS WORTH SAYING AND NOT WORTH DECIDING ABOUT. It
                // happens when a code is written down twice, and it happens when two
                // people were given the same number. This cannot tell those apart and
                // does not guess at which it was.
                const note = document.createElement('li');
                note.textContent = `This number also came up on line ${String(before)}.`;
                node.querySelector('ul')?.prepend(note);
            }
            for (const skill of COUNTER_SKILLS) {
                const n = reading.contents.wrongBySkill[skill];
                if (n > 0)
                    totals.set(skill, (totals.get(skill) ?? 0) + n);
            }
        }
        list.append(node);
    });
    // A HEADING THAT SAYS WHAT HAPPENED. "What the codes say" over a list where
    // none of them said anything is a heading that has to be read past.
    $('result-title').textContent =
        readCount === 0
            ? lines.length === 1
                ? 'That code did not read'
                : 'None of those read'
            : lines.length === 1
                ? 'What the code says'
                : 'What the codes say';
    // TWO NUMBERS, NOT A FRACTION. How many read and how many did not are two
    // facts about a stack of paper; one written over the other reads like a mark.
    const refused = lines.length - readCount;
    $('result-tally').textContent =
        `Read: ${String(readCount)}. Did not read: ${String(refused)}.` +
            (refused > 0 ? ' The ones that did not are in place below, each saying what went wrong with it.' : '');
    result.hidden = false;
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) {
        across.hidden = true;
        return;
    }
    for (const [skill, total] of ranked) {
        const node = document.createElement('li');
        node.textContent = `${SKILL_NAMES[skill]}: ${String(total)} wrong across the stack.`;
        acrossList.append(node);
    }
    across.hidden = false;
}
$('read').addEventListener('click', show);
// NO ENTER-TO-READ. The box takes a whole stack now, and Enter is how a new
// line gets into it — binding that to "read them" would fight the paste.
