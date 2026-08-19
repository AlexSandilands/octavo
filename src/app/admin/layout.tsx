import { ActionCommitRescue } from "@/components/action-commit-rescue";
import { requireAdminOrRedirect } from "@/server/session";

// Gate every /admin page load (dashboard, editor, preview, members,
// sponsors). Layouts don't re-run on client-side navigation between their
// children, so each page re-checks too (cheap — the session read is
// request-deduped), and server actions are separately gated with
// requireAdmin(): an action can be invoked directly by any client that
// knows its id, bypassing page-level checks entirely.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOrRedirect();
  // The stamp changes on every server render, telling the rescuer a refresh
  // landed; see action-commit-rescue.tsx for the bug it works around.
  return (
    <>
      <ActionCommitRescue stamp={Date.now()} />
      {children}
    </>
  );
}
