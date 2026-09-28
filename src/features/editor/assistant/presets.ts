import type { SendResult } from "./use-assistant-chat";

// The quick requests above the composer (#310), grown into a list of hints the
// panel rotates through (#366, see hints.ts). Each sends a fixed message for
// the page open now and, when one is selected, its block: the block id rides
// in brackets for the model and the thread shows the author the words around
// it. Rewrite, Plainer words and both Shortens say the wording may change; the
// rest keep every word or change nothing. `cover` says where a hint belongs;
// `needs` is what the open page must have for it to be offered.

/** The open page runs over; a photo is on it; a text block is selected. */
export type HintNeed = "overflow" | "photo" | "block";
type Hint = {
  id: string;
  label: string;
  cover: boolean;
  needs?: readonly HintNeed[];
};

export const PRESETS = [
  // #310's four, their ids and messages unchanged.
  { id: "tidy", label: "Tidy this page", cover: false },
  { id: "bullets", label: "Make bullets", cover: false },
  { id: "rewrite", label: "Rewrite for clarity", cover: false },
  { id: "shorten", label: "Shorten to fit", cover: false, needs: ["overflow"] },
  {
    id: "carry",
    label: "Carry the rest over",
    cover: false,
    needs: ["overflow"],
  },
  { id: "subheads", label: "Add sub-headings", cover: false },
  { id: "paragraphs", label: "Shorter paragraphs", cover: false },
  { id: "spelling", label: "Check spelling", cover: false },
  { id: "plainer", label: "Plainer words", cover: false },
  { id: "summary", label: "Sum it up", cover: false },
  { id: "headline", label: "Suggest a headline", cover: false },
  { id: "dates", label: "List the dates", cover: false },
  { id: "photo-spot", label: "Suggest a photo spot", cover: false },
  {
    id: "describe",
    label: "Describe the photos",
    cover: false,
    needs: ["photo"],
  },
  { id: "captions", label: "Add captions", cover: false, needs: ["photo"] },
  {
    id: "wrap",
    label: "Wrap text round photo",
    cover: false,
    needs: ["photo"],
  },
  {
    id: "shorten-block",
    label: "Shorten this block",
    cover: false,
    needs: ["block"],
  },
  // A cover's (#313), Compose cover first.
  { id: "compose", label: "Compose cover", cover: true },
  { id: "cover-stories", label: "List the stories", cover: true },
  { id: "cover-lines", label: "Suggest cover lines", cover: true },
  { id: "cover-check", label: "Check the cover", cover: true },
] as const satisfies readonly Hint[];
export type PresetId = (typeof PRESETS)[number]["id"];
export type Preset = Hint & { id: PresetId };
/** The same list, each with its optional `needs` readable. */
export const HINTS: readonly Preset[] = PRESETS;

/** Where a preset points: the page open now, and the selected block on it. */
export type PresetTarget = { page: number; blockId: string | null };

export function presetMessage(id: PresetId, target: PresetTarget): string {
  const { page, blockId } = target;
  const where = blockId
    ? `the selected block [${blockId}] on page ${page}`
    : `page ${page}`;
  switch (id) {
    case "tidy":
      return `Tidy ${where}: stray spaces and line breaks, punctuation, heading levels and how the blocks sit. Keep every word as it is.`;
    case "bullets":
      return `Make bullets on ${where}: turn anything written as a list into bullet or numbered points. Keep every word as it is.`;
    case "rewrite":
      return `Rewrite ${where} for clarity. The wording may change; keep the facts and the voice.`;
    case "shorten":
      return `Shorten the text on ${where} until the page fits, and stop as soon as it does. Take out as many lines as the page is over in one round, one edit per block you shorten. The wording may change; keep the facts and the voice.`;
    case "carry":
      return `Page ${page} runs over. Carry what doesn't fit onto a new page after it. Keep every word as it is.`;
    case "subheads":
      return `Add short sub-headings to ${where} where the subject changes, taken from what each part says. Keep every word of the text as it is.`;
    case "paragraphs":
      return `Break the long paragraphs on ${where} into shorter ones. Keep every word as it is.`;
    case "spelling":
      return `Check the spelling and punctuation on ${where} and correct any mistakes. Change nothing else, and tell me what you corrected.`;
    case "plainer":
      return `Rewrite ${where} in plainer words and shorter sentences. The wording may change; keep the facts and the voice.`;
    case "summary":
      return `Sum up what ${where} says in two or three sentences. Don't change anything.`;
    case "headline":
      return `Suggest three headlines for the article on ${where}. Don't change anything yet.`;
    case "dates":
      return `List every date, time and place mentioned on ${where}, so I can check them. Don't change anything.`;
    case "photo-spot":
      return `Where on page ${page} would a photo help the reader? Suggest a spot and what it might show. Don't change anything.`;
    case "describe":
      return `Look at the photos on ${where} and write alt text for any that have none, describing what each one shows.`;
    case "captions":
      return `Write a short caption for each photo on ${where} that has none, from what the text says about it. Don't invent facts.`;
    case "wrap":
      return `Set the photos on ${where} beside the text they illustrate, wrapped left or right at a width that suits the page.`;
    case "shorten-block":
      return `Shorten ${where} by about a third. The wording may change; keep the facts and the voice.`;
    case "compose":
      return `Compose the cover on page ${page}. Use the issue's strongest story as the lead and keep the current background.`;
    case "cover-stories":
      return `On the cover on page ${page}, list the issue's main stories, each linked to its page. Keep the current background.`;
    case "cover-lines":
      return `Suggest three short cover lines that would make members want to read this issue. Don't change anything yet.`;
    case "cover-check":
      return `Look at the cover on page ${page} and tell me anything that's hard to read or overlapping. Don't change anything yet.`;
  }
}

/** Sends an Ask, or says why the conversation can't take it now. */
export type AskHandler = (blockId: string, text: string) => Promise<SendResult>;

/** The Ask box's request (#311): the author's words, aimed at one block. */
export const askMessage = (
  target: { page: number; blockId: string; cover: boolean },
  text: string,
) =>
  `About the selected ${target.cover ? "cover item" : "block"} [${target.blockId}] on page ${target.page}: ${text.trim()}`;

/** A message as the author reads it: block ids are for the model. */
export const withoutBlockIds = (text: string) =>
  text.replace(/\s*\[[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\]/gi, "");
