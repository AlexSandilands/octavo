import { z } from "zod";
import { ReportsManager } from "@/features/reports/reports-manager";
import { REPORT_FILTERS } from "@/lib/comments";
import { ADMIN_LIST_QUERY_MAX } from "@/lib/list-query";
import { pageParamSchema } from "@/lib/pagination";
import { listReports } from "@/server/report-inbox";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// The reports inbox (issue #302). The list state lives in the URL (?q=,
// ?filter=, ?page=) like every admin list, so the revalidate after a row
// action lands where the admin was. Params are attacker-typed: `catch` turns
// anything malformed into the default, and an overlong q is truncated.
const paramsSchema = z.object({
  q: z
    .string()
    .catch("")
    .transform((s) => s.slice(0, ADMIN_LIST_QUERY_MAX)),
  page: pageParamSchema,
  filter: z.enum(REPORT_FILTERS).catch("open"),
});

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout gates too, but layouts don't re-run on soft navigation.
  await requireAdminOrRedirect();
  const params = paramsSchema.parse(await searchParams);
  const query = params.q.trim();
  const list = await listReports({
    query,
    page: params.page,
    filter: params.filter,
  });
  return <ReportsManager list={list} query={query} filter={params.filter} />;
}
