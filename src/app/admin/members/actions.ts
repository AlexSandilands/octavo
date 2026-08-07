"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createUser,
  createUsers,
  deleteUser,
  deleteUsers,
  listMatchingUserIds,
  setAdmin,
  setSubscribed,
  setSubscribedMany,
  updateUser,
  type BulkDeleteResult,
  type BulkSubscribeResult,
} from "@/server/users";
import { requireAdmin } from "@/server/session";
import { MEMBERS_QUERY_MAX } from "@/features/members/query-limit";
import { MEMBERS_IMPORT_MAX } from "@/features/members/import-limit";
import {
  isMemberEmail,
  MEMBER_EMAIL_MAX,
  normaliseMemberEmail,
} from "@/lib/member-email";

// Mutations the members admin UI calls. Server-action arguments are
// attacker-controlled JSON regardless of their TypeScript types, so every one
// is re-validated with zod here, and every action starts with requireAdmin():
// the /admin layout only guards page navigations, but an action can be invoked
// directly by any client that knows its id. Guard rails (no self-removal, keep
// one admin) live in the data layer so they hold under concurrency.

const idSchema = z.string().uuid();

// A selection from the members table, which renders every member — so
// select-all is legitimately the whole club list, and the bound has to sit
// well clear of it or the UI could build a selection its own action refuses.
// 2000 is roughly double a realistic club: no selection a person can make is
// ever rejected, while an id list an order of magnitude longer still is. The
// bound's job is to turn away scripts, not selections. Duplicates are harmless
// — the data layer de-dupes.
const idsSchema = z.array(idSchema).min(1).max(2000);

// Trim + lowercase before validating so "  Alex@Example.COM " becomes a clean,
// canonical key that matches the unique index and future sign-ins. The address
// itself is judged by the shared predicate in lib/member-email — the same one
// the browser's CSV preview uses, so the two ends cannot disagree about which
// rows are importable (#124). It is zod's own `.email()` pattern, so nothing
// the server used to accept is turned away now.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .max(MEMBER_EMAIL_MAX)
      .refine(isMemberEmail, "Not an address we can use"),
  );
const nameSchema = z.string().trim().max(200);

const addSchema = z
  .object({ email: emailSchema, name: nameSchema.optional() })
  .strict();

// Same shape as add: editing sets both fields (name absent/blank → null).
const updateSchema = addSchema;

// One row of an import, validated on its own — see importMembersAction for why
// the batch is never validated as a whole.
const importRowSchema = z
  .object({ email: emailSchema, name: nameSchema.nullable() })
  .strict();

// Enough of a refused row to recognise it, if it has that much: the address it
// carried. Read with zod like everything else here — the row is by definition
// the part of the batch that didn't validate.
const rowLabelSchema = z.object({ email: z.string() });

// How many refused rows come back with their addresses. A real file has a
// handful; a junk one has thousands, and neither the response nor the dialog
// should carry a wall of them. The count comes back in full either way.
const SKIPPED_REPORT_MAX = 20;

export type AddMemberResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "duplicate" };

export async function addMemberAction(
  input: unknown,
): Promise<AddMemberResult> {
  await requireAdmin();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const name = parsed.data.name;
  const result = await createUser({
    email: parsed.data.email,
    name: name && name.length > 0 ? name : null,
  });
  if (!result.ok) return { ok: false, reason: "duplicate" };
  revalidatePath("/admin/members");
  return { ok: true };
}

export type UpdateMemberResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "duplicate" | "missing" };

// Edit an existing member's name + email. Email is the sign-in identity: future
// magic links go to the new address, but existing DB sessions are keyed by user
// id, so changing it doesn't sign the member out. Mirrors addMemberAction —
// requireAdmin first, then re-validate id + body (both attacker-controlled).
export async function updateMemberAction(
  id: unknown,
  input: unknown,
): Promise<UpdateMemberResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsed = updateSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const name = parsed.data.name;
  const result = await updateUser(parsedId.data, {
    email: parsed.data.email,
    name: name && name.length > 0 ? name : null,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  revalidatePath("/admin/members");
  return { ok: true };
}

export type RemoveMemberResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "self" | "last-admin" | "missing" };

export async function removeMemberAction(
  id: unknown,
): Promise<RemoveMemberResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await deleteUser(parsed.data, admin.id);
  if (!result.ok) return { ok: false, reason: result.reason };
  revalidatePath("/admin/members");
  return { ok: true };
}

export type RemoveMembersResult =
  | ({ ok: true } & BulkDeleteResult)
  | { ok: false; reason: "invalid" };

// Bulk removal from the table's selection. Unlike the single-row action this
// never fails on a guard rail: the protected rows are refused and counted, and
// the caller reports the split ("12 removed, 1 skipped").
export async function removeMembersAction(
  ids: unknown,
): Promise<RemoveMembersResult> {
  const admin = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await deleteUsers(parsed.data, admin.id);
  revalidatePath("/admin/members");
  return { ok: true, ...result };
}

export type SetSubscribedManyResult =
  | ({ ok: true } & BulkSubscribeResult)
  | { ok: false; reason: "invalid" };

