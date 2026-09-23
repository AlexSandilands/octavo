import "server-only";
import { and, eq, ne, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberNames } from "@/db/schema";
import type { WriteResult } from "@/lib/comments";
import { checkMemberName } from "@/lib/member-name";
import { INVALID } from "./discussion-guard";
import {
  id,
  renameInput,
  replaceAvatar,
  reservedNames,
  writeName,
  type NameResult,
} from "./member-names";
import { requireAdmin } from "./session";

// An admin's moderation of posting names (issues #300, #302): reword any name,
// retire one so it sticks, clear a photo. Split from member-names.ts, whose
// helpers these share; every function starts with requireAdmin().

// Every rule but the profanity filter: this is how a real name the filter
// trips gets set for a member. A retired name can be reworded too, for what
// its old comments show; it stays retired.
export async function adminRenameName(input: {
  nameId: string;
  name: string;
}): Promise<NameResult> {
  await requireAdmin();
  const parsed = renameInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const [owner] = await db
    .select({ userId: memberNames.userId })
    .from(memberNames)
    .where(eq(memberNames.id, parsed.data.nameId));
  if (!owner) return INVALID;
  const check = checkMemberName(parsed.data.name, {
    reserved: await reservedNames(),
    skipProfanity: true,
  });
  if (!check.ok) return check;
  return writeName(
    parsed.data.nameId,
    owner.userId,
    check,
    {
      duplicate: "That member already has this name.",
      retired: "That member has retired this name. They can add it again.",
      adminRetired: "That name has already been retired by an admin.",
    },
    { retired: true },
  );
}

// Retired, never deleted: the name stays on the comments posted under it,
// and the member can't add it back. A name the member retired themselves can
// be retired again by an admin, which makes it stick.
export async function adminRetireName(nameId: string): Promise<WriteResult> {
  await requireAdmin();
  const parsed = id.safeParse(nameId);
  if (!parsed.success) return INVALID;
  const [row] = await db
    .update(memberNames)
    .set({
      retiredAt: sql`coalesce(${memberNames.retiredAt}, now())`,
      retiredBy: "admin",
    })
    .where(
      and(
        eq(memberNames.id, parsed.data),
        or(isNull(memberNames.retiredBy), ne(memberNames.retiredBy, "admin")),
      ),
    )
    .returning({ id: memberNames.id });
  return row ? { ok: true } : INVALID;
}

export async function clearAvatar(nameId: string): Promise<WriteResult> {
  await requireAdmin();
  const parsed = id.safeParse(nameId);
  if (!parsed.success) return INVALID;
  return replaceAvatar(parsed.data, null, null);
}
