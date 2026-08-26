#!/usr/bin/env node
/**
 * a11y.mjs — the accessibility gate. Every surface, both modes, dialogs open.
 *
 *   node tools/a11y.mjs            measure and report
 *   node tools/a11y.mjs --verbose  every reading, not only the failures
 *
 * ## The surface list is the point, and it is asserted rather than trusted
 *
 * A new screen that does not join this list ships unmeasured, and a gate that
 * walks a hand-written list cannot tell "this surface is fine" from "this
 * surface is not in my list". So {@link STATES} is compared against every
 * `[data-surface]` the document actually contains, and a surface in the DOM
 * that is not measured here FAILS. That is hub LESSONS §28, made mechanical;
 * it has cost a release in a sibling app.
 *
 * ## Most controls live inside dialogs
 *
 * A resting-state sweep reports a clean bill of health it has not earned: the
 * settings, the install instructions, the diagnostic and the release notes are
 * all inside `<dialog>`s that a resting page never opens. Both dialogs are
 * their own states here, opened before anything is measured.
 *
 * ## Contrast: the gradient is enumerated, not sampled
 *
 * `getComputedStyle` reports a gradient page as transparent, so walking up for
 * an opaque ancestor falls through to a fallback and confidently reports the
 * wrong backdrop — the trap that had a *light* page reading 1.11:1 against
 * black elsewhere in this family (PALETTES.md §7).
 *
 * Sampling a screenshot pixel fixes that for the position sampled. This does
 * something stricter: the body gradient runs between two KNOWN tokens, so text
 * over it is checked against **both stops** and the worse reading is the one
 * that counts. Interpolation in sRGB stays between the endpoints channel by
 * channel, so bounding the ends bounds every position — which is more than a
 * sample can say, and needs no pixels.
 *
 * ## The role invariant
 *
 * Every colour that reaches the screen must reverse-map to a token from
 * `tokens.css`. A hardcoded hex in a stylesheet is a colour the palette gate
 * has never measured, and it is invisible precisely because it looks right to
 * whoever picked it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC = join(REPO, 'public');
const VERBOSE = process.argv.includes('--verbose');
/** Print the observed role pairings and nothing else, for palettes/solve-ent.json. */
const PAIRS_ONLY = process.argv.includes('--pairs');
const AXE = readFileSync(join(REPO, 'node_modules/axe-core/axe.min.js'), 'utf8');

/**
 * The version this build is, read from the one place it is written.
 *
 * Seeding "already seen" with any other string means "seen an OLDER version",
 * which is exactly the condition that opens the what's-new panel — so the first
 * run of this file had that panel over every surface it was trying to measure,
 * and every click timed out against its backdrop. A placeholder is not a
 * neutral value when the thing being stored is compared for equality.
 */
const VERSION = /export const VERSION = '([^']+)'/.exec(
  readFileSync(join(REPO, 'src/version.ts'), 'utf8'),
)?.[1];
if (VERSION === undefined) {
  console.error('src/version.ts does not export a VERSION this can read.');
  process.exit(1);
}

/* ---------------- floors, each with the judgement beside it ---------------- */

/** Text contrast. AA is 4.5; a value specced AT the line drifts under it. */
const TEXT_FLOOR = 4.6;
/** Large text, per WCAG 1.4.3. Same reasoning: 3.0 plus a margin. */
const LARGE_TEXT_FLOOR = 3.1;
/** What counts as large: 24px, or 18.66px when bold. */
const LARGE_PX = 24;
const LARGE_BOLD_PX = 18.66;
const BOLD = 700;
/** A finger. 44 is the smaller of the two published figures and the one to clear. */
const TAP_FLOOR = 44;
/** Nothing a reader has to read is smaller than this. */
const MIN_TEXT_PX = 11;

/* ---------------- the surfaces ---------------- */

/**
 * Every state a reader can be in.
 *
 * `surface` is the `[data-surface]` this state puts on screen, or null for a
 * state that is a dialog over one. Every `[data-surface]` in the document must
 * be named by at least one entry.
 */
