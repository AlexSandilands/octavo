import { AdminShell } from "@/components/admin-shell";
import { LogosManager } from "@/features/logos/logos-manager";
import { listLogos } from "@/server/logos";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// The logo library: named marks (a club crest, a fern) that other features
// reference by id rather than each growing its own upload. The list, dialog and
// delete confirmation live in the client manager; the page just gates and loads.
export default async function LogosPage() {
  const admin = await requireAdminOrRedirect();
  const logos = await listLogos();
  return (
    <AdminShell active="logos" user={admin}>
      <LogosManager logos={logos} />
    </AdminShell>
  );
}
