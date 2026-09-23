"use client";

import { useEffect, useState } from "react";
import {
  removalImpactAction,
  type RemovalImpactResult,
} from "@/app/admin/members/actions";

// The line a removal confirmation adds about the member's comments (issue
// #302): how many there are and what the removed-member setting will do with
// them. Fetched when the dialog opens and announced when it arrives. Inline,
// because the confirmation's body is a paragraph.
export function RemovalCommentsNote({
  ids,
  many,
}: {
  ids: string[];
  /** Bulk wording ("None of them…") rather than one member's. */
  many: boolean;
}) {
  const [impact, setImpact] = useState<RemovalImpactResult | null>(null);

  useEffect(() => {
    let live = true;
    removalImpactAction(ids)
      .then((result) => live && setImpact(result))
      .catch(() => live && setImpact({ ok: false }));
    return () => {
      live = false;
    };
    // The ids are fixed for the dialog's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span aria-live="polite" data-removal-comments>
      {" "}
      {sentence(impact, many)}
    </span>
  );
}

function sentence(impact: RemovalImpactResult | null, many: boolean) {
  if (!impact) return "Checking their comments…";
  if (!impact.ok) return "Their comments couldn’t be counted just now.";
  const n = impact.comments;
  if (n === 0) {
    return many
      ? "None of them has posted any comments."
      : "They haven’t posted any comments.";
  }
  const theirs = n === 1 ? "Their one comment" : `Their ${n} comments`;
  return impact.policy === "delete"
    ? `${theirs} will be deleted, as set under Magazine details.`
    : `${theirs} will stay, shown as “Former member”, as set under Magazine details.`;
}
