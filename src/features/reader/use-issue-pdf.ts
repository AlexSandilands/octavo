"use client";

import { useCallback, useRef, useState } from "react";

// Drives a "Download PDF" control: fetch the members-only endpoint, then hand
// the bytes to the browser as a file download. The first hit generates on the
// server (seconds) so `state` gates a spinner; a failure lands on "error" — a
// legible dead-end on the button, never a hung spinner. Shared by the desktop
// reader, mobile reader and the latest-issue card so the behaviour is identical.

export type PdfState = "idle" | "loading" | "error";

export function useIssuePdf(
  issueNumber: number,
  // The desktop reader passes its current theme toggle so the PDF matches what
  // the member is looking at; callers without a theme concept (mobile reader,
  // latest-issue card) omit it and the server renders the reader's default.
  theme?: "classic" | "modern",
) {
  const [state, setState] = useState<PdfState>("idle");
  // A ref (not just state) so a double-click can't launch two fetches in the
  // same tick before the "loading" render lands.
  const busy = useRef(false);

  const download = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState("loading");
    try {
      const query = theme ? `?theme=${theme}` : "";
      const res = await fetch(`/api/issues/${issueNumber}/pdf${query}`, {
        headers: { Accept: "application/pdf" },
      });
      if (!res.ok) throw new Error(`PDF request failed: ${res.status}`);

      const blob = await res.blob();
      // A blob: URL ignores Content-Disposition, so name the anchor ourselves
      // (reusing the server's filename when present).
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filenameFromDisposition(res.headers.get("Content-Disposition")) ??
        `issue-${issueNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch (err) {
      console.error("PDF download failed", err);
      setState("error");
    } finally {
      busy.current = false;
    }
  }, [issueNumber, theme]);

  return { state, download };
}

// Pull a filename from a Content-Disposition header, preferring the RFC 5987
// UTF-8 form. Returns null when absent/unparseable so the caller can fall back.
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] ?? null;
}