const STATES = [
  {
    name: 'welcome',
    surface: 'welcome',
    path: '/',
    async reach() {},
  },
  {
    name: 'start',
    surface: 'start',
    path: '/',
    async reach(page) {
      await page.click('#begin');
    },
  },
  {
    name: 'work',
    surface: 'work',
    path: '/',
    async reach(page) {
      await page.click('#begin');
      await page.locator('#topics button').first().click();
    },
  },
  {
    // ITS OWN STATE. The diagnosis panel is the thing this app exists to show
    // and it is only ever on screen after a wrong step, which a resting sweep
    // never produces. It shipped unmeasured for a day in a sibling app.
    name: 'work-diagnosed',
    surface: 'work',
    path: '/',
    async reach(page) {
      await page.click('#begin');
      await page.locator('#topics button').first().click();
      await wrongStep(page);
    },
  },
  {
    name: 'done',
    surface: 'done',
    path: '/',
    async reach(page) {
      await page.click('#begin');
      await page.locator('#topics button').first().click();
      await finishRun(page);
    },
  },
  {
    name: 'info-dialog',
    surface: null,
    path: '/',
    async reach(page) {
      await page.click('#begin');
      await page.click('#open-info');
    },
  },
  {
    name: 'whats-new-dialog',
    surface: null,
    path: '/',
    async reach(page) {
      await page.evaluate(() => {
        const dialog = document.getElementById('whats-new');
        if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
      });
    },
  },
  {
    name: 'notes-page',
    surface: 'notes',
    path: '/whats-new',
    async reach() {},
  },
];

/** Get one step wrong on purpose. Works for a typed step and for a choice. */
async function wrongStep(page) {
  if ((await page.locator('#answer').count()) > 0) {
    await page.fill('#answer', '0.00042');
    await page.locator('#entry .primary').click();
    return;
  }
  // A choice: press each until one is wrong. The correct option is not always
  // first, so pressing the first is not reliably a wrong answer.
  for (let i = 0; i < 6; i += 1) {
    const buttons = page.locator('.choice');
    if ((await buttons.count()) === 0) return;
    await buttons.first().click();
    if (!(await page.locator('#diagnosis').isHidden())) return;
  }
}

/** Answer until the run finishes, getting a couple wrong along the way. */
async function finishRun(page) {
  for (let guard = 0; guard < 400; guard += 1) {
    if (await page.locator('[data-surface="done"]').isVisible()) return;
    const typed = await page.locator('#answer').count();
    if (typed > 0) {
      // No access to the answer from here — by design, since this harness drives
      // the same screen a reader uses and that screen has never been told it.
      // So: exhaust the step by trying, and move the run on by pressing on.
      await page.fill('#answer', String(guard + 1));
      await page.locator('#entry .primary').click();
    } else if ((await page.locator('.choice').count()) > 0) {
      await page.locator('.choice').first().click();
    } else {
      return;
    }
    await page.waitForTimeout(10);
  }
}

/* ---------------- colour maths (WCAG 2.x) ---------------- */

const lin = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const Lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const x = Lum(a);
  const y = Lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/**
 * Any CSS colour this app writes → `{rgb, alpha}`.
 *
 * **HEX HAS TO BE HANDLED HERE OR EVERY COMPARISON IS BETWEEN DIFFERENT
 * ALPHABETS.** A custom property comes back from `getComputedStyle` as it was
 * AUTHORED — `#f4ecdd` — while the colour that reached the screen comes back
 * resolved — `rgb(244, 236, 221)`. Those are one colour. The first version of
 * this ran the digit regex over `#f4ecdd`, got `[4, 44]` out of it, and
 * reported that every surface in the day palette mapped to no token.
 *
 * This is the string-comparison trap from PALETTES.md §7 wearing a different
 * coat, and it is worth knowing it has two of them: the other is `rgba(39,33,25,.22)`
 * authored against `rgba(39, 33, 25, 0.22)` computed, which are the same value
 * and different strings. Everything below compares NUMBERS.
 */
