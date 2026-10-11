"use client";
import { unstable_isUnrecognizedActionError, useRouter } from "next/navigation";
import { publishIssueAction, type PublishResult } from "@/app/admin/actions";
import { reportEditorError } from "./report-error";

/** A publish from a page that outlived a deploy: the action no longer exists
 *  on the server, so only a reload can publish (#401). */
export type PublishOutcome = PublishResult | { ok: false; reason: "stale" };

// The two flows that leave the editor: opening the preview and publishing.
// Both flush the autosave first; stale content is never previewed or shipped.
export function useEditorFlows({
  issueId,
  flushSave,
  onSaveError,
  onPublished,
}: {
  issueId: string;
  flushSave: () => Promise<boolean>;
  onSaveError: () => void;
  onPublished: (number: number) => void;
}) {
  const router = useRouter();
  const preview = async () => {
    // Open the preview in a new tab so the editor stays mounted with its
    // unsaved in-memory state — closing the tab returns you to the editor
    // exactly as you left it (no stale back-navigation render). The blank
    // tab is opened in the click gesture to dodge popup blockers, then
    // pointed at the reader once the save lands.
    const tab = window.open("", "_blank");
    const ok = await flushSave();
    if (!ok) {
      // The save didn't land (status pill shows why) — don't preview stale content.
      tab?.close();
      return;
    }
    // Preview by internal id under /admin: drafts are never served from the
    // public /read route (published issues only).
    const url = `/admin/issues/${issueId}/preview`;
    if (tab) tab.location.href = url;
    else router.push(url);
  };
  const publish = async (
    sendEmail: boolean,
    number: number,
  ): Promise<PublishOutcome> => {
    try {
      // A failed flush surfaces in the status pill and blocks the publish.
      const ok = await flushSave();
      if (!ok) return { ok: false, reason: "failed" };
      const res = await publishIssueAction(issueId, sendEmail, number);
      if (res.ok) onPublished(res.number);
      // A taken number is the modal's to correct — nothing went wrong here.
      else if (res.reason !== "taken") onSaveError();
      return res;
    } catch (error) {
      // The flush above saved through the JSON route, so the pill stays clean.
      if (unstable_isUnrecognizedActionError(error))
        return { ok: false, reason: "stale" };
      reportEditorError(error, "publish", { issueId, sendEmail, number });
      onSaveError();
      return { ok: false, reason: "failed" };
    }
  };
  return { preview, publish };
}
