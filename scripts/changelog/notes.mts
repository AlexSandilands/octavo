import type { ChangelogItem } from "./git.mts";

/** One client-facing highlight: a bold lead sentence and the prose beneath it. */
export type Highlight = {
  headline: string;
  paragraphs: string[];
};

export type NotesSection = {
  title: string;
  highlights: Highlight[];
};

const SECTION_TITLES = {
  feature: "New features",
  improvement: "Fixes and improvements",
  internal: "Behind the scenes",
} as const;

const HEADER = `<!--
  Changelog highlights — the client-facing part of the email.

  "# Heading" starts a section, "## Headline" starts a highlight and the lines
  beneath it are its prose (a blank line starts a new paragraph, **bold** works).
  Each highlight was drafted from a pull request title; the commits inside it
  are listed in a comment for reference. Rewrite the headline as one plain
  sentence and say beneath it what the change means for readers or the editor.
  Delete anything not worth a mention. Re-run \`npm run changelog\` to render.
-->`;

/** Starter notes: one highlight per user-facing pull request, prose left to write. */
export function draftNotes(changes: ChangelogItem[]): string {
  const blocks = [HEADER];
  for (const kind of ["feature", "improvement", "internal"] as const) {
    const items = changes.filter((change) => change.kind === kind);
    if (!items.length) continue;
    blocks.push(`# ${SECTION_TITLES[kind]}`);
    for (const item of items) {
      const reference = item.pullRequest ? `PR #${item.pullRequest}` : "commit";
      const detail = item.commits.length
        ? `\n  ${item.commits.map((line) => `- ${line}`).join("\n  ")}`
        : "";
      blocks.push(`## ${item.title}\n<!-- ${reference}${detail} -->`);
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

export function parseNotes(text: string): NotesSection[] {
  const sections: NotesSection[] = [];
  let section: NotesSection | null = null;
  let highlight: Highlight | null = null;
  let paragraphOpen = false;

  for (const raw of text.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      if (!section) {
        section = { title: SECTION_TITLES.feature, highlights: [] };
        sections.push(section);
      }
      highlight = { headline: line.slice(3).trim(), paragraphs: [] };
      section.highlights.push(highlight);
      paragraphOpen = false;
    } else if (line.startsWith("# ")) {
      section = { title: line.slice(2).trim(), highlights: [] };
      sections.push(section);
      highlight = null;
    } else if (!line) {
      paragraphOpen = false;
    } else if (highlight) {
      if (paragraphOpen) {
        highlight.paragraphs[highlight.paragraphs.length - 1] += ` ${line}`;
      } else {
        highlight.paragraphs.push(line);
        paragraphOpen = true;
      }
    }
  }
  return sections.filter((entry) => entry.highlights.length);
}
