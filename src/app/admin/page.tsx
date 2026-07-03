import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { EmptyIssues } from "@/components/empty-states";
import { listIssues } from "@/server/issues";
import { getAdminUser } from "@/server/session";
import { DeleteIssueButton } from "@/features/admin/delete-issue-button";
import { createIssueAction } from "./actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = await getAdminUser();
  if (!admin) redirect("/signin"); // layout gates too; this narrows the type
  const issues = await listIssues();
  const draftCount = issues.filter((i) => i.status === "draft").length;

  return (
    <AdminShell active="issues" user={admin}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Issues</h1>
          <p className="text-faint mt-1.5 font-sans text-sm">
            {issues.length} {issues.length === 1 ? "issue" : "issues"} ·{" "}
            {draftCount} in draft
          </p>
        </div>
        <form action={createIssueAction}>
          <button
            type="submit"
            className="bg-accent text-paper flex h-12 items-center gap-2 rounded-lg px-5 font-sans text-[15px] font-semibold shadow-[0_2px_8px_rgba(29,77,62,0.25)]"
          >
            <Icon name="plus" size={17} strokeWidth={1.8} />
            Create new issue
          </button>
        </form>
      </div>

      {issues.length === 0 ? (
        <div className="mt-8">
          <EmptyIssues />
        </div>
      ) : (
        <div className="mt-6">
          {issues.map((i) => (
            <div
              key={i.id}
              className="border-line-soft flex items-center gap-5 border-b py-4"
            >
              <div className="photo-fill h-[60px] w-[46px] flex-none rounded-[3px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-ink font-serif text-[19px] leading-tight">
                    {i.title}
                  </span>
                  <span className="text-faint2 font-mono text-[11px]">
                    No. {i.number}
                  </span>
                </div>
                <div className="text-faint mt-1 font-sans text-[13px]">
                  {i.content.pages.length}{" "}
                  {i.content.pages.length === 1 ? "page" : "pages"}
                </div>
              </div>
              <Pill status={i.status === "published" ? "Published" : "Draft"} />
              <Link
                href={`/admin/issues/${i.id}/edit`}
                className="text-accent w-14 text-right font-sans text-sm font-semibold"
              >
                Edit
              </Link>
              <DeleteIssueButton id={i.id} title={i.title} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
