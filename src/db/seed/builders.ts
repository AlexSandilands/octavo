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
import { stringToDoc } from "../../lib/rich-text-doc";

const id = () => crypto.randomUUID();

export const H = (title: string, kicker = "", level?: HeadingLevel): Block => ({
  id: id(),
  type: "heading",
  kicker,
  title,
  level,
});
// Body text, authored in the v3 shape the editor produces: a structured
// rich-text doc (stringToDoc turns the plain seed prose into one paragraph), so
// a fresh database exercises the same render path as real edited content — not
// the legacy string fallback (issue #36). The deliberately legacy-shaped blocks
// below (Traw/Thtml) keep the permanent v1/v2 fallback + migration script under
// ambient coverage.
export const T = (text: string, size?: TextSize): Block => ({
  id: id(),
  type: "text",
  text: stringToDoc(text),
  size,
});
// Legacy v1 body text: a stored *plain string* (pre-v3 shape). Kept for the one
// deliberate legacy page so the string→doc render fallback stays exercised.
export const Traw = (text: string, size?: TextSize): Block => ({
  id: id(),
  type: "text",
  text,
  size,
});
// Legacy v2 body text: a stored *constrained-HTML string* (the old rich editor's
// output). Renders through the same stringToDoc fallback as Traw.
export const Thtml = (html: string, size?: TextSize): Block => ({
  id: id(),
  type: "text",
  text: html,
  size,
});
export const Img = (
  imageId: string,
  opts: {
    caption?: string;
    /** Screen-reader description; the readers fall back to the caption. */
    alt?: string;
    align?: "full" | "left" | "right";
    width?: number;
  } = {},
): Block => ({
  id: id(),
  type: "image",
  imageId,
  caption: opts.caption ?? "",
  alt: opts.alt,
  align: opts.align ?? "full",
  width: opts.width ?? 100,
});
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

export type { SeedImages } from "./images";

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