function parse(css) {
  if (typeof css !== 'string') return null;
  const text = css.trim();
  if (text === '' || text === 'transparent' || text === 'none') return null;
  if (text.startsWith('#')) {
    const body = text.slice(1);
    const wide = body.length <= 4 ? body.split('').map((c) => c + c).join('') : body;
    if (!/^[0-9a-fA-F]{6,8}$/.test(wide)) return null;
    const rgb = [0, 2, 4].map((i) => parseInt(wide.slice(i, i + 2), 16));
    const alpha = wide.length === 8 ? parseInt(wide.slice(6, 8), 16) / 255 : 1;
    return { rgb, alpha };
  }
  const numbers = (text.match(/[\d.]+/g) ?? []).map(Number);
  if (numbers.length < 3) return null;
  return { rgb: numbers.slice(0, 3), alpha: numbers.length > 3 ? numbers[3] : 1 };
}

/** Two colours, compared as numbers. Never as strings — see `parse`. */
function sameColour(a, b) {
  const x = parse(a);
  const y = parse(b);
  if (x === null || y === null) return false;
  return (
    x.rgb.every((channel, i) => Math.round(channel) === Math.round(y.rgb[i])) &&
    Math.abs(x.alpha - y.alpha) < 0.005
  );
}
const over = (ink, alpha, bg) => [0, 1, 2].map((i) => ink[i] * alpha + bg[i] * (1 - alpha));

/* ---------------- the measurement, run inside the page ---------------- */

/**
 * Collect what the page actually renders.
 *
 * Everything here is READ, never judged: the judging happens in Node, where a
 * failure can be printed with its reasoning. A check that decides inside the
 * page can only send back a boolean.
 */
const COLLECT = `(() => {
  const seen = [];
  const nodes = document.querySelectorAll('body *');
  const visible = (el) => {
    if (el.hidden) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    // Inside a closed dialog, or clipped away for a screen reader only.
    if (el.closest('dialog:not([open])') !== null) return false;
    if (el.closest('.visually-hidden') !== null) return false;
    return true;
  };
  const ownText = (el) => {
    let out = '';
    for (const child of el.childNodes) if (child.nodeType === 3) out += child.nodeValue;
    return out.trim();
  };
  const backdropOf = (el) => {
    let node = el;
    while (node !== null && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      const parsed = bg.match(/[\\d.]+/g);
      if (parsed !== null && (parsed.length < 4 || Number(parsed[3]) > 0.999)) {
        return { color: bg, from: node.tagName.toLowerCase() };
      }
      node = node.parentElement;
    }
    // Fell through to the gradient body. Say so rather than inventing a colour;
    // the caller checks both gradient stops.
    return { color: null, from: 'gradient' };
  };
  const interactive = (el) =>
    el.matches('button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])');
  // A link INSIDE A SENTENCE is exempt from the target floor, per WCAG 2.5.8's
  // inline exception. Named here rather than skipped quietly.
  const inlineInSentence = (el) => {
    if (el.tagName !== 'A') return false;
    const parent = el.parentElement;
    if (parent === null) return false;
    // THE PARENT HAS TO BE PROSE. The first version asked only whether the
    // parent held other text, which exempted a link sitting in a header beside
    // a wordmark — not a sentence, and a real 44px target that was being let
    // off. An exemption that fires where it should not is worse than no
    // exemption: it reads as a measurement.
    if (!['P', 'LI', 'SPAN', 'TD', 'DD', 'FIGCAPTION', 'EM', 'STRONG'].includes(parent.tagName)) return false;
    // And the link must be surrounded by words rather than be the whole of it.
    const around = (parent.textContent ?? '').trim().length - (el.textContent ?? '').trim().length;
    if (around < 4) return false;
    return getComputedStyle(el).display.startsWith('inline');
  };

  for (const el of nodes) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const text = ownText(el);
    seen.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: el.className && typeof el.className === 'string' ? el.className : '',
      text: text.slice(0, 60),
      hasText: text.length > 0,
      color: s.color,
      backgroundColor: s.backgroundColor,
      borderTopColor: s.borderTopColor,
      borderLeftColor: s.borderLeftColor,
      borderTopWidth: parseFloat(s.borderTopWidth),
      borderLeftWidth: parseFloat(s.borderLeftWidth),
      outlineColor: s.outlineColor,
      fontSize: parseFloat(s.fontSize),
      fontWeight: Number(s.fontWeight) || 400,
      backdrop: backdropOf(el),
      width: rect.width,
      height: rect.height,
      interactive: interactive(el),
      inlineInSentence: inlineInSentence(el),
    });
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const token = (name) => rootStyle.getPropertyValue(name).trim();
  return {
    seen,
    tokens: {
      page: token('--page'),
      pageAlt: token('--page-alt'),
      surface: token('--surface'),
      surfaceRaised: token('--surface-raised'),
      surfacePressed: token('--surface-pressed'),
      rail: token('--rail'),
      hairline: token('--hairline'),
      text: token('--text'),
      text2: token('--text-2'),
      text3: token('--text-3'),
      accent: token('--accent'),
      accentSoft: token('--accent-soft'),
      chrome: token('--chrome'),
    },
    surfaces: [...document.querySelectorAll('[data-surface]')].map((n) => n.dataset.surface),
    landmarks: {
      main: document.querySelectorAll('main').length,
      header: document.querySelectorAll('header').length,
      h2: [...document.querySelectorAll('h2')].filter((h) => h.offsetParent !== null || h.closest('dialog[open]')).length,
    },
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  };
})()`;

