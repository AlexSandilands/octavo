// The line a message's attached photos travel as (#343): their ids, never the
// photos. It rides in a text part of its own, so the author's words stay whole.

export const photos = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);

export const attachedText = (ids: string[]) =>
  `Attached ${photos(ids.length)}: ${ids.join(", ")}`;

/** How many photos a text part says were attached, or 0 when it isn't that line. */
export function attachedCount(text: string): number {
  const match = /^Attached (\d+) photos?: /.exec(text);
  return match ? Number(match[1]) : 0;
}

/** The run's line when attached photos were left unplaced. */
export const unplacedText = (n: number) =>
  `${n === 1 ? "1 attached photo wasn’t" : `${n} attached photos weren’t`} placed. ${n === 1 ? "It’s" : "They’re"} with this issue’s photos.`;
