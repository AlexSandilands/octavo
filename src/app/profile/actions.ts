"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WriteResult } from "@/lib/comments";
import { discussionOff, INVALID } from "@/server/discussion-guard";
import {
  addName,
  clearNameAvatar,
  removeName,
  renameName,
  setNameBadge,
} from "@/server/member-names";
import { setReplyEmails } from "@/server/member-profile";
import { setSubscribed } from "@/server/recipients";
import {
  getAdminUser,
  getUserFailClosed,
  requireMemberOrRedirect,
} from "@/server/session";

// The member's own writes (issue #300). Each one takes *who* from the session —
// the module functions call requireMember() themselves — never from the form.

const toggle = z.enum(["true", "false"]);
const nameId = z.string().min(1).max(64);
const nameText = z.string().max(200);

// The email toggles (moved from /preferences, #86): native forms, so a
// signed-out POST is sent to /signin and a demo visitor changes nothing.
export async function updateEmailPreferenceAction(formData: FormData) {
  const user = await requireMemberOrRedirect("/profile");
  if (!user) return;
  const parsed = toggle.safeParse(formData.get("subscribe"));
  if (!parsed.success) return;
  await setSubscribed(user.id, parsed.data === "true");
  revalidatePath("/profile");
}

export async function updateReplyEmailsAction(formData: FormData) {
  const user = await requireMemberOrRedirect("/profile");
  if (!user) return;
  const parsed = toggle.safeParse(formData.get("replyEmails"));
  if (!parsed.success || (await discussionOff())) return;
  await setReplyEmails(user.id, parsed.data === "true");
  revalidatePath("/profile");
}

// Names and photos answer with a sentence rather than throwing, signed out and
// switched off included, so the page can show it as it stands.
async function memberGate(): Promise<{ ok: false; reason: string } | null> {
  if (!(await getUserFailClosed())) {
    return { ok: false, reason: "Please sign in again." };
  }
  return discussionOff();
}

function done<T extends WriteResult>(result: T): T {
  if (result.ok) revalidatePath("/profile");
  return result;
}

export async function addNameAction(name: unknown) {
  const refused = await memberGate();
  if (refused) return refused;
  const parsed = nameText.safeParse(name);
  if (!parsed.success) return INVALID;
  return done(await addName({ name: parsed.data }));
}

export async function renameNameAction(id: unknown, name: unknown) {
  const refused = await memberGate();
  if (refused) return refused;
  const parsed = z
    .object({ id: nameId, name: nameText })
    .safeParse({ id, name });
  if (!parsed.success) return INVALID;
  return done(
    await renameName({ nameId: parsed.data.id, name: parsed.data.name }),
  );
}

export async function removeNameAction(id: unknown) {
  const refused = await memberGate();
  if (refused) return refused;
  const parsed = nameId.safeParse(id);
  if (!parsed.success) return INVALID;
  return done(await removeName(parsed.data));
}

export async function removePhotoAction(id: unknown) {
  const refused = await memberGate();
  if (refused) return refused;
  const parsed = nameId.safeParse(id);
  if (!parsed.success) return INVALID;
  return done(await clearNameAvatar(parsed.data));
}

// An admin's own names only (the module matches the session's account).
export async function setBadgeAction(id: unknown, badge: unknown) {
  const refused = await memberGate();
  if (refused) return refused;
  if (!(await getAdminUser())) {
    return { ok: false as const, reason: "Only admins can show a badge." };
  }
  const parsed = z
    .object({ id: nameId, badge: z.boolean() })
    .safeParse({ id, badge });
  if (!parsed.success) return INVALID;
  return done(
    await setNameBadge({ nameId: parsed.data.id, badge: parsed.data.badge }),
  );
}