/* ---------------- the pairings this app actually paints ---------------- */

/**
 * Which role each rendered colour came from, and therefore which pairings exist.
 *
 * **MEASURED, NEVER TYPED.** The hub's palette gate measures the full cross
 * product of roles, which is what makes a palette portable — but most of that
 * cross product is about screens nobody has built. It accepts a `_renders` list
 * of the pairings an app was OBSERVED to paint, and demotes a missed floor off
 * that list from a defect to a forecast. A hand-written list would be a claim
 * about the app rather than a fact about it, and would go stale on the first
 * commit that puts a hint on a highlighted row.
 *
 * So this reads them off the browser, in the gate's own key format, and
 * `--pairs` prints them. `tools/palette.mjs --check` compares the recorded list
 * against a fresh reading and fails on any difference, so the two cannot drift.
 */
const ROLE_OF_TEXT = [
  ['text', '--text'],
  ['text2', '--text-2'],
  ['text3', '--text-3'],
];
const ROLE_OF_FILL = [
  ['page', '--page'],
  ['pageAlt', '--page-alt'],
  ['surface', '--surface-1'],
  ['surfaceRaised', '--surface-2'],
  ['surfacePressed', '--surface-3'],
];

/** The colour an accent tint makes over a given fill, so a tinted fill is recognisable. */
function tinted(accentSoftCss, fillCss) {
  const ink = parse(accentSoftCss);
  const bg = parse(fillCss);
  if (ink === null || bg === null) return null;
  return over(ink.rgb, ink.alpha, bg.rgb);
}

function recordPairings(data, into) {
  const textRole = new Map(
    ROLE_OF_TEXT.map(([key, role]) => [parse(data.tokens[key])?.rgb.map(Math.round).join(','), role]).filter(
      ([key]) => key !== undefined,
    ),
  );
  const fillRole = new Map(
    ROLE_OF_FILL.map(([key, role]) => [parse(data.tokens[key])?.rgb.map(Math.round).join(','), role]).filter(
      ([key]) => key !== undefined,
    ),
  );
  const tintRole = new Map();
  for (const [key, role] of ROLE_OF_FILL) {
    const composite = tinted(data.tokens.accentSoft, data.tokens[key]);
    if (composite !== null) tintRole.set(composite.map(Math.round).join(','), role);
  }

  for (const item of data.seen) {
    if (!item.hasText) continue;
    const ink = parse(item.color);
    if (ink === null) continue;
    const name = textRole.get(ink.rgb.map(Math.round).join(','));
    if (name === undefined) continue;

    const note = (key) => {
      const asTint = tintRole.get(key);
      if (asTint !== undefined) into.add(`${name} on --accent-soft over ${asTint}`);
      const asFill = fillRole.get(key);
      if (asFill !== undefined) into.add(`${name} on ${asFill}`);
      return asTint !== undefined || asFill !== undefined;
    };
    const key = (rgb) => rgb.map(Math.round).join(',');

    // WHAT THE TEXT IS ACTUALLY ON. The accent tint is TRANSLUCENT — that is
    // what makes it a tint — so `backgroundColor` alone walks straight past it
    // to the opaque ancestor beneath. The first version of this reader did
    // exactly that and reported eleven pairings with no accent-soft among them,
    // on an app whose primary buttons are all accent-soft. A translucent fill
    // composited over its backdrop IS a real backdrop, and the pairing the
    // hub's check was widened for is precisely this one.
    const own = parse(item.backgroundColor);
    const under = parse(item.backdrop.color ?? '');
    const stops = under !== null ? [under.rgb] : [parse(data.tokens.page), parse(data.tokens.pageAlt)]
      .filter((c) => c !== null)
      .map((c) => c.rgb);

    if (own !== null && own.alpha > 0.999) {
      note(key(own.rgb));
      continue;
    }
    if (own !== null && own.alpha > 0) {
      for (const stop of stops) note(key(over(own.rgb, own.alpha, stop)));
      continue;
    }
    if (under !== null) {
      note(key(under.rgb));
      continue;
    }
    // Over the gradient: both stops are real backdrops for this text.
    into.add(`${name} on --page`);
    into.add(`${name} on --page-alt`);
  }
}

