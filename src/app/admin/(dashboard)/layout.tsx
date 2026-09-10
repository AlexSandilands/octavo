import { AdminShell } from "@/components/admin-shell";
import { requireAdminOrRedirect } from "@/server/session";

// Keep the sidebar mounted across dashboard pages; editor and preview are standalone.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminOrRedirect();
  return <AdminShell user={admin}>{children}</AdminShell>;
}
