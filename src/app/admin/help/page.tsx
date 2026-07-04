import { AdminShell } from "@/components/admin-shell";
import { requireAdminOrRedirect } from "@/server/session";
import { SectionBasics } from "@/features/help/section-basics";
import { SectionIssues } from "@/features/help/section-issues";
import { SectionPublishing } from "@/features/help/section-publishing";
import { SectionMembers } from "@/features/help/section-members";
import { SectionSponsors } from "@/features/help/section-sponsors";
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
  { id: "pdf", label: "PDF downloads" },
];

export default async function HelpPage() {
  // The layout gates too, but layouts don't re-run on soft navigation.
  const admin = await requireAdminOrRedirect();
  return (
    <AdminShell active="help" user={admin}>
      <div className="mx-auto max-w-[720px] pb-16">
        <h1 className="text-ink font-serif text-3xl">Guide</h1>
        <p className="text-faint mt-1.5 font-sans text-sm">
          How to run the magazine, in plain language. Nothing here needs a
          technical bone in your body.
        </p>

        <nav
          aria-label="On this page"
          className="border-line bg-card mt-6 rounded-[10px] border p-5"
        >
          <h2 className="text-faint font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
            On this page
          </h2>
          <ol className="mt-2.5 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {CONTENTS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-accent hover:text-accent-strong flex items-baseline gap-2.5 py-1 font-sans text-[15px] font-medium hover:underline"
                >
                  <span
                    aria-hidden="true"
                    className="text-faint2 font-mono text-[11px]"
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
        <SectionPdf />
      </div>
    </AdminShell>
  );
}
