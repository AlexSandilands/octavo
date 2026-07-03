// Shared types + terse block builders for the seed issues (see ./issue-01.ts …).
// Keeping these here lets each issue file read like an outline and stay short.
import {
  CONTENT_VERSION,
  type Block,
  type HeadingLevel,
  type IssueContent,
  type Page,
  type TextSize,
} from "../../lib/blocks";

const id = () => crypto.randomUUID();

export const H = (title: string, kicker = "", level?: HeadingLevel): Block => ({
  id: id(),
  type: "heading",
  kicker,
  title,
  level,
});
export const T = (text: string, size?: TextSize): Block => ({
  id: id(),
  type: "text",
  text,
  size,
});
export const Img = (
  imageId: string,
  caption = "",
  align: "full" | "left" | "right" = "full",
  width = 100,
): Block => ({ id: id(), type: "image", imageId, caption, align, width });
export const Spon = (name: string, href?: string): Block => ({
  id: id(),
  type: "sponsor",
  name,
  href,
});

export const page = (blocks: Block[]): Page => ({ id: id(), blocks });
export const cover = (blocks: Block[]): Page => ({
  id: id(),
  cover: true,
  blocks,
});

export type SeedImages = {
  boules: string;
  measure: string;
  terrain: string;
  group: string;
  building: string;
};

export type SeedIssue = {
  number: number;
  title: string;
  theme: string;
  status: "published";
  publishedAt: Date;
  content: IssueContent;
};

export const mkIssue = (
  number: number,
  title: string,
  theme: string,
  date: string,
  pages: Page[],
): SeedIssue => ({
  number,
  title,
  theme,
  status: "published",
  publishedAt: new Date(date),
  content: { version: CONTENT_VERSION, pages },
});