export async function setSubscribedManyAction(
  ids: unknown,
  subscribed: unknown,
): Promise<SetSubscribedManyResult> {
  await requireAdmin();
  const parsedIds = idsSchema.safeParse(ids);
  const parsedFlag = z.boolean().safeParse(subscribed);
  if (!parsedIds.success || !parsedFlag.success) {
    return { ok: false, reason: "invalid" };
  }
  const result = await setSubscribedMany(parsedIds.data, parsedFlag.data);
  revalidatePath("/admin/members");
  return { ok: true, ...result };
}

export type ToggleResult = { ok: true } | { ok: false };

export async function setSubscribedAction(
  id: unknown,
  subscribed: unknown,
): Promise<ToggleResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedFlag = z.boolean().safeParse(subscribed);
  if (!parsedId.success || !parsedFlag.success) return { ok: false };
  const changed = await setSubscribed(parsedId.data, parsedFlag.data);
  if (!changed) return { ok: false };
  revalidatePath("/admin/members");
  return { ok: true };
}

export type SetAdminResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "self" | "last-admin" | "missing" };

export async function setAdminAction(
  id: unknown,
  makeAdmin: unknown,
): Promise<SetAdminResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedFlag = z.boolean().safeParse(makeAdmin);
  if (!parsedId.success || !parsedFlag.success) {
    return { ok: false, reason: "invalid" };
  }
  const result = await setAdmin(parsedId.data, parsedFlag.data, admin.id);
  if (!result.ok) return { ok: false, reason: result.reason };
  revalidatePath("/admin/members");
  return { ok: true };
}

export type MatchingMemberIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; reason: "invalid" };

// The bulk bar's "Select all N matching": the ids for the current search +
// status filter, fetched only when the admin asks for them. A read, not a
// mutation — but still admin-gated and re-validated, because member ids are
// membership data. The ids feed the same bulk actions as hand-picked rows, so
// idsSchema's 2000 bound covers whatever this returns for a realistic club.
export async function matchingMemberIdsAction(
  query: unknown,
  filter: unknown,
): Promise<MatchingMemberIdsResult> {
  await requireAdmin();
  const parsedQuery = z.string().max(MEMBERS_QUERY_MAX).safeParse(query);
  const parsedFilter = z
    .enum(["all", "admins", "subscribed", "unsubscribed"])
    .safeParse(filter);
  if (!parsedQuery.success || !parsedFilter.success) {
    return { ok: false, reason: "invalid" };
  }
  const ids = await listMatchingUserIds({
    query: parsedQuery.data,
    filter: parsedFilter.data,
  });
  return { ok: true, ids };
}

// A row the import refused, named for the admin: its position in the batch
// (1-based) and the address it carried, when it carried one.
export type SkippedImportRow = { row: number; email: string };

export type ImportMembersResult =
  | {
      ok: true;
      added: number;
      alreadyMembers: number;
      updated: number;
      // The first SKIPPED_REPORT_MAX refused rows, and how many there were.
      skipped: SkippedImportRow[];
      skippedCount: number;
    }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "too-many"; limit: number };

function rowLabel(row: unknown): string {
  const parsed = rowLabelSchema.safeParse(row);
  if (!parsed.success) return "";
  return normaliseMemberEmail(parsed.data.email).slice(0, MEMBER_EMAIL_MAX);
}

// Import a batch of rows, validating each one on its own. The batch used to be
// parsed as a single schema, which is all-or-nothing: one address zod wouldn't
// have — a doubled dot, a non-ASCII local part, a numeric TLD — rejected the
// whole roster and inserted nothing, with no way to tell which row was at fault
// (#124). Now a row that fails validation is skipped and named in the result,
// the rest are written, and the batch is only ever refused whole for something
// the admin can act on: a payload that isn't a list, or one over the cap.
export async function importMembersAction(
  rows: unknown,
): Promise<ImportMembersResult> {
  await requireAdmin();
  const batch = z.array(z.unknown()).safeParse(rows);
  if (!batch.success) return { ok: false, reason: "invalid" };
  if (batch.data.length > MEMBERS_IMPORT_MAX) {
    return { ok: false, reason: "too-many", limit: MEMBERS_IMPORT_MAX };
  }

  const valid: { email: string; name: string | null }[] = [];
  const skipped: SkippedImportRow[] = [];
  let skippedCount = 0;
  batch.data.forEach((row, i) => {
    const parsed = importRowSchema.safeParse(row);
    if (!parsed.success) {
      skippedCount++;
      if (skipped.length < SKIPPED_REPORT_MAX) {
        skipped.push({ row: i + 1, email: rowLabel(row) });
      }
      return;
    }
    const name = parsed.data.name;
    valid.push({
      email: parsed.data.email,
      name: name && name.length > 0 ? name : null,
    });
  });

  const result = await createUsers(valid);
  revalidatePath("/admin/members");
  return {
    ok: true,
    added: result.added,
    alreadyMembers: result.alreadyMembers,
    updated: result.updated,
    skipped,
    skippedCount,
  };
}
