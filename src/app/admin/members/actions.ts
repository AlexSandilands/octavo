"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createUser,
  createUsers,
  deleteUser,
  deleteUsers,
  setAdmin,
  setSubscribed,
  setSubscribedMany,
  updateUser,
  type BulkDeleteResult,
  type BulkSubscribeResult,
} from "@/server/users";
import { requireAdmin } from "@/server/session";

// Mutations the members admin UI calls. Server-action arguments are
// attacker-controlled JSON regardless of their TypeScript types, so every one
// is re-validated with zod here, and every action starts with requireAdmin():
// the /admin layout only guards page navigations, but an action can be invoked
// directly by any client that knows its id. Guard rails (no self-removal, keep
// one admin) live in the data layer so they hold under concurrency.

const idSchema = z.string().uuid();

// A selection from the members table. Bounded because the table selects only
// what a person can see: the club is ~1000 members, so a longer id list is a
// script, not a selection. Duplicates are harmless — the data layer de-dupes.
const idsSchema = z.array(idSchema).min(1).max(500);

// Trim + lowercase before validating so "  Alex@Example.COM " becomes a clean,
// canonical key that matches the unique index and future sign-ins.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email().max(200));
const nameSchema = z.string().trim().max(200);

const addSchema = z
  .object({ email: emailSchema, name: nameSchema.optional() })
  .strict();

// Same shape as add: editing sets both fields (name absent/blank → null).
const updateSchema = addSchema;

const importSchema = z
  .array(z.object({ email: emailSchema, name: nameSchema.nullable() }).strict())
  // Cap the batch: the club is ~1000 members, so a five-figure import is a
  // malformed file or an abuse attempt, not a real list.
  .max(5000);

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

export type ImportMembersResult =
  | { ok: true; added: number; alreadyMembers: number; updated: number }
  | { ok: false; reason: "invalid" };

export async function importMembersAction(
  rows: unknown,
): Promise<ImportMembersResult> {
  await requireAdmin();
  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const normalised = parsed.data.map((r) => ({
    email: r.email,
    name: r.name && r.name.length > 0 ? r.name : null,
  }));
  const result = await createUsers(normalised);
  revalidatePath("/admin/members");
  return {
    ok: true,
    added: result.added,
    alreadyMembers: result.alreadyMembers,
    updated: result.updated,
  };
}
