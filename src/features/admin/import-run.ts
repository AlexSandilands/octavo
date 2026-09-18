import {
  IMPORT_DECISIONS_HEADER,
  type ImportDecision,
} from "@/lib/issue-transfer/decisions";
import type { ImportPhase, ImportResponse } from "@/lib/issue-transfer/result";

// The one upload request, driven with XMLHttpRequest rather than fetch: only
// XHR reports how much of the body has gone, which is what lets the modal show
// real progress on a file that can be a quarter of a gigabyte — and lets the
// admin cancel while it is still only an upload.
//
// The reply is newline-delimited JSON: phase lines while the server checks and
// imports, then the result. Read as it arrives, so the wait is narrated.

export type ImportRun = {
  done: Promise<ImportResponse>;
  /** Abort the upload. Nothing has been written until checking begins. */
  cancel: () => void;
};

const NETWORK_FAILURE: ImportResponse = {
  ok: false,
  code: "network",
  message:
    "The connection dropped. If the import had already started, press Retry — it will report what happened rather than import twice.",
};

export function runImport(options: {
  file: File;
  operationId: string;
  decisions: ImportDecision[];
  onProgress: (fraction: number) => void;
  onPhase: (phase: ImportPhase) => void;
}): ImportRun {
  const xhr = new XMLHttpRequest();
  const done = new Promise<ImportResponse>((resolve) => {
    let consumed = 0;

    const take = (text: string, final: boolean) => {
      // Only whole lines: the tail is still arriving until the body ends.
      const end = final ? text.length : text.lastIndexOf("\n") + 1;
      if (end <= consumed) return;
      const chunk = text.slice(consumed, end);
      consumed = end;
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          continue;
        }
        if (isPhase(value)) options.onPhase(value.phase);
        else if (isResponse(value)) resolve(value);
      }
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress(event.loaded / event.total);
      }
    });
    xhr.upload.addEventListener("load", () => options.onProgress(1));
    xhr.addEventListener("progress", () => take(xhr.responseText, false));
    xhr.addEventListener("load", () => {
      take(xhr.responseText, true);
      resolve(NETWORK_FAILURE);
    });
    xhr.addEventListener("error", () => resolve(NETWORK_FAILURE));
    xhr.addEventListener("abort", () =>
      resolve({ ok: false, code: "cancelled", message: "Import cancelled." }),
    );

    xhr.open("POST", "/api/admin/issues/import");
    xhr.setRequestHeader("content-type", "application/zip");
    xhr.setRequestHeader(
      IMPORT_DECISIONS_HEADER,
      JSON.stringify({
        operationId: options.operationId,
        decisions: options.decisions,
      }),
    );
    xhr.send(options.file);
  });

  return { done, cancel: () => xhr.abort() };
}

function isPhase(value: unknown): value is { phase: ImportPhase } {
  return (
    typeof value === "object" &&
    value !== null &&
    "phase" in value &&
    typeof (value as { phase: unknown }).phase === "string"
  );
}

function isResponse(value: unknown): value is ImportResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok: unknown }).ok === "boolean"
  );
}
