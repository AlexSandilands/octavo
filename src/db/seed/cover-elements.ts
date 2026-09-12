import {
  DEFAULT_COVER_PLACEMENT,
  makeCoverElement,
  makeCoverStory,
  coverSources,
} from "../../lib/cover-elements";
import type { SeedIssue } from "./builders";

/** One deliberately composed sample; the editor's cover templates stay unchanged. */
export function withCoverElements(issue: SeedIssue): SeedIssue {
  const front = issue.content.pages[0]!;
  const sources = coverSources(issue.content.pages);
  const contents = makeCoverElement("section"),
    story = makeCoverElement("section"),
    details = makeCoverElement("details");
  if (
    contents.type !== "section" ||
    story.type !== "section" ||
    details.type !== "details"
  )
    return issue;
  return {
    ...issue,
    content: {
      ...issue.content,
      pages: [
        {
          ...front,
          coverOverlay: {
            style: "light-shadow",
            position: "center",
            decoration: false,
          },
          blocks: front.blocks.map((b) =>
            b.type === "image"
              ? { ...b, align: "page-fill" }
              : b.type === "heading" || b.type === "text"
                ? {
                    ...b,
                    coverPlacement: {
                      ...DEFAULT_COVER_PLACEMENT,
                      textSize: "normal",
                      row: b.type === "heading" ? "top" : "bottom",
                      offset: b.type === "heading" ? 30 : 0,
                    },
                  }
                : b,
          ),
          coverElements: [
            { ...details, text: "Winter 2026" },
            {
              ...contents,
              title: "Inside this issue",
              placement: {
                ...contents.placement,
                appearance: {
                  panel: true,
                  background: "green",
                  text: "paper",
                  shadow: "none",
                },
              },
              items: sources.slice(0, 2).map((s) => makeCoverStory(s.id)),
              showPageNumbers: true,
            },
            {
              ...story,
              headlineSize: "display",
              items: [
                {
                  ...makeCoverStory(sources[2]?.id),
                  description: "Stories and discoveries from a year of making.",
                },
              ],
              placement: {
                ...story.placement,
                column: "right",
                align: "right",
                style: "paper-panel",
                width: "narrow",
              },
            },
          ],
        },
        ...issue.content.pages.slice(1),
      ],
    },
  };
}
