import type { IssueContent } from "@/lib/blocks";

export type IssueSection = { kicker: string; title: string };

// The section headings across an issue's pages — mirrors the contents list the
// reader builds, so the library teaser and the reader stay in agreement.
export function issueSections(content: IssueContent): IssueSection[] {
  const sections: IssueSection[] = [];
  for (const page of content.pages) {
    for (const block of page.blocks) {
      if (block.type === "heading" && block.title.trim()) {
        sections.push({
          kicker: block.kicker.trim(),
          title: block.title.trim(),
        });
      }
    }
  }
  return sections;
}

// "June 2026" — the publication month, or null when an issue has no date yet.
export function issueMonth(publishedAt: Date | null): string | null {
  if (!publishedAt) return null;
  return new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
  }).format(publishedAt);
}
