// The two things that can only be proved through the HTTP route: an import
// survives the browser going away mid-flight, and a retry asks what happened
// instead of sending the archive again (issue #293).
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { issueImports, issues } from "../src/db/schema.ts";
import {
  IMPORT_DECISIONS_HEADER,
  type ImportDecision,
} from "../src/lib/issue-transfer/decisions.ts";
import type { ImportResponse } from "../src/lib/issue-transfer/result.ts";
import { made } from "./issue-transfer-fixtures.mts";

type Ok = (cond: unknown, msg: string) => void;

export async function checkDisconnect(
  ok: Ok,
  context: {
    base: string;
    cookie: string;
    bundle: Buffer;
    issueIds: string[];
  },
): Promise<string | null> {
  const operationId = crypto.randomUUID();
  made.operations.push(operationId);
  const abort = new AbortController();

  const response = await fetch(`${context.base}/api/admin/issues/import`, {
    method: "POST",
    signal: abort.signal,
    headers: {
      "content-type": "application/zip",
      origin: new URL(context.base).origin,
      cookie: context.cookie,
      [IMPORT_DECISIONS_HEADER]: JSON.stringify({
        operationId,
        decisions: context.issueIds.map(
          (id): ImportDecision => ({ mode: "new", issueId: id }),
        ),
      }),
    },
    body: new Uint8Array(context.bundle),
  });

  // Walk away the moment the server says it has started checking — the point at
  // which the work is the server's and no longer the browser's.
  const reader = response.body!.getReader();
  const { value } = await reader.read();
  const first = new TextDecoder().decode(value).trim();
  ok(first.includes('"phase"'), `the server announced a phase (${first})`);
  abort.abort();
  await reader.cancel().catch(() => {});

  const settled = await waitFor(async () => {
    const [row] = await db
      .select({ status: issueImports.status, result: issueImports.result })
      .from(issueImports)
      .where(eq(issueImports.id, operationId))
      .limit(1);
    return row?.status === "committed" ? row : null;
  });
  ok(
    settled !== null,
    "the import finished anyway after the client disconnected",
  );
  if (!settled?.result) return null;

  const created = settled.result.issues[0]!.id;
  const [row] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, created))
    .limit(1);
  ok(row !== undefined, "  …and its drafts are really there");

  // The retry the modal makes: a plain question, no archive attached — and no
  // Origin header, because a browser sends none on a same-origin GET.
  const asked = await fetch(
    `${context.base}/api/admin/issues/import?operation=${operationId}`,
    {
      headers: { cookie: context.cookie },
    },
  );
  const body = (await asked.json()) as ImportResponse;
  ok(
    asked.status === 200 && body.ok && body.retried === true,
    "asking about the operation returns the recorded result without re-uploading",
  );
  ok(
    body.ok &&
      JSON.stringify(body.result.issues) ===
        JSON.stringify(settled.result.issues),
    "  …the very same result",
  );

  const unknown = await fetch(
    `${context.base}/api/admin/issues/import?operation=${crypto.randomUUID()}`,
    {
      headers: { cookie: context.cookie },
    },
  );
  const missing = (await unknown.json()) as ImportResponse;
  ok(
    unknown.status === 404 &&
      !missing.ok &&
      missing.code === "unknown-operation",
    "an operation the server never saw says so, so the modal uploads",
  );
  return operationId;
}

async function waitFor<T>(
  probe: () => Promise<T | null>,
  timeoutMs = 30_000,
): Promise<T | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const found = await probe();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}
