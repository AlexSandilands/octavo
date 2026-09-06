import { AdminPageHeader } from "@/components/admin-page-header";
import { AppShell } from "@/components/app-shell";
import { requireAdminOrRedirect } from "@/server/session";
import { SectionBasics } from "@/features/help/section-basics";
import { SectionIssues } from "@/features/help/section-issues";
import { SectionPublishing } from "@/features/help/section-publishing";
import { SectionMembers } from "@/features/help/section-members";
import { SectionSponsors } from "@/features/help/section-sponsors";
import { SectionMagazine } from "@/features/help/section-magazine";
import { SectionPdf } from "@/features/help/section-pdf";

export const dynamic = "force-dynamic";

// The in-app guide (issue #49): a plain-language walkthrough of running the
// magazine, written for a non-technical owner. The content lives in
// src/features/help/, one section per file; ids here must match the section
// ids there (they're the anchor targets).
const CONTENTS = [
  { id: "basics", label: "How the site works" },
  { id: "issues", label: "Create and edit an issue" },
  { id: "publishing", label: "Publish an issue" },
  { id: "members", label: "Members" },
  { id: "sponsors", label: "Sponsors" },
  { id: "magazine", label: "Magazine details" },
  { id: "pdf", label: "PDF downloads" },
];

export default async function HelpPage() {
  // The layout gates too, but layouts don't re-run on soft navigation.
  const admin = await requireAdminOrRedirect();
  return (
    <AppShell area="admin" active="help" user={admin}>
      <div className="mx-auto max-w-[760px] pb-16">
        <AdminPageHeader
          title="Guide"
          summary="How to run the magazine, in plain language. Nothing here needs a technical bone in your body."
        />

        {/* A chip per section: press one and the page scrolls to it. */}
        <nav aria-label="On this page" className="mt-5">
          <h2 className="text-fg-muted font-ui text-[13px] font-bold tracking-[0.12em] uppercase">
            On this page
          </h2>
          <ol className="mt-2.5 flex flex-wrap gap-2">
            {CONTENTS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="border-edge bg-surface text-fg hover:border-primary hover:bg-primary-wash hover:text-primary flex h-11 items-center gap-2 rounded-full border-[1.5px] px-4 font-ui text-[15px] font-bold transition-colors"
                >
                  <span
                    aria-hidden="true"
                    className="bg-primary-soft text-primary flex h-6 w-6 items-center justify-center rounded-full text-[12px] tabular-nums"
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <SectionBasics />
        <SectionIssues />
        <SectionPublishing />
        <SectionMembers />
        <SectionSponsors />
        <SectionMagazine />
        <SectionPdf />
      </div>
    </AppShell>
  );
}
