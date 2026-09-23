import { AdminShell } from "@/components/admin-shell";
import { countOpenReports } from "@/server/report-inbox";
import { requireAdminOrRedirect } from "@/server/session";

// Keep the sidebar mounted across dashboard pages; editor and preview are standalone.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminOrRedirect();
  const openReports = await countOpenReports();
  return (
    <AdminShell user={admin} openReports={openReports}>
      {children}
    </AdminShell>
  );
}
