"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WriteResult } from "@/lib/comments";
import { INVALID } from "@/server/discussion-guard";
import {
  adminRenameName,
  adminRetireName,
  clearAvatar,
} from "@/server/member-names";
import { getAdminUser } from "@/server/session";

// The admin's moderation of a member's posting names (issue #300): rename,
// retire, clear the photo. The module re-checks requireAdmin() itself.

const nameId = z.string().min(1).max(64);
const NOT_ADMIN = { ok: false as const, reason: "Admin access required." };

async function run<T extends WriteResult>(write: () => Promise<T>) {
  if (!(await getAdminUser())) return NOT_ADMIN;
  const result = await write();
  if (result.ok) revalidatePath("/admin/members");
  return result;
}

export async function adminRenameNameAction(id: unknown, name: unknown) {
  const parsed = z
    .object({ id: nameId, name: z.string().max(200) })
    .safeParse({ id, name });
  if (!parsed.success) return INVALID;
  return run(() =>
    adminRenameName({ nameId: parsed.data.id, name: parsed.data.name }),
  );
}

export async function adminRetireNameAction(id: unknown) {
  const parsed = nameId.safeParse(id);
  if (!parsed.success) return INVALID;
  return run(() => adminRetireName(parsed.data));
}

export async function adminClearAvatarAction(id: unknown) {
  const parsed = nameId.safeParse(id);
  if (!parsed.success) return INVALID;
  return run(() => clearAvatar(parsed.data));
}
