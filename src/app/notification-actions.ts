"use server";

import { z } from "zod";
import type { WriteResult } from "@/lib/comments";
import { INVALID } from "@/server/discussion-guard";
import { markAllRead, markRead } from "@/server/notifications";
import { getUserFailClosed } from "@/server/session";

// The library bell's two writes (issue #303). *Whose* notifications always
// comes from the session inside the module; the id is attacker-typed.

const SIGNED_OUT = {
  ok: false as const,
  reason: "Please sign in again to see your notifications.",
};

export async function markNotificationReadAction(
  notificationId: unknown,
): Promise<WriteResult> {
  if (!(await getUserFailClosed())) return SIGNED_OUT;
  const parsed = z.string().min(1).max(64).safeParse(notificationId);
  if (!parsed.success) return INVALID;
  return markRead(parsed.data);
}

export async function markAllNotificationsReadAction(): Promise<WriteResult> {
  if (!(await getUserFailClosed())) return SIGNED_OUT;
  return markAllRead();
}
