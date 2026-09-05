"use client";

import { useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/blocks";
import { saveIssueAction, saveMetaAction } from "@/app/admin/actions";
import type { SaveStatus } from "./editor-header";
import { reportEditorError } from "./report-error";

// The editor's autosave — split out of editor.tsx (issue #222) so the component
// stays under the size limit. Content and meta are debounced separately, and the
// status it returns is what the header's pill shows.
//
// Saves are serialized through one promise chain and carry the revision they
// were based on, so an autosave can never overtake an earlier one and a stale
// editor (another tab) gets a visible conflict instead of silently overwriting
// newer work. Failures surface in the status pill with a retry.
export function useEditorAutosave({
  issueId,
  revision,
  pages,
  title,
  theme,
  logoId,
}: {
  issueId: string;
  revision: number;
  pages: Page[];
  title: string;
  theme: string;
  logoId: string | null;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const statusRef = useRef(status);
  const revisionRef = useRef(revision);
  const latestRef = useRef({ pages, title, theme, logoId });
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  // Mirrored during render on purpose: a queued save runs on a microtask,
  // which can beat an effect-time mirror to these values.
  // eslint-disable-next-line react-hooks/refs
  statusRef.current = status;
  // eslint-disable-next-line react-hooks/refs
  latestRef.current = { pages, title, theme, logoId };

  const enqueueSave = (kind: "content" | "meta" | "all") => {
    const run = async (): Promise<boolean> => {
      // After a conflict only a reload makes sense — don't keep writing.
      if (statusRef.current === "conflict") return false;
      setStatus("saving");
      try {
        const { pages, title, theme, logoId } = latestRef.current;
        if (kind !== "meta") {
          const res = await saveIssueAction(
            issueId,
            { pages },
            revisionRef.current,
          );
          if (!res.ok) {
            setStatus(res.reason === "conflict" ? "conflict" : "error");
            return false;
          }
          revisionRef.current = res.revision;
        }
        if (kind !== "content") {
          const res = await saveMetaAction(issueId, { title, theme, logoId });
          if (!res.ok) {
            setStatus("error");
            return false;
          }
        }
        setStatus("saved");
        return true;
      } catch (error) {
        reportEditorError(error, "save", { issueId, kind });
        setStatus("error");
        return false;
      }
    };
    const next = chainRef.current.then(run, run);
    chainRef.current = next;
    return next;
  };

  // Debounced autosave of content.
  const firstContent = useRef(true);
  useEffect(() => {
    if (firstContent.current) {
      firstContent.current = false;
      return;
    }
    if (statusRef.current !== "conflict") setStatus("saving");
    const t = setTimeout(() => void enqueueSave("content"), 800);
    return () => clearTimeout(t);
    // enqueueSave reads latest state through refs; the deps that matter are the
    // edits themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, issueId]);

  // Debounced autosave of meta (title + theme + footer logo).
  const firstMeta = useRef(true);
  useEffect(() => {
    if (firstMeta.current) {
      firstMeta.current = false;
      return;
    }
    if (statusRef.current !== "conflict") setStatus("saving");
    const t = setTimeout(() => void enqueueSave("meta"), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, theme, logoId, issueId]);

  // Warn before closing the tab while an edit hasn't landed on the server.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "saved") return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    status,
    setStatus,
    enqueueSave,
    /**
     * Flush the latest content + meta to the server *now*, bypassing the
     * debounce. Navigating to Preview (or publishing) before the 800ms autosave
     * fires would otherwise drop the most recent edits — they'd reload stale
     * from the DB. Returns false when the save didn't land, so callers don't
     * proceed.
     */
    flushSave: () => enqueueSave("all"),
  };
}
