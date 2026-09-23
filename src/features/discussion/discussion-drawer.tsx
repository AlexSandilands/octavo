"use client";

import { DialogShell } from "@/components/dialog-shell";
import { DiscussionBody } from "./discussion-body";
import type { Discussion } from "./use-discussion";
import styles from "./discussion.module.css";

// The desktop shell (issue #301): a drawer floating in from the right over the
// flipbook — the contents rail's twin — as a real dialog. It lies over the
// stage rather than beside it, so the spread never moves or resizes.
export function DiscussionDrawer({ talk }: { talk: Discussion }) {
  return (
    <DialogShell
      overlayClassName="fixed inset-0 z-50 flex justify-end bg-[rgba(32,32,28,0.18)] p-3"
      panelClassName={`${styles.drawer} bg-card flex h-full w-[440px] max-w-full flex-col overflow-hidden rounded-[12px] shadow-[0_24px_60px_rgba(0,0,0,0.3)] outline-none!`}
      initialFocus="panel"
      onClose={talk.hide}
    >
      {(titleId) => <DiscussionBody talk={talk} titleId={titleId} />}
    </DialogShell>
  );
}
