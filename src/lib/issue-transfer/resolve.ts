import type { IssueContent } from "../blocks";
import { clampSize, MARK_SIZE, TEXT_SIZE } from "../branding";
import { createId } from "../id";
import { imageSites } from "../image-sites";
import type { LayoutThemeId } from "@/features/blocks/themes/registry";
import type { BundledIssue } from "./document";
import {
  normaliseLibraryName,
  refuse,
  type BundleManifest,
  type Refusal,
} from "./manifest";

// Turning a bundle into rows this site would have written itself. Pure: it is
// handed the destination's library and a set of freshly minted ids and returns
// what to create, which bundled images are actually needed and what it had to
// clear — no database, no storage, so the importer can run it twice (once to
// decide what to upload, once inside the commit transaction) and the in-memory
// check can run it at all.
//
// Two rules do most of the work. **Destination wins**: a sponsor or logo whose
// normalised name already exists is reused exactly as it is, never modified and
// never a conflict. **Unresolved references are cleared**: an id the bundle does
// not supply is emptied rather than carried, because two databases with a shared
// ancestry can hold entirely different rows under the same id.

export type LibraryRow = { id: string; name: string };
export type LogoRow = LibraryRow & { imageId: string };
export type DestinationLibrary = { sponsors: LibraryRow[]; logos: LogoRow[] };

export type LibraryOutcome = {
  manifestId: string;
  name: string;
  action: "reuse" | "create";
  /** The destination row the bundle's id now means. */
  id: string;
  /** The image row this entry points at: the destination's when a logo is
   *  reused, the bundle's new one when either kind is created. Null for a
   *  reused sponsor, whose artwork is read from its row at render time and is
   *  never the destination's business to change. */
  imageId: string | null;
  /** The bundled image to upload, when this row is being created. */
  bundleImageId: string | null;
};

export type ResolvedIssue = {
  manifestId: string;
  id: string;
  title: string;
  theme: LayoutThemeId;
  content: IssueContent;
  footerMarkSize: number;
  footerTextSize: number;
  logoId: string | null;
};

export type ClearedKind = "image" | "slide" | "montage" | "sponsor" | "logo";

export type ClearedReference = {
  title: string;
  kind: ClearedKind;
  count: number;
};

export type ResolvedImage = {
  bundleId: string;
  id: string;
  /** Which new issue the row is recorded against (`images.issueId`), or null
   *  for a library mark that no page uses. */
  issueId: string | null;
};

export type ResolvedBundle = {
  sponsors: LibraryOutcome[];
  logos: LibraryOutcome[];
  issues: ResolvedIssue[];
  images: ResolvedImage[];
  cleared: ClearedReference[];
};

export type Resolution =
  | { ok: true; bundle: ResolvedBundle }
  | { ok: false; refusal: Refusal };

/** Every id an import will write, minted once so the two resolution passes and
 *  the object keys they produce agree. */
export type NewIds = {
  issues: Record<string, string>;
  images: Record<string, string>;
  sponsors: Record<string, string>;
  logos: Record<string, string>;
};

export function mintIds(manifest: BundleManifest): NewIds {
  const map = (rows: { id: string }[]) =>
    Object.fromEntries(rows.map((row) => [row.id, createId()]));
  return {
    issues: map(manifest.issues),
    images: map(manifest.images),
    sponsors: map(manifest.sponsors),
    logos: map(manifest.logos),
  };
}

