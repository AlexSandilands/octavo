"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  FOOTER_ALIGNS,
  MARK_SIZE,
  TEXT_SIZE,
  type StoredSettings,
} from "@/lib/branding";
import { requireAdmin } from "@/server/session";
import { footerSizeSchema, updateSettings } from "@/server/settings";

// The one mutation behind /admin/magazine. Like every other admin action, the
// argument is attacker-controlled JSON whatever its TypeScript type says, so it
// is re-validated with zod and the action starts with requireAdmin() — the page
// gate only guards navigation, not a direct action invocation.

// An empty (or whitespace-only) field means "use the deployment default", which
// is stored as NULL — so clearing the box in the UI puts the NEXT_PUBLIC_* value
// back rather than blanking the magazine's name everywhere. Lengths are bounded
// well above anything sensible: these strings render in a page footer and an
// email subject, and an unbounded one would wreck both.
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => {
      // Control characters (newlines included) never belong in wording that
      // renders in a one-line footer and an email subject; strip rather than
      // reject, since they only arrive via paste.
      const trimmed = (value ?? "")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
        .trim();
      return trimmed === "" ? null : trimmed;
    });

// The appearance fields always carry a concrete choice: their defaults are code
// constants with no env counterpart, so "27px" and "the default" are the same
// value and a null option in the picker would be a distinction without a
// difference. The columns stay nullable for the untouched-deployment case.
// The two sizes are whole px within their axis (issue #216); the number field
// is not the boundary, so this refuses the same range.
// `pdfDownloads` is the same kind of field — the switch is always up or down —
// so it too arrives concrete and is stored concrete (issue #162).
const settingsSchema = z
  .object({
    magazineName: optionalText(80),
    orgName: optionalText(80),
    tagline: optionalText(200),
    footerMarkSize: footerSizeSchema(MARK_SIZE),
    footerTextSize: footerSizeSchema(TEXT_SIZE),
    footerAlign: z.enum(FOOTER_ALIGNS),
    pdfDownloads: z.boolean(),
  })
  .strict();

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "error" };

export async function updateSettingsAction(
  input: unknown,
): Promise<SettingsActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  try {
    await updateSettings(parsed.data satisfies StoredSettings);
    // Branding reaches the layout, the library, every reader page and the
    // sign-in screen, so the whole tree is stale — including the client router
    // cache, which is what a soft navigation would otherwise serve.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("updateSettingsAction failed", err);
    return { ok: false, reason: "error" };
  }
}
