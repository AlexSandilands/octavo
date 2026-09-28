import { HINTS, type Preset, type PresetId } from "./presets";

// Which hints the panel shows (#366): four at a time, drawn from the presets
// that suit the open page. The draw works like a shuffled deck, so pressing
// More ideas walks through every hint before any comes round again. A fresh
// deck (the panel opening, another page) puts up to two hints that answer the
// page's context first. One hint is pinned rather than drawn: Compose cover on
// a cover, Shorten to fit while the open page runs over.

export type HintContext = {
  cover: boolean;
  /** The open page runs over its text area. */
  overflow: boolean;
  /** A photo is on the open page. */
  photo: boolean;
  /** A text block is selected. */
  block: boolean;
};
export const HINTS_SHOWN = 4;
/** A fresh deck leads with at most this many context-relevant hints. */
const RELEVANT_FIRST = 2;

export type Deck = { key: string; order: PresetId[]; at: number };

const keyOf = (c: HintContext) =>
  `${c.cover}/${c.overflow}/${c.photo}/${c.block}`;

/** The hint that always shows in this context, if one does. */
export function pinnedHint(c: HintContext): PresetId | null {
  return c.cover ? "compose" : c.overflow ? "shorten" : null;
}
const PINNABLE: PresetId[] = ["compose", "shorten"];

/** Every hint this context offers, besides the pinned one. */
function drawable(c: HintContext): Preset[] {
  return HINTS.filter(
    (h) =>
      h.cover === c.cover &&
      !PINNABLE.includes(h.id) &&
      (h.needs ?? []).every((need) => c[need]),
  );
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function freshDeck(
  c: HintContext,
  random: () => number,
  first: PresetId[] = [],
): Deck {
  const pool = shuffle(drawable(c), random);
  const relevant = first.length
    ? []
    : pool.filter((h) => h.needs?.length).slice(0, RELEVANT_FIRST);
  const lead = [...first, ...relevant.map((h) => h.id)];
  const rest = pool.map((h) => h.id).filter((id) => !lead.includes(id));
  return { key: keyOf(c), order: [...lead, ...rest], at: 0 };
}

/**
 * The next hints to show and the deck after them. `fresh` starts a new deck
 * (as does a changed context); otherwise the draw carries on where it was, and
 * hints left over at a deck's end lead the next one, so none is skipped.
 */
export function dealHints(
  deck: Deck | null,
  c: HintContext,
  fresh: boolean,
  random: () => number = Math.random,
): { deck: Deck; drawn: PresetId[] } {
  const room = HINTS_SHOWN - (pinnedHint(c) ? 1 : 0);
  let d = !deck || fresh || deck.key !== keyOf(c) ? freshDeck(c, random) : deck;
  if (d.at + room > d.order.length && d.at > 0)
    d = freshDeck(c, random, d.order.slice(d.at));
  const drawn = d.order.slice(d.at, d.at + room);
  return { deck: { ...d, at: d.at + drawn.length }, drawn };
}

/** Whether More ideas has anything more to show here. */
export const moreThanShown = (c: HintContext) =>
  drawable(c).length > HINTS_SHOWN - (pinnedHint(c) ? 1 : 0);

/** Whether a hint drawn earlier still suits the page as it is now. */
export const stillOffered = (id: PresetId, c: HintContext) =>
  drawable(c).some((h) => h.id === id);
