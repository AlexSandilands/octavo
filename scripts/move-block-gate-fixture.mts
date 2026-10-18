// The draft dev-move-block-gate.mts works on (issue #406).
import type { Block, IssueContent } from "../src/lib/blocks";

// Page 2 opens with a heading (the menu's hint) and a paragraph; page 3 holds a
// paragraph and a photo; page 4 is owned by a full-page photo; page 5 is nearly
// full, so a paragraph arriving there overflows it.
const text = (id: string, html: string): Block => ({
  id,
  type: "text",
  text: html,
});
const para = (n: number) =>
  `<p>Paragraph ${n}: the club was founded by a handful of members who met in the old hall every second Thursday, and it has grown steadily since.</p>`;
export const content: IssueContent = {
  version: 10,
  pages: [
    {
      id: "p-cover",
      cover: true,
      blocks: [
        {
          id: "cover-heading",
          type: "heading",
          kicker: "Scratch",
          title: "Scratch 406",
        },
        { id: "cover-sponsor", type: "sponsor", name: "Scratch Sponsor" },
      ],
    },
    {
      id: "p2",
      blocks: [
        {
          id: "h2",
          type: "heading",
          kicker: "History",
          title: "Club background",
        },
        text("a", "<p>A: the first paragraph of the history.</p>"),
      ],
    },
    {
      id: "p3",
      blocks: [
        text(
          "b",
          [1, 2, 3]
            .map(
              (n) =>
                `<p>B${n}: a paragraph that will travel to the full page.</p>`,
            )
            .join(""),
        ),
        {
          id: "c",
          type: "image",
          imageId: crypto.randomUUID(),
          caption: "",
          alt: "C",
          align: "full",
          width: 100,
        },
      ],
    },
    {
      id: "p4",
      blocks: [
        {
          id: "d",
          type: "image",
          imageId: crypto.randomUUID(),
          caption: "",
          alt: "D",
          align: "page-fill",
          width: 100,
        },
      ],
    },
    {
      id: "p5",
      blocks: [
        text("e", Array.from({ length: 16 }, (_, i) => para(i + 1)).join("")),
      ],
    },
  ],
};
