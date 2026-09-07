import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-table";
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
// magazine, written for a non-technical owner and set like a long article —
// numbered sections under heavy rules. The content lives in src/features/help/,
// one section per file; ids here must match the section ids there (they're the
// anchor targets).
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
    <AdminShell active="help" user={admin}>
      <div className="mx-auto max-w-[760px] pb-16">
        <AdminPageHeader
          title="Guide"
          summary="How to run the magazine, in plain language. Nothing here needs a technical bone in your body."
        />

        <nav aria-label="On this page" className="rule-heavy mt-8 pt-3">
          <h2 className="small-caps text-grey-soft">On this page</h2>
          <ol className="mt-2 grid gap-x-8 sm:grid-cols-2">
            {CONTENTS.map((s, i) => (
              <li key={s.id} className="rule-hair">
                <a
                  href={`#${s.id}`}
                  className="text-lead hover:text-red flex min-h-11 items-baseline gap-3 py-2 font-ui text-[16px] font-semibold"
                >
                  <span
                    aria-hidden="true"
                    className="w-6 flex-none font-ui text-[14px] font-bold tabular-nums"
                  >
                    {i + 1}.
                  </span>
                  <span className="underline decoration-1 underline-offset-4">
                    {s.label}
                  </span>
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
    </AdminShell>
  );
}
