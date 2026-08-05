"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SelectCheckbox } from "./select-checkbox";
import {
  removeMembersAction,
  setSubscribedManyAction,
  type RemoveMembersResult,
  type SetSubscribedManyResult,
} from "@/app/admin/members/actions";

// The strip between the search box and the table: the select-all control, the
// running count, and — once something is selected — the actions that apply to
// it. It sits above the rows rather than in the (desktop-only) header strip so
// the whole mechanism exists on a phone too. Admin promotion is deliberately
// absent: granting or revoking admin stays a one-at-a-time act.
//
// Results are reported in the import dialog's voice — the headline number in
// ink, then what was skipped and why — because the server refuses protected
// rows individually rather than failing the whole batch.
type Result = { head: string; tail: string };

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function removalResult(r: Extract<RemoveMembersResult, { ok: true }>): Result {
  const skipped: string[] = [];
  if (r.skippedSelf > 0) skipped.push("1 skipped (that’s you)");
  if (r.skippedAdmins > 0) {
    skipped.push(
      `${plural(r.skippedAdmins, "admin", "admins")} skipped (the club must keep one)`,
    );
  }
  if (r.missing > 0) skipped.push(`${r.missing} already gone`);
  return {
    head: `${plural(r.removed, "member", "members")} removed`,
    tail: skipped.length > 0 ? `, ${skipped.join(", ")}.` : ".",
  };
}

function subscribeResult(
  r: Extract<SetSubscribedManyResult, { ok: true }>,
  subscribed: boolean,
): Result {
  const verb = subscribed ? "subscribed" : "unsubscribed";
  return {
    head: `${plural(r.changed, "member", "members")} ${verb}`,
    tail:
      r.unchanged > 0
        ? `, ${r.unchanged} already ${subscribed ? "were" : "weren’t"}.`
        : ".",
  };
}

export function MembersBulkBar({
  shownCount,
  filtered,
  selectedIds,
  hiddenSelectedCount,
  allShownSelected,
  someShownSelected,
  onToggleAllShown,
  onClear,
}: {
  /** Rows matching the current search — what the master checkbox acts on. */
  shownCount: number;
  /** Whether a search is narrowing the list (changes the wording only). */
  filtered: boolean;
  selectedIds: string[];
  /** Selected rows the current search is hiding, so the count stays honest. */
  hiddenSelectedCount: number;
  allShownSelected: boolean;
  someShownSelected: boolean;
  onToggleAllShown: (next: boolean) => void;
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const count = selectedIds.length;
  const active = count > 0;

  const run = (fn: () => Promise<Result | null>) => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const next = await fn();
      if (next) setResult(next);
      else setError("That didn’t go through. Please try again.");
    });
  };

  const remove = () =>
    run(async () => {
      const res = await removeMembersAction(selectedIds);
      if (!res.ok) return null;
      onClear();
      return removalResult(res);
    });

  // The selection survives a subscribe so the admin can correct a slip without
  // rebuilding it; a removal consumes it, because those rows no longer exist.
  const setSubscribed = (subscribed: boolean) =>
    run(async () => {
      const res = await setSubscribedManyAction(selectedIds, subscribed);
      return res.ok ? subscribeResult(res, subscribed) : null;
    });

  const countText = (
    <>
      <span className={active ? "text-ink font-semibold" : undefined}>
        {active
          ? `${count} selected`
          : `Select all ${shownCount}${filtered ? " matching" : ""}`}
      </span>
      {hiddenSelectedCount > 0 && (
        <span className="text-faint">
          {" "}
          ({hiddenSelectedCount} hidden by this search)
        </span>
      )}
    </>
  );

  return (
    <div
      className={`mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border-[1.5px] px-2 ${
        active ? "border-line bg-accent-wash" : "border-transparent"
      }`}
    >
      {/* A search matching nothing has nothing to select all of, so the box
          goes; the count stays, because the selection it describes is still
          live and the actions still apply to it. */}
      {shownCount > 0 ? (
        <SelectCheckbox
          checked={allShownSelected}
          indeterminate={someShownSelected}
          onChange={onToggleAllShown}
          label={`Select all ${shownCount} members${filtered ? " matching this search" : ""}`}
        >
          {countText}
        </SelectCheckbox>
      ) : (
        active && (
          <span className="text-muted py-2.5 pl-2 font-sans text-[14px]">
            {countText}
          </span>
        )
      )}

      {active && (
        <>
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="text-faint hover:text-accent cursor-pointer rounded px-2 py-2 font-sans text-[14px] font-medium underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
          >
            Clear
          </button>

          <div className="ml-auto flex flex-wrap gap-2 py-1.5">
            <Button
              size="sm"
              variant="secondary"
              icon="check"
              iconPosition="left"
              disabled={pending}
              onClick={() => setSubscribed(true)}
            >
              Subscribe
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="minus"
              iconPosition="left"
              disabled={pending}
              onClick={() => setSubscribed(false)}
            >
              Unsubscribe
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon="trash"
              iconPosition="left"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Remove selected
            </Button>
          </div>
        </>
      )}

      {/* Always mounted, so a screen reader announces the outcome when it
          arrives — a live region added at the same moment as its text is
          announced unreliably. Empty, it has no height. */}
      <p
        aria-live="polite"
        className={`basis-full px-1 font-sans text-[14px] ${
          error ? "text-warn pb-2" : result ? "text-muted pb-2" : ""
        }`}
      >
        {error}
        {!error && result && (
          <>
            Done — <strong className="text-ink">{result.head}</strong>
            {result.tail}
          </>
        )}
      </p>

      {confirming && (
        <ConfirmDialog
          title={`Remove ${plural(count, "member", "members")}?`}
          body="They lose access immediately and are signed out. This can’t be undone."
          confirmLabel={`Remove ${count}`}
          confirmIcon="trash"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            remove();
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
