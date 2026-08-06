import { z } from "zod";
import { AdminShell } from "@/components/admin-shell";
import { MembersManager } from "@/features/members/members-manager";
import { listUsers } from "@/server/users";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// The list state lives in the URL (?q= search, ?page=) so a refresh after a
// mutation lands where the admin was and revalidatePath("/admin/members")
// re-renders the same view. Params are attacker-typed strings; `catch` turns
// anything malformed (arrays, "abc", page=-1) into the default rather than an
// error page. Out-of-range pages are clamped by listUsers, not here.
const paramsSchema = z.object({
  q: z.string().max(200).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout gates too, but layouts don't re-run on soft navigation.
  const admin = await requireAdminOrRedirect();
  const params = paramsSchema.parse(await searchParams);
  const query = params.q.trim();
  const list = await listUsers({ query, page: params.page });

  return (
    <AdminShell active="members" user={admin}>
      <MembersManager list={list} query={query} currentUserId={admin.id} />
    </AdminShell>
  );
}
