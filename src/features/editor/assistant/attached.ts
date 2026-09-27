// The line a message's attached photos travel as (#343): their ids, never the
// photos. It rides in a text part of its own, so the author's words stay whole.

export const photos = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);

export const attachedText = (ids: string[]) =>
  `Attached ${photos(ids.length)}: ${ids.join(", ")}`;

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LINE = new RegExp(`^Attached (\\d+) photos?: (${ID}(?:, ${ID})*)$`);

/** How many photos a text part says were attached, or 0 when it isn't exactly
 *  that line (words an author typed that merely start the same way). */
export function attachedCount(text: string): number {
  const match = LINE.exec(text);
  const n = Number(match?.[1] ?? 0);
  return match && match[2]!.split(", ").length === n ? n : 0;
}

/** The run's line when attached photos were left unplaced. */
export const unplacedText = (n: number) =>
  `${n === 1 ? "1 attached photo wasn’t" : `${n} attached photos weren’t`} placed. ${n === 1 ? "It’s" : "They’re"} with this issue’s photos.`;
