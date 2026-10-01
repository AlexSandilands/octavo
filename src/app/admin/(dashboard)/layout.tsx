import { AdminShell } from "@/components/admin-shell";
import { isAssistantEnabled } from "@/lib/ai";
import { getMemberIdentity } from "@/server/member-names";
import { countOpenReports } from "@/server/report-inbox";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";

// Keep the sidebar mounted across dashboard pages; editor and preview are standalone.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminOrRedirect();
  const openReports = await countOpenReports();
  // The sidebar's avatar follows the library header's rule (#300): the
  // default posting name's photo, only while discussion is on.
  const { commentsEnabled } = await getSettings();
  const shown = commentsEnabled
    ? (await getMemberIdentity(admin.id)).defaultName
    : null;
  const user = {
    name: admin.name,
    email: admin.email,
    avatarName: shown?.name ?? null,
    avatarUrl: shown?.avatarUrl ?? null,
  };
  return (
    <AdminShell
      user={user}
      openReports={openReports}
      assistant={isAssistantEnabled()}
    >
      {children}
    </AdminShell>
  );
}