export function resolveBundle(input: {
  manifest: BundleManifest;
  documents: { manifestId: string; issue: BundledIssue }[];
  destination: DestinationLibrary;
  ids: NewIds;
}): Resolution {
  const { manifest, destination, ids } = input;

  const sponsors = matchLibrary(
    manifest.sponsors.map((s) => ({
      id: s.id,
      name: s.name,
      bundleImageId: s.logoImageId,
    })),
    destination.sponsors.map((row) => ({ ...row, imageId: null })),
    ids.sponsors,
    ids.images,
    "sponsor",
  );
  if (!sponsors.ok) return sponsors;

  const logos = matchLibrary(
    manifest.logos.map((l) => ({
      id: l.id,
      name: l.name,
      bundleImageId: l.imageId,
    })),
    destination.logos,
    ids.logos,
    ids.images,
    "logo",
  );
  if (!logos.ok) return logos;

  const sponsorById = new Map(sponsors.outcomes.map((o) => [o.manifestId, o]));
  const logoById = new Map(logos.outcomes.map((o) => [o.manifestId, o]));
  const bundledImages = new Set(manifest.images.map((image) => image.id));

  const needed = new Map<string, ResolvedImage>();
  const need = (bundleId: string, issueId: string | null) => {
    const id = ids.images[bundleId];
    if (!id) return undefined;
    const existing = needed.get(bundleId);
    if (existing) {
      if (!existing.issueId && issueId) existing.issueId = issueId;
      return id;
    }
    needed.set(bundleId, { bundleId, id, issueId });
    return id;
  };

  for (const outcome of [...sponsors.outcomes, ...logos.outcomes]) {
    if (outcome.action === "create" && outcome.bundleImageId) {
      need(outcome.bundleImageId, null);
    }
  }

  const cleared: ClearedReference[] = [];
  const issues: ResolvedIssue[] = [];

  for (const { manifestId, issue } of input.documents) {
    const id = ids.issues[manifestId];
    if (!id) return { ok: false, refusal: MISMATCH };
    const title = issue.title.trim() || "Untitled";
    const tally = new Map<ClearedKind, number>();
    const clear = (kind: ClearedKind) =>
      tally.set(kind, (tally.get(kind) ?? 0) + 1);

    const content = structuredClone(issue.content);
    const dropped = new WeakSet<object>();

    // A bundled image the manifest lists becomes its new row; anything else is
    // an id from another database and is dropped rather than carried.
    const remap = (bundleId: string | undefined): string | undefined => {
      if (!bundleId) return undefined;
      if (!bundledImages.has(bundleId)) {
        clear("image");
        return undefined;
      }
      return need(bundleId, id);
    };

    for (const site of imageSites(content)) {
      switch (site.kind) {
        case "coverLogo": {
          const element = site.element;
          if (element.logoId) {
            const outcome = logoById.get(element.logoId);
            if (outcome) {
              element.logoId = outcome.id;
              if (outcome.imageId) element.imageId = outcome.imageId;
              else delete element.imageId;
              break;
            }
            delete element.logoId;
            clear("logo");
          }
          // No library logo any more, so its own artwork is an ordinary image.
          element.imageId = remap(element.imageId);
          break;
        }
        case "block":
          site.block.imageId = remap(site.block.imageId);
          break;
        case "poster":
          site.block.posterImageId = remap(site.block.posterImageId);
          break;
        case "slide": {
          const kept = remap(site.item.imageId);
          // `imageId` is required on a slide, so an unresolved one drops it.
          if (kept === undefined) dropped.add(site.item);
          else site.item.imageId = kept;
          break;
        }
      }
    }

    for (const page of content.pages) {
      page.blocks = page.blocks.filter((block) => {
        if (block.type === "montage") {
          const before = block.items.length;
          block.items = block.items.filter((item) => !dropped.has(item));
          const lost = before - block.items.length;
          for (let i = 0; i < lost; i += 1) clear("slide");
          if (lost > 0 && block.items.length === 0) {
            clear("montage");
            return false;
          }
        }
        if (block.type === "sponsor") {
          // The v1 inline fallback stored an image id here. Nothing resolves it
          // any more, and a foreign id must not survive, so it goes.
          delete block.logoId;
          if (block.sponsorId) {
            const outcome = sponsorById.get(block.sponsorId);
            if (outcome) block.sponsorId = outcome.id;
            else {
              delete block.sponsorId;
              clear("sponsor");
            }
          }
        }
        return true;
      });
    }

    let logoId: string | null = null;
    if (issue.logoId) {
      const outcome = logoById.get(issue.logoId);
      if (outcome) logoId = outcome.id;
      else clear("logo");
    }

    for (const [kind, count] of tally) cleared.push({ title, kind, count });
    issues.push({
      manifestId,
      id,
      title: issue.title,
      theme: issue.theme,
      content,
      footerMarkSize: clampSize(MARK_SIZE, issue.footerMarkSize),
      footerTextSize: clampSize(TEXT_SIZE, issue.footerTextSize),
      logoId,
    });
  }

  return {
    ok: true,
    bundle: {
      sponsors: sponsors.outcomes,
      logos: logos.outcomes,
      issues,
      images: [...needed.values()],
      cleared,
    },
  };
}

const MISMATCH = refuse(
  "manifest-mismatch",
  "This export’s file list doesn’t match what it says it contains.",
);

type LibraryMatch =
  | { ok: true; outcomes: LibraryOutcome[] }
  | { ok: false; refusal: Refusal };

// One match per bundled name: none creates, one reuses, more than one refuses.
// Ambiguity is only ever judged against names the bundle actually references —
// a pair of duplicates elsewhere in the archive is the owner's business.
function matchLibrary(
  bundled: { id: string; name: string; bundleImageId: string | null }[],
  destination: { id: string; name: string; imageId: string | null }[],
  newRowIds: Record<string, string>,
  newImageIds: Record<string, string>,
  kind: "sponsor" | "logo",
): LibraryMatch {
  const byName = new Map<string, typeof destination>();
  for (const row of destination) {
    const key = normaliseLibraryName(row.name);
    const list = byName.get(key);
    if (list) list.push(row);
    else byName.set(key, [row]);
  }

  const outcomes: LibraryOutcome[] = [];
  for (const row of bundled) {
    const matches = byName.get(normaliseLibraryName(row.name)) ?? [];
    if (matches.length > 1) {
      return {
        ok: false,
        refusal: refuse(
          "ambiguous-library-name",
          `This site has more than one ${kind} called “${row.name.trim()}”, so the import can’t tell which one to use. Rename or remove the duplicate, then try again.`,
        ),
      };
    }
    const match = matches[0];
    if (match) {
      outcomes.push({
        manifestId: row.id,
        name: match.name,
        action: "reuse",
        id: match.id,
        imageId: match.imageId,
        bundleImageId: null,
      });
      continue;
    }
    const id = newRowIds[row.id];
    if (!id) return { ok: false, refusal: MISMATCH };
    outcomes.push({
      manifestId: row.id,
      name: row.name.trim(),
      action: "create",
      id,
      imageId: row.bundleImageId
        ? (newImageIds[row.bundleImageId] ?? null)
        : null,
      bundleImageId: row.bundleImageId,
    });
  }
  return { ok: true, outcomes };
}
