"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSponsor,
  deleteSponsor,
  updateSponsor,
  type SponsorInput,
} from "@/server/sponsors";
import { getImagesByIds } from "@/server/images";
import { requireAdmin } from "@/server/session";

// Mutations the sponsors admin UI calls. Like the issue actions, arguments are
// attacker-controlled JSON regardless of their TypeScript types, so every one is
// re-validated with zod and every action starts with requireAdmin() — the page
// gate only guards navigation, not a direct action invocation.

const idSchema = z.string().uuid();

// href is capped but not shape-validated here: the same rule as sponsor/link
// hrefs in content (blocks.ts) — the readers run every href through
// `externalHref` before linking, so a scheme-less host still works and a junk
// value simply renders unlinked rather than blocking the save.
const sponsorInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    href: z.string().trim().max(2000).optional().default(""),
    logoId: z.string().uuid().optional().nullable(),
    // The date input yields YYYY-MM-DD; empty string clears it.
    activeUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export type SponsorActionResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid" | "error" };

// Turn validated form values into the DB input: empty strings become null, the
// date string becomes a local-midnight timestamp (matching isSponsorExpired's
// local-date comparison), and a logoId is kept only if it names a real image so
// a stale/forged id can't trip the foreign key.
async function toInput(
  data: z.infer<typeof sponsorInputSchema>,
): Promise<SponsorInput> {
  const href = data.href?.trim() ? data.href.trim() : null;
  let logoId: string | null = data.logoId ?? null;
  if (logoId) {
    const [image] = await getImagesByIds([logoId]);
    if (!image) logoId = null;
  }
  let activeUntil: Date | null = null;
  if (data.activeUntil) {
    const [y, m, d] = data.activeUntil.split("-").map(Number);
    activeUntil = new Date(y!, m! - 1, d!);
  }
  return { name: data.name, href, logoId, activeUntil };
}

export async function createSponsorAction(
  input: unknown,
): Promise<SponsorActionResult> {
  await requireAdmin();
  const parsed = sponsorInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  try {
    const id = await createSponsor(await toInput(parsed.data));
    revalidatePath("/admin/sponsors");
    return { ok: true, id };
  } catch (err) {
    console.error("createSponsorAction failed", err);
    return { ok: false, reason: "error" };
  }
}

export async function updateSponsorAction(
  id: string,
  input: unknown,
): Promise<SponsorActionResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsed = sponsorInputSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  try {
    await updateSponsor(parsedId.data, await toInput(parsed.data));
    revalidatePath("/admin/sponsors");
    return { ok: true, id: parsedId.data };
  } catch (err) {
    console.error("updateSponsorAction failed", err);
    return { ok: false, reason: "error" };
  }
}

export async function deleteSponsorAction(
  id: string,
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };
  await deleteSponsor(parsed.data);
  revalidatePath("/admin/sponsors");
  return { ok: true };
}