/* ---------------- the checks ---------------- */

function checkState(state, mode, data, findings) {
  const where = `${state.name} · ${mode}`;
  const stops = [data.tokens.page, data.tokens.pageAlt].map(parse).filter((c) => c !== null);

  /** Every backdrop this element could be sitting on. More than one over the gradient. */
  const backdropsFor = (item) => {
    if (item.backdrop.color !== null) {
      const parsed = parse(item.backdrop.color);
      return parsed === null ? [] : [parsed.rgb];
    }
    return stops.map((s) => s.rgb);
  };

  let textChecked = 0;
  let tapChecked = 0;

  for (const item of data.seen) {
    /* ---- text contrast ---- */
    if (item.hasText) {
      const ink = parse(item.color);
      const large =
        item.fontSize >= LARGE_PX || (item.fontWeight >= BOLD && item.fontSize >= LARGE_BOLD_PX);
      const floor = large ? LARGE_TEXT_FLOOR : TEXT_FLOOR;
      for (const bg of backdropsFor(item)) {
        if (ink === null) continue;
        const resolved = ink.alpha >= 1 ? ink.rgb : over(ink.rgb, ink.alpha, bg);
        const ratio = contrast(resolved, bg);
        textChecked += 1;
        if (ratio < floor) {
          findings.push(
            `${where}: text ${ratio.toFixed(2)} (floor ${floor}) on ${item.tag}${item.id ? '#' + item.id : ''} — "${item.text}"`,
          );
        }
      }
      if (item.fontSize < MIN_TEXT_PX) {
        findings.push(`${where}: ${item.fontSize}px text on ${item.tag} — "${item.text}"`);
      }
    }

    /* ---- the load-bearing edge ---- */
    if (item.borderTopWidth > 0 || item.borderLeftWidth > 0) {
      const edge = parse(item.borderTopWidth > 0 ? item.borderTopColor : item.borderLeftColor);
      // A HAIRLINE IS DECORATION AND IS EXEMPT BY DESIGN (PALETTES.md §1); a
      // rail carries a boundary and is held to 3.4. Compared numerically,
      // because `.22` authored and `0.22` computed are the same value.
      const isHairline =
        sameColour(item.borderTopColor, data.tokens.hairline) ||
        sameColour(item.borderLeftColor, data.tokens.hairline);
      if (edge !== null && !isHairline && edge.alpha > 0) {
        for (const bg of backdropsFor(item)) {
          const resolved = edge.alpha >= 1 ? edge.rgb : over(edge.rgb, edge.alpha, bg);
          const ratio = contrast(resolved, bg);
          // 1.4.11 is 3.0; a 1px edge renders about 0.15 below its arithmetic
          // because of antialiasing, so the floor carries that.
          if (ratio < 3.4) {
            findings.push(`${where}: rail ${ratio.toFixed(2)} (floor 3.4) on ${item.tag}${item.id ? '#' + item.id : ''}`);
          }
        }
      }
    }

    /* ---- what a finger has to hit ---- */
    if (item.interactive) {
      tapChecked += 1;
      if (item.inlineInSentence) {
        // EXEMPT AND NAMED: WCAG 2.5.8's inline exception. A link inside a
        // sentence cannot be 44px tall without breaking the sentence.
        if (VERBOSE) console.log(`  note  ${where}: ${item.tag} exempt from the target floor — inline in a sentence`);
      } else if (item.width < TAP_FLOOR || item.height < TAP_FLOOR) {
        findings.push(
          `${where}: ${Math.round(item.width)}x${Math.round(item.height)} target (floor ${TAP_FLOOR}) on ${item.tag}${item.id ? '#' + item.id : ''} — "${item.text}"`,
        );
      }
    }
  }

  /* ---- the role invariant: every colour reverse-maps to a token ---- */
  const known = new Set(
    Object.values(data.tokens)
      .map((value) => parse(value))
      .filter((c) => c !== null)
      .map((c) => c.rgb.map(Math.round).join(',')),
  );
  const unmapped = new Map();
  for (const item of data.seen) {
    for (const [role, css] of [
      ['text', item.color],
      ['fill', item.backgroundColor],
      ['edge', item.borderTopWidth > 0 ? item.borderTopColor : null],
    ]) {
      if (css === null) continue;
      const parsed = parse(css);
      if (parsed === null || parsed.alpha === 0) continue;
      const key = parsed.rgb.map(Math.round).join(',');
      if (!known.has(key)) unmapped.set(`${role} rgb(${key})`, `${item.tag}${item.id ? '#' + item.id : ''}`);
    }
  }
  for (const [colour, node] of unmapped) {
    findings.push(`${where}: ${colour} on ${node} maps to no token — the palette gate has never measured it`);
  }

  /* ---- landmarks and headings ---- */
  if (data.landmarks.main !== 1) findings.push(`${where}: ${data.landmarks.main} <main> landmark(s)`);
  if (data.landmarks.h2 < 1) findings.push(`${where}: no visible level-2 heading`);

  /* ---- the status bar follows the mode ---- */
  if (data.themeColor !== null) {
    const wanted = parse(data.tokens.chrome);
    const painted = parse(data.themeColor);
    if (wanted !== null && painted !== null && wanted.rgb.join(',') !== painted.rgb.join(',')) {
      findings.push(
        `${where}: the status bar is painted ${data.themeColor} and this mode's chrome is ${data.tokens.chrome}`,
      );
    }
  }

  return { textChecked, tapChecked };
}

