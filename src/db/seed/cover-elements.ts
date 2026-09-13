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
  const contents = makeCoverElement("story"),
    story = makeCoverElement("story"),
    details = makeCoverElement("details");
  if (
    contents.type !== "story" ||
    story.type !== "story" ||
    details.type !== "details"
  )
    return issue;
  details.placement.richText = {
    text: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Winter 2026",
              marks: [
                {
                  type: "coverPaint",
                  attrs: {
                    fontFamily: "hanken-grotesk",
                    fontWeight: 900,
                    fontStyle: "italic",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
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
              headlineFont: "newsreader",
              headlineWeight: 800,
              placement: {
                ...contents.placement,
                appearance: {
                  panel: true,
                  panelShape: "text",
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
              headlineFont: "roboto-condensed",
              headlineWeight: 900,
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
