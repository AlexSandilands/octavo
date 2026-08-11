import "server-only";
import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  EMPTY_SETTINGS,
  FOOTER_ALIGNS,
  MARK_SIZES,
  TEXT_SIZES,
  resolveSettings,
  type SiteSettings,
  type StoredSettings,
} from "@/lib/branding";
import { siteDefaults } from "@/lib/site-defaults";

// The owner-editable magazine settings (issue #105): one row, read on nearly
// every request, written only from /admin/magazine. This module is the ONLY
// consumer of src/lib/site-defaults.ts — every other call site asks for the
// effective values so the DB → env → default chain is resolved in one place.

// The singleton row's fixed id (the table CHECKs it), so reads and the upsert
// both address the same row and a second one can't exist.
const SETTINGS_ID = 1;

// Explicit column list — no spreads — so a schema change can't silently widen
// what we read. Mirrors server/logos.ts.
const settingsSelection = {
  magazineName: settings.magazineName,
  orgName: settings.orgName,
  tagline: settings.tagline,
  footerMarkSize: settings.footerMarkSize,
  footerTextSize: settings.footerTextSize,
  footerAlign: settings.footerAlign,
  pdfDownloads: settings.pdfDownloads,
};

// The appearance columns are plain text, so a value hand-edited into the
// database is external input like any other. `.catch(null)` degrades anything
// unrecognised to "use the default" rather than emitting a class name nothing
// styles — reading is never gated by bad config (the same rule resolveTheme
// follows for layout themes).
const storedSchema = z.object({
  magazineName: z.string().nullable().catch(null),
  orgName: z.string().nullable().catch(null),
  tagline: z.string().nullable().catch(null),
  footerMarkSize: z.enum(MARK_SIZES).nullable().catch(null),
  footerTextSize: z.enum(TEXT_SIZES).nullable().catch(null),
  footerAlign: z.enum(FOOTER_ALIGNS).nullable().catch(null),
  // Postgres types this one, so `.catch(null)` only fires on a row that isn't
  // the shape the driver promised. Same treatment anyway: unreadable means "not
  // configured", which is the enabled default — see DEFAULT_PDF_DOWNLOADS for
  // why that direction is the deliberate one (issue #162).
  pdfDownloads: z.boolean().nullable().catch(null),
});

// The stored row, or all-nulls when there is none (the first-run state, and
// what every deployment looks like until someone opens the page).
//
// This one THROWS if the read itself fails, because "there is nothing stored"
// and "we don't know what is stored" are different answers and only the caller
// knows which of them it can live with. The two wrappers below make that choice
// explicitly, in opposite directions (issue #126).
//
// React `cache()` so the dozen server components that need branding on one
// request share a single query — including the rejection, so a failure is the
// same failure for every caller on the request.
const queryStored = cache(async (): Promise<StoredSettings> => {
  // `next build` has no database (and no DATABASE_URL — issue #67), but it does
  // evaluate the root layout's generateMetadata while prerendering the shells
  // for the few genuinely static routes. Answering with the deployment defaults
  // keeps that honest and quiet; every route that shows branding renders
  // dynamically for the CSP nonce, so nothing branded is baked in at build.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return EMPTY_SETTINGS;
  }
  const [row] = await db
    .select(settingsSelection)
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .limit(1);
  if (!row) return EMPTY_SETTINGS;
  return storedSchema.parse(row);
});

// The read path: a failure falls back to all-nulls instead of throwing, because
// the chrome has a perfectly good fallback in the deployment defaults and the
// alternative is that a database blip takes down the sign-in page, the 404 page
// and every layout's <title> along with it (design-principles §10). It is
// logged, because silently serving the old branding after an edit is otherwise
// baffling.
//
// Read-only callers only. Anything that seeds an editable form must use
// getSettingsForAdmin() — an empty form saved back over a live row is silent
// data loss, which is the one thing worse than showing the defaults for a
// minute.
async function readStored(): Promise<StoredSettings> {
  try {
    return await queryStored();
  } catch (err) {
    logReadFailure(
      "Failed to read magazine settings — falling back to the deployment defaults",
      err,
    );
    return EMPTY_SETTINGS;
  }
}

// Captured explicitly: the catch means this never reaches Sentry's
// onRequestError, and a site quietly serving the wrong branding shouldn't
// depend on someone reading the server logs.
function logReadFailure(message: string, err: unknown): void {
  console.error(message, err);
  Sentry.captureException(err, { tags: { module: "settings" } });
}

/** The branding + footer appearance that should render for this request. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  return resolveSettings(await readStored(), siteDefaults);
});

/** What /admin/magazine needs: the raw row (so a null field can show its
 *  default as a placeholder and say it is using it), the deployment defaults it
 *  falls back to, and the effective values the live preview starts from —
 *  or `ok: false` when the row could not be read at all. */
export type AdminSettings =
  | {
      ok: true;
      stored: StoredSettings;
      defaults: SiteSettings;
      effective: SiteSettings;
    }
  | { ok: false };

// The write path's read. It reports the failure rather than swallowing it: the
// admin form is seeded from `stored`, and all-nulls means "every box is empty"
// — which the owner cannot tell apart from a never-customised deployment, and
// which their next save would write straight over the magazine's real name, org
// and tagline (issue #126). The caller must refuse to render the form.
export async function getSettingsForAdmin(): Promise<AdminSettings> {
  try {
    const stored = await queryStored();
    return {
      ok: true,
      stored,
      defaults: siteDefaults,
      effective: resolveSettings(stored, siteDefaults),
    };
  } catch (err) {
    logReadFailure(
      "Failed to read magazine settings for /admin/magazine — refusing to render the form",
      err,
    );
    return { ok: false };
  }
}

// Explicit column list — never spread caller input into the VALUES clause.
// One upsert on the fixed id: the row is created on the owner's first save and
// updated on every one after, so nothing has to seed it.
export async function updateSettings(input: StoredSettings): Promise<void> {
  const values = {
    magazineName: input.magazineName,
    orgName: input.orgName,
    tagline: input.tagline,
    footerMarkSize: input.footerMarkSize,
    footerTextSize: input.footerTextSize,
    footerAlign: input.footerAlign,
    pdfDownloads: input.pdfDownloads,
    updatedAt: new Date(),
  };
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: settings.id, set: values });
}

// The chrome fingerprint the PDF cache key carries (issue #105 §4). Cached PDFs
// bake the magazine name (classic running head, no-logo footer), the org name
// (footer lockup) and the footer's appearance into every page, none of which
// bumps `issues.revision` — so without this a branding edit would serve stale
// PDFs forever.
//
// It hashes the *effective* values, and only the ones that reach the printed
// page: the tagline is deliberately absent because it never renders in a PDF,
// and hashing it would rebuild every cached issue for a change nobody can see
// there. `pdfDownloads` is absent for the same reason and must stay that way —
// it decides who may *fetch* a PDF, not what one looks like, so folding it in
// would rebuild every cached issue each time the owner flipped the switch
// (issue #162). Values are joined with a NUL so no pair of fields can be
// rearranged into the same string.
export function chromeFingerprint(s: SiteSettings): string {
  const material = [
    s.name,
    s.org,
    s.footer.markSize,
    s.footer.textSize,
    s.footer.align,
  ].join("\u0000");
  return createHash("sha256").update(material).digest("hex").slice(0, 10);
}
