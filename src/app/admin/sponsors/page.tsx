import { z } from "zod";
import { AdminShell } from "@/components/admin-shell";
import { SponsorsManager } from "@/features/sponsors/sponsors-manager";
import { ADMIN_LIST_QUERY_MAX } from "@/lib/list-query";
import { pageParamSchema } from "@/lib/pagination";
import { listSponsorsPage } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// The list state lives in the URL (?q= search, ?filter=, ?page=), so a refresh
// — and the revalidate after a sponsor is edited or deleted — lands the admin
// back where they were. Params are attacker-typed; `catch` turns anything
// malformed into the default rather than an error page, and an overlong q is
// truncated so it still narrows the list (see the members page for the why).
const paramsSchema = z.object({
  q: z
    .string()
    .catch("")
    .transform((s) => s.slice(0, ADMIN_LIST_QUERY_MAX)),
  page: pageParamSchema,
  filter: z.enum(["all", "active", "expired"]).catch("all"),
});

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
  const query = params.q.trim();
  const list = await listSponsorsPage({
    query,
    page: params.page,
    filter: params.filter,
  });
  return (
    <AdminShell active="sponsors" user={admin}>
      <SponsorsManager list={list} query={query} filter={params.filter} />
    </AdminShell>
  );
}
