import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
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
import { answer, importBundle } from "@/server/issue-transfer/import";
import { readImport } from "@/server/issue-transfer/operations";
import { report } from "@/server/issue-transfer/report";
import { getAdminUser } from "@/server/session";

// POST imports a bundle: the zip is the raw body, the decisions ride in one
// bounded header, and the reply is newline-delimited JSON — a phase line, then
// the result. GET answers what an operation id is worth, so a retry after a
// dropped connection need not re-upload the archive to find out.
//
// This path is excluded from the proxy matcher (src/proxy.ts).

const importLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const operationSchema = z.string().uuid();

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!sameOrigin(request) || !admin) {
    return refusal("forbidden", "Admin access required.", 403);
  }
  const operation = operationSchema.safeParse(
    new URL(request.url).searchParams.get("operation"),
  );
  if (!operation.success) {
    return refusal("bad-request", "Something went wrong. Please try again.");
  }
  const state = await readImport(operation.data, admin.id);
  const response = answer(state);
  return Response.json(response, { status: response.ok ? 200 : 404 });
}

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
    // The body stopped arriving — the modal's own Cancel, or a dropped
    // connection. Nothing was claimed and nothing was written.
    return refusal("cancelled", "The upload didn’t finish.");
  }

  // From here the work is not tied to the request: if the browser goes away the
  // import still finishes, and a retry with the same operation id gets the
  // recorded result rather than a second set of drafts.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Enqueueing on a cancelled stream throws; a departed reader must never
      // be able to fail the import that is writing to it.
      const send = (value: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        } catch {
          // nobody is listening
        }
      };
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
        report(error, {
          route: "admin/issues/import",
          operationId: decisions.operationId,
        });
        send({
          ok: false,
          code: "failed",
          message:
            "The import didn’t go through, and nothing was changed. Please try again.",
        } satisfies ImportResponse);
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
        try {
          controller.close();
        } catch {
          // already cancelled
        }
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