/* ---------------- run ---------------- */

const MODES = ['day', 'night'];

const server = await serve(PUBLIC);
const browser = await chromium.launch();
const findings = [];
let totalText = 0;
let totalTaps = 0;
let axeViolations = 0;
const surfacesSeen = new Set();
const pairings = new Set();
const surfacesMeasured = new Set(STATES.map((s) => s.surface).filter((s) => s !== null));

if (!PAIRS_ONLY) console.log('\n=== accessibility · Solve-ent ===\n');

for (const mode of MODES) {
  for (const state of STATES) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
    });

    // The mode is set BEFORE the first load, not toggled after, so what is
    // measured is what somebody with that preference actually gets served.
    await page.addInitScript(
      ({ chosen, version }) => {
        try {
          globalThis.localStorage.setItem('solvent.mode', chosen);
          // Already seen THIS version, so the what's-new panel is not over the
          // surface being measured. It has its own state in the list, where it
          // is opened deliberately.
          globalThis.localStorage.setItem('solvent.notes-seen', version);
          // Not welcomed, so the welcome surface is reachable and every other
          // state gets there by pressing what a reader presses.
          globalThis.localStorage.setItem('solvent.welcomed', 'no');
        } catch { /* nothing to do */ }
      },
      { chosen: mode, version: VERSION },
    );

    await page.goto(`${server.origin}${state.path}`);
    await page.waitForTimeout(120);
    await state.reach(page);
    await page.waitForTimeout(120);

    const data = await page.evaluate(COLLECT);
    for (const surface of data.surfaces) surfacesSeen.add(surface);

    recordPairings(data, pairings);
    const counts = checkState(state, mode, data, findings);
    totalText += counts.textChecked;
    totalTaps += counts.tapChecked;

    /* ---- axe, for everything a hand-written check would not think of ---- */
    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () =>
      // eslint-disable-next-line no-undef
      await globalThis.axe.run(document, { resultTypes: ['violations'] }),
    );
    for (const violation of axe.violations) {
      // Contrast is measured above, against the enumerated gradient stops. axe
      // walks for an opaque ancestor and reports "incomplete" or worse over a
      // gradient, which is the trap this file's header is about.
      if (violation.id === 'color-contrast') continue;
      axeViolations += 1;
      findings.push(`${state.name} · ${mode}: axe ${violation.id} — ${violation.help} (${violation.nodes.length} node(s))`);
    }

    /* ---- a REAL Tab, because :focus-visible never matches a scripted focus ---- */
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      const s = getComputedStyle(el);
      return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor, tag: el.tagName };
    });
    if (ring !== null && (ring.width < 1 || ring.style === 'none')) {
      findings.push(`${state.name} · ${mode}: the first tab stop (${ring.tag}) has no focus ring`);
    }

    for (const error of pageErrors) findings.push(`${state.name} · ${mode}: the page threw — ${error}`);

    if (VERBOSE) console.log(`  ...   ${state.name} · ${mode}: ${counts.textChecked} text, ${counts.tapChecked} targets`);
    await page.close();
  }
}

