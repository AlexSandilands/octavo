import { AI_REVIEW_MAX_PAGES } from "@/lib/ai-vision-contract";
import type { AiRenderedPage } from "@/lib/ai-vision-contract";
import type { RunSummary } from "./executor";
import type { AssistantIssue } from "./issue-context";
import { pageCaption } from "./vision";

// The automatic end-of-run review (#342). In the spike the model never chose
// to look at an interior page it had changed, so after a run that touched the
// cover or more than one page the editor sends those pages back as pictures for
// one more turn: same run, same undo step. Single-page edits get none.

export const REVIEW_TEXT =
  "Here are the pages you changed, as members will see them. Look at each one and fix anything that reads badly: a photo with empty space beside it or a sliver of text squeezed next to it, a heading stranded at the foot of a page, a page that looks cramped or mostly empty when content nearby could balance it, photos crowding each other, cover text that is hard to read against the photo or sits on its subject. Keep the editor's words as before. If everything looks right, change nothing and say so. Then reply as usual, mentioning what you fixed.";

/** The pages to review, the cover first, or none when the run doesn't call for one. */
export function reviewPages(
  summary: RunSummary | null,
  pages: AssistantIssue["pages"],
): number[] {
  if (!summary) return [];
  const touched = summary.pages.filter((n) => pages[n - 1]);
  const covers = touched.filter((n) => pages[n - 1]!.cover);
  if (touched.length < 2 && covers.length === 0) return [];
  const rest = touched.filter((n) => !pages[n - 1]!.cover);
  return [...covers, ...rest].slice(0, AI_REVIEW_MAX_PAGES);
}

/** The review message's parts: the text, then each page's caption and picture. */
export function reviewParts(shots: AiRenderedPage[], issue: AssistantIssue) {
  return [
    { type: "text" as const, text: REVIEW_TEXT },
    ...shots.flatMap((shot) => [
      { type: "text" as const, text: pageCaption(shot, issue) },
      {
        type: "file" as const,
        mediaType: shot.mediaType,
        url: `data:${shot.mediaType};base64,${shot.data}`,
      },
    ]),
  ];
}

/** Whether a user message is a review the editor sent, not the author's words. */
export function isReview(parts: { type: string; text?: string }[]) {
  return parts[0]?.type === "text" && parts[0].text === REVIEW_TEXT;
}
