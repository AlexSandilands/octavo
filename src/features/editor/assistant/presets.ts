// The quick requests above the composer (#310): each a fixed message aimed at
// the page open now and, when one is selected, its block. The block id rides in
// brackets for the model; the thread shows the author the words around it.
// Rewrite and Shorten say that the wording may change; Tidy and Make bullets
// don't. A cover gets Compose cover instead of the four (#313).

export const PRESETS = [
  { id: "tidy", label: "Tidy this page", cover: false },
  { id: "bullets", label: "Make bullets", cover: false },
  { id: "rewrite", label: "Rewrite for clarity", cover: false },
  { id: "shorten", label: "Shorten to fit", cover: false },
  // The one preset a cover gets (#313).
  { id: "compose", label: "Compose cover", cover: true },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

/** Where a preset points: the page open now, and the selected block on it. */
export type PresetTarget = { page: number; blockId: string | null };

export function presetMessage(id: PresetId, target: PresetTarget): string {
  const where = target.blockId
    ? `the selected block [${target.blockId}] on page ${target.page}`
    : `page ${target.page}`;
  switch (id) {
    case "tidy":
      return `Tidy ${where}: stray spaces and line breaks, punctuation, heading levels and how the blocks sit. Keep every word as it is.`;
    case "bullets":
      return `Make bullets on ${where}: turn anything written as a list into bullet or numbered points. Keep every word as it is.`;
    case "rewrite":
      return `Rewrite ${where} for clarity. The wording may change; keep the facts and the voice.`;
    case "shorten":
      return `Shorten the text on ${where} until the page fits, and stop as soon as it does. The wording may change; keep the facts and the voice.`;
    case "compose":
      return `Compose the cover on page ${target.page}. Use the issue's strongest story as the lead and keep the current background.`;
  }
}

/** A message as the author reads it: block ids are for the model. */
export const withoutBlockIds = (text: string) =>
  text.replace(/\s*\[[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\]/gi, "");