await browser.close();
await server.stop();

/* ---- THE RECORDED PAIRINGS AGAINST A FRESH READING ----
 *
 * `palettes/solve-ent.json` declares `_renders` so the hub's palette gate can
 * tell a defect on a screen somebody ships from a forecast about a screen
 * nobody has built. That list is only worth anything if it is what the app
 * ACTUALLY paints — a stale one silently demotes a real defect to a note, which
 * is worse than not having one at all.
 *
 * So it is compared against this run, in both directions. A pairing the app
 * paints and the file does not record would be measured as a forecast; a
 * pairing recorded and no longer painted is a claim about a screen that has
 * gone. Both fail, and the fix is `node tools/a11y.mjs --pairs`.
 */
const recorded = JSON.parse(readFileSync(join(REPO, 'palettes/solve-ent.json'), 'utf8'))['_renders'];
if (!Array.isArray(recorded)) {
  findings.push('palettes/solve-ent.json declares no _renders — every near-miss becomes a hard failure');
} else {
  const observed = new Set(pairings);
  for (const pairing of observed) {
    if (!recorded.includes(pairing)) {
      findings.push(
        `this app paints "${pairing}" and palettes/solve-ent.json does not record it — ` +
          'the palette gate would treat a real defect there as a forecast',
      );
    }
  }
  for (const pairing of recorded) {
    if (!observed.has(pairing)) {
      findings.push(`palettes/solve-ent.json records "${pairing}" and nothing paints it any more`);
    }
  }
}

/* ---- THE SURFACE LIST ITSELF ---- */
for (const surface of surfacesSeen) {
  if (!surfacesMeasured.has(surface)) {
    findings.push(
      `[data-surface="${surface}"] exists in the document and is measured by no state in this file — ` +
        'it would ship unmeasured, and a clean run would say nothing about it',
    );
  }
}

if (PAIRS_ONLY) {
  // Sorted, so the recorded list is stable and a diff means a real change.
  console.log(JSON.stringify([...pairings].sort(), null, 2));
  process.exit(findings.length === 0 ? 0 : 1);
}

if (findings.length === 0) {
  console.log(`  ok    ${STATES.length} state(s) x ${MODES.length} mode(s), dialogs opened rather than skipped`);
  console.log(`  ok    ${totalText} text reading(s) at or above the floor, gradient stops enumerated`);
  console.log(`  ok    ${totalTaps} interactive target(s), inline-in-a-sentence links exempt and named`);
  console.log('  ok    every rendered colour reverse-maps to a token');
  console.log(`  ok    axe-core clean on every state (${axeViolations} violation(s))`);
  console.log('  ok    a real Tab reveals a focus ring on every state');
  console.log(`  ok    every [data-surface] in the document is measured here (${surfacesSeen.size} found)`);
  console.log(`  ok    ${pairings.size} role pairing(s) observed, and palettes/solve-ent.json records exactly those`);
  console.log('\nMeasured on the surfaces a reader reaches, not on the ones easiest to reach.\n');
  process.exit(0);
}

for (const finding of findings) console.log(`  FAIL  ${finding}`);
console.error(`\n${findings.length} finding(s).\n`);
process.exit(1);
