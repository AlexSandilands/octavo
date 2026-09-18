"use client";

import Link from "next/link";
import type { ImportPlan, LibraryPlan } from "@/lib/issue-transfer/plan";
import { CLEARED_LABELS, type ImportResult } from "@/lib/issue-transfer/result";

// The two panels either side of the upload: what is about to happen, and what
// did. Plain words — the reader has never heard of a manifest.

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function ImportReview({ plan }: { plan: ImportPlan }) {
  return (
    <div className="mt-5">
      <ul className="border-line divide-line divide-y border-y">
        {plan.issues.map((issue) => (
          <li key={issue.id} className="py-3">
            <div className="text-ink font-sans text-[15px] font-semibold">
              {issue.title || "Untitled"}
            </div>
            <div className="text-muted mt-0.5 font-sans text-[14px]">
              Arrives as a new draft.
              {issue.titleExists && (
                <span className="text-warn">
                  {" "}
                  An issue with this title already exists; this adds a second
                  copy.
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <LibraryNote label="Sponsors" entries={plan.sponsors} />
      <LibraryNote label="Logos" entries={plan.logos} />
    </div>
  );
}

function LibraryNote({
  label,
  entries,
}: {
  label: string;
  entries: LibraryPlan[];
}) {
  if (entries.length === 0) return null;
  const reused = entries.filter((e) => e.outcome === "reuse");
  const created = entries.filter((e) => e.outcome === "create");
  const ambiguous = entries.filter((e) => e.outcome === "ambiguous");
  return (
    <p className="text-muted mt-3 font-sans text-[14px] leading-relaxed">
      <span className="text-ink font-semibold">{label}: </span>
      {reused.length > 0 && `${reused.length} already here (kept as they are)`}
      {reused.length > 0 && created.length > 0 && ", "}
      {created.length > 0 && `${created.length} will be added`}
      {reused.length + created.length === 0 && ambiguous.length === 0 && "none"}
      {"."}
      {ambiguous.length > 0 && (
        <span className="text-warn block">
          This site has more than one called{" "}
          {ambiguous.map((e) => `“${e.name}”`).join(", ")}. Rename or remove the
          duplicate before importing.
        </span>
      )}
    </p>
  );
}

export function ImportOutcome({ result }: { result: ImportResult }) {
  const added = (entries: { action: string }[]) =>
    entries.filter((e) => e.action === "create").length;
  return (
    <div className="mt-5">
      <p className="text-muted font-sans text-[15px]">
        {count(result.issues.length, "draft", "drafts")} added. Open one to
        finish it and publish when you are ready.
      </p>
      <ul className="border-line divide-line mt-4 divide-y border-y">
        {result.issues.map((issue) => (
          <li key={issue.id} className="py-3">
            <Link
              href={`/admin/issues/${issue.id}/edit`}
              className="text-accent font-sans text-[15px] font-semibold underline underline-offset-4"
            >
              {issue.title || "Untitled"}
            </Link>
          </li>
        ))}
      </ul>
      {result.sponsors.length + result.logos.length > 0 && (
        <p className="text-muted mt-3 font-sans text-[14px] leading-relaxed">
          {result.sponsors.length > 0 && (
            <>
              Sponsors: {added(result.sponsors)} added,{" "}
              {result.sponsors.length - added(result.sponsors)} already
              here.{" "}
            </>
          )}
          {result.logos.length > 0 && (
            <>
              Logos: {added(result.logos)} added,{" "}
              {result.logos.length - added(result.logos)} already here.
            </>
          )}
        </p>
      )}
      {result.cleared.length > 0 && (
        <div className="text-warn mt-3 font-sans text-[14px] leading-relaxed">
          Some things this export referred to aren’t on this site, so they were
          left empty:
          <ul className="mt-1 list-disc pl-5">
            {result.cleared.map((entry, index) => (
              <li key={`${entry.title}-${entry.kind}-${index}`}>
                {entry.title} —{" "}
                {count(
                  entry.count,
                  CLEARED_LABELS[entry.kind],
                  `${CLEARED_LABELS[entry.kind]}s`,
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One sentence a screen reader can announce when the import lands. */
export function outcomeAnnouncement(result: ImportResult): string {
  const created = result.sponsors
    .concat(result.logos)
    .filter((e) => e.action === "create").length;
  return `Import finished. ${count(result.issues.length, "draft", "drafts")} added${
    created > 0
      ? `, ${count(created, "library entry", "library entries")} created`
      : ""
  }.`;
}
