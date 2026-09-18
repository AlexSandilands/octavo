import * as Sentry from "@sentry/nextjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  IMPORT_DECISIONS_HEADER,
  importRequestSchema,
} from "@/lib/issue-transfer/decisions";
import {
  MAX_BUNDLE_BYTES,
  MAX_DECISIONS_BYTES,
} from "@/lib/issue-transfer/limits";
import type { ImportResponse } from "@/lib/issue-transfer/result";
import { createRateLimiter } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/same-origin";
import {
  BundleTooLargeError,
  writeBundleFile,
} from "@/server/issue-transfer/archive";
import { importBundle } from "@/server/issue-transfer/import";
import { getAdminUser } from "@/server/session";

// Import a bundle (issue #293). The zip is the raw request body and the
// decisions ride in one bounded header, so nothing has to buffer the archive to
// find them. The reply is newline-delimited JSON: a phase line as the server
// moves from checking to importing, then the result — which is how the modal
// says what is happening during a wait that can run to a minute.
//
// **This path is excluded from the proxy matcher** (src/proxy.ts). Next buffers
// every proxied request body and silently truncates it at 10 MB, which would
// hand this handler a partial archive with no error of any kind.

// Each import inflates, decodes and hashes what can be a quarter-gigabyte
// archive, so throttle per admin even after the auth check — the caps make one
// request safe, volume is the gap. Matched to the image upload route's budget,
// which is generous enough that an admin working through a folder of exports
// (several of them refused) never trips it.
const importLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!sameOrigin(request) || !admin) {
    return refusal("forbidden", "Admin access required.", 403);
  }

  const rate = importLimiter.check(admin.id);
  if (!rate.ok) {
    return refusal(
      "rate-limited",
      "Too many imports. Please wait a moment and try again.",
      429,
    );
  }

  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
    "application/zip"
  ) {
    return refusal("not-a-zip", "This file isn’t a valid issue export.", 415);
  }

  const header = request.headers.get(IMPORT_DECISIONS_HEADER) ?? "";
  if (header.length > MAX_DECISIONS_BYTES) {
    return refusal(
      "too-many-choices",
      "That’s more issues than one import can carry.",
    );
  }
  const decisions = parseDecisions(header);
  if (!decisions) {
    return refusal("bad-request", "Something went wrong. Please try again.");
  }
  if (!request.body) {
    return refusal("not-a-zip", "This file isn’t a valid issue export.");
  }

  const dir = await mkdtemp(path.join(tmpdir(), "octavo-import-"));
  const file = path.join(dir, "bundle.zip");
  try {
    await writeBundleFile(request.body, file, MAX_BUNDLE_BYTES);
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    if (error instanceof BundleTooLargeError) {
      return refusal(
        "bundle-too-large",
        `That file is larger than the ${Math.round(MAX_BUNDLE_BYTES / (1024 * 1024))} MB this site can import.`,
        413,
      );
    }
    throw error;
  }

  // From here the work is not tied to the request: if the browser goes away the
  // import still finishes, and a retry with the same operation id gets the
  // recorded result rather than a second set of drafts.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        send(
          await importBundle({
            file,
            adminId: admin.id,
            operationId: decisions.operationId,
            decisions: decisions.decisions,
            onPhase: (phase) => send({ phase }),
          }),
        );
      } catch (error) {
        Sentry.captureException(error, {
          tags: { route: "admin/issues/import" },
          extra: { adminId: admin.id, operationId: decisions.operationId },
        });
        send({
          ok: false,
          code: "failed",
          message:
            "The import didn’t go through, and nothing was changed. Please try again.",
        } satisfies ImportResponse);
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseDecisions(header: string) {
  try {
    const parsed = importRequestSchema.safeParse(JSON.parse(header));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function refusal(code: string, message: string, status = 400) {
  return Response.json({ ok: false, code, message }, { status });
}
