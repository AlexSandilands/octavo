"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createUser,
  createUsers,
  deleteUser,
  setAdmin,
  setSubscribed,
} from "@/server/users";
import { requireAdmin } from "@/server/session";

// Mutations the members admin UI calls. Server-action arguments are
// attacker-controlled JSON regardless of their TypeScript types, so every one
// is re-validated with zod here, and every action starts with requireAdmin():
// the /admin layout only guards page navigations, but an action can be invoked
// directly by any client that knows its id. Guard rails (no self-removal, keep
// one admin) live in the data layer so they hold under concurrency.

const idSchema = z.string().uuid();

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
  | { ok: true; added: number; alreadyMembers: number }
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
  };
}
