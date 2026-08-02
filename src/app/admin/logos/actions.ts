"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLogo, deleteLogo, renameLogo } from "@/server/logos";
import { getImagesByIds } from "@/server/images";
import { requireAdmin } from "@/server/session";

// Mutations the logos admin UI calls. Like the sponsor actions, arguments are
// attacker-controlled JSON regardless of their TypeScript types, so every one is
// re-validated with zod and every action starts with requireAdmin() — the page
// gate only guards navigation, not a direct action invocation.

const idSchema = z.string().uuid();
const nameSchema = z.string().trim().min(1, "Name is required").max(200);

const createSchema = z.object({ name: nameSchema, imageId: idSchema }).strict();

export type LogoActionResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid" | "missing-image" | "error" };

export async function createLogoAction(
  input: unknown,
): Promise<LogoActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  // The imageId arrives from the client's own upload, so it is well-formed in
  // practice — but a stale or forged one would trip the foreign key, so check
  // it names a real image and answer with a message the admin can act on.
  const [image] = await getImagesByIds([parsed.data.imageId]);
  if (!image) return { ok: false, reason: "missing-image" };
  try {
    const id = await createLogo({
      name: parsed.data.name,
      imageId: parsed.data.imageId,
    });
    revalidatePath("/admin/logos");
    return { ok: true, id };
  } catch (err) {
    console.error("createLogoAction failed", err);
    return { ok: false, reason: "error" };
  }
}

export async function renameLogoAction(
  id: string,
  name: unknown,
): Promise<LogoActionResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedName = nameSchema.safeParse(name);
  if (!parsedId.success || !parsedName.success) {
    return { ok: false, reason: "invalid" };
  }
  try {
    await renameLogo(parsedId.data, parsedName.data);
    revalidatePath("/admin/logos");
    return { ok: true, id: parsedId.data };
  } catch (err) {
    console.error("renameLogoAction failed", err);
    return { ok: false, reason: "error" };
  }
}

export type DeleteLogoResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "in-use" | "error" };

export async function deleteLogoAction(id: string): Promise<DeleteLogoResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  try {
    const result = await deleteLogo(parsed.data);
    if (result === "in-use") return { ok: false, reason: "in-use" };
    revalidatePath("/admin/logos");
    return { ok: true };
  } catch (err) {
    console.error("deleteLogoAction failed", err);
    return { ok: false, reason: "error" };
  }
}
