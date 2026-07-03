import { AdminShell } from "@/components/admin-shell";
import { SponsorsManager } from "@/features/sponsors/sponsors-manager";
import { listSponsors } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// Sponsors are managed here (content v2): each has a logo, link and optional
// "active until" date, and sponsor blocks in issues reference these records. The
// list, dialogs and delete confirmations live in the client manager; the page
// just gates and loads.
export default async function SponsorsPage() {
  const admin = await requireAdminOrRedirect();
  const sponsors = await listSponsors();
  return (
    <AdminShell active="sponsors" user={admin}>
      <SponsorsManager sponsors={sponsors} />
    </AdminShell>
  );
}
