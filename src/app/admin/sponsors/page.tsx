import { z } from "zod";
import { AdminShell } from "@/components/admin-shell";
import { SponsorsManager } from "@/features/sponsors/sponsors-manager";
import { pageParamSchema } from "@/lib/pagination";
import { listSponsorsPage } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// The page lives in the URL (?page=), so a refresh — and the revalidate after a
// sponsor is edited or deleted — lands the admin back where they were.
const paramsSchema = z.object({ page: pageParamSchema });

// Sponsors are managed here (content v2): each has a logo, link and optional
// "active until" date, and sponsor blocks in issues reference these records. The
// list, dialogs and delete confirmations live in the client manager; the page
// just gates and loads.
export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminOrRedirect();
  const params = paramsSchema.parse(await searchParams);
  const list = await listSponsorsPage(params.page);
  return (
    <AdminShell active="sponsors" user={admin}>
      <SponsorsManager list={list} />
    </AdminShell>
  );
}
