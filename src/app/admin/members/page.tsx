import { AdminShell } from "@/components/admin-shell";
import { MembersManager } from "@/features/members/members-manager";
import { listUsers } from "@/server/users";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  // The layout gates too, but layouts don't re-run on soft navigation.
  const admin = await requireAdminOrRedirect();
  const members = await listUsers();

  return (
    <AdminShell active="members" user={admin}>
      <MembersManager members={members} currentUserId={admin.id} />
    </AdminShell>
  );
}
