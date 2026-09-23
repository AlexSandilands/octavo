import { AdminShell } from "@/components/admin-shell";
import { getMemberIdentity } from "@/server/member-names";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";

// Keep the sidebar mounted across dashboard pages; editor and preview are standalone.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminOrRedirect();
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
  return <AdminShell user={user}>{children}</AdminShell>;
}
