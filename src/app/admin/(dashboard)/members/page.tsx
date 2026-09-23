import { z } from "zod";
import { MembersManager } from "@/features/members/members-manager";
import { ADMIN_LIST_QUERY_MAX } from "@/lib/list-query";
import { pageParamSchema } from "@/lib/pagination";
import { listPostingNamesFor } from "@/server/member-profile";
import { listUsers } from "@/server/users";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// The list state lives in the URL (?q= search, ?page=) so a refresh after a
// mutation lands where the admin was and revalidatePath("/admin/members")
// re-renders the same view. Params are attacker-typed strings; `catch` turns
// anything malformed (arrays, "abc", page=-1) into the default rather than an
// error page. Out-of-range pages are clamped by listUsers, not here. An
// overlong q is truncated rather than rejected: the search box can't produce
// one (maxLength), so it came in a URL, and cutting it still narrows the list
// where a `catch` would silently show everyone and wipe the box.
const paramsSchema = z.object({
  q: z
    .string()
    .catch("")
    .transform((s) => s.slice(0, ADMIN_LIST_QUERY_MAX)),
  page: pageParamSchema,
  filter: z.enum(["all", "admins", "subscribed", "unsubscribed"]).catch("all"),
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
  const list = await listUsers({
    query,
    page: params.page,
    filter: params.filter,
  });

  // Each row shows the names that member posts under (#300).
  const names = await listPostingNamesFor(list.rows.map((row) => row.id));
  const rows = list.rows.map((row) => ({
    ...row,
    postingNames: names.get(row.id) ?? [],
  }));

  return (
    <MembersManager
      list={{ ...list, rows }}
      query={query}
      filter={params.filter}
      currentUserId={admin.id}
    />
  );
}
