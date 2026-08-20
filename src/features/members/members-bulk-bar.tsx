"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SelectCheckbox } from "@/components/select-checkbox";
import { MEMBERS_SELECTION_MAX } from "./selection-limit";
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
  matching,
  searching,
  filtering,
  paged,
  selectedIds,
  hiddenSelectedCount,
  allShownSelected,
  someShownSelected,
  onToggleAllShown,
  onSelectAllMatching,
  onClear,
}: {
  /** Rows on the served page — what the master checkbox acts on. */
  shownCount: number;
  /** Every member the search + filter matches, across all pages — what the
   * "Select all N matching" reach-past-the-page action acts on. */
  matching: number;
  /** Whether a search is narrowing the list (changes the wording only). */
  searching: boolean;
  /** Whether a status filter is narrowing the list (wording only). */
  filtering: boolean;
  /** Whether the list spans more than one page (changes the wording only). */
  paged: boolean;
  selectedIds: string[];
  /** Selected rows the current page/search isn't showing, kept in the count
   * so it stays honest. */
  hiddenSelectedCount: number;
  allShownSelected: boolean;
  someShownSelected: boolean;
  onToggleAllShown: (next: boolean) => void;
  /** Adds every matching id to the selection; false means it didn't land. */
  onSelectAllMatching: () => Promise<boolean>;
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [selectingAll, startSelectingAll] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectionNote, setSelectionNote] = useState<string | null>(null);
  const [awaitingSelection, setAwaitingSelection] = useState(false);

  const count = selectedIds.length;
  const active = count > 0;

  // A selection is bounded by what one bulk action can carry, so a club big
  // enough to exceed it gets told rather than handed a selection that would
  // come back as "please try again" (#125). Two places say it: the reach-past-
  // the-page button promises only what it can deliver, and the note below
  // stands for as long as the selection sits on the bound.
  const overCap = matching > MEMBERS_SELECTION_MAX;
  const atCap = count >= MEMBERS_SELECTION_MAX;

  const run = (fn: () => Promise<Result | null>) => {
    setError(null);
    setResult(null);
    setSelectionNote(null);
    startTransition(async () => {
      const next = await fn();
      if (next) {
        setResult(next);
      } else setError("That didn’t go through. Please try again.");
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

  // The checkbox's "select all" is honestly scoped to what's on screen and
  // says so once the list is narrowed or paged; reaching past the page is its
  // own labelled act ("Select all N matching") rather than a silent widening
  // of the checkbox. A selection's unseen remainder is attributed precisely
  // when one cause holds: with a search/filter on a single page every match
  // is visible, so hidden rows can only be non-matches; un-narrowed, they can
  // only be on other pages. With paging in play too a hidden row could be
  // either, so the wording goes neutral.
  const narrowed = searching || filtering;

  // Fetches ids, so it reports both outcomes on the shared line; the
  // checkbox's page-scoped select-all stays instant and local.
  const selectAllMatching = () => {
    setError(null);
    setResult(null);
    setSelectionNote(null);
    startSelectingAll(async () => {
      const ok = await onSelectAllMatching();
      if (ok) setAwaitingSelection(true);
      else setError("That didn’t go through. Please try again.");
    });
  };

  // Success was otherwise silent (#132): the button label flips back to what
  // it was and the new count sits in a checkbox label, neither of which a
  // screen reader announces — so the admin about to press "Remove selected"
  // had no way to hear that the selection had landed. The count is the
  // table's state, not ours, so it can only be read once the transition's
  // render has been through here; the sentence is then written once and left
  // alone, because a line rebuilt from the running count would announce again
  // on every tick of every row checkbox.
  useEffect(() => {
    if (!awaitingSelection) return;
    setAwaitingSelection(false);
    setSelectionNote(
      // Capped, this echoes the button that was just pressed, so it and the
      // cap note above say the same thing rather than two different ones.
      atCap && overCap
        ? `First ${MEMBERS_SELECTION_MAX} of ${matching}${narrowed ? " matching" : ""} selected.`
        : `${plural(count, "member", "members")} selected.`,
    );
  }, [awaitingSelection, atCap, overCap, matching, narrowed, count]);

  const narrower =
    searching && filtering
      ? "these filters"
      : searching
        ? "this search"
        : "this filter";
  const scope = `${narrowed ? " matching" : ""}${paged ? " on this page" : ""}`;
  const hiddenNote =
    narrowed && paged
      ? "not shown here"
      : narrowed
        ? `hidden by ${narrower}`
        : "on other pages";

  const countText = (
    <>
      <span className={active ? "text-ink font-semibold" : undefined}>
        {active ? `${count} selected` : `Select all ${shownCount}${scope}`}
      </span>
      {hiddenSelectedCount > 0 && (
        <span className="text-faint">
          {" "}
          ({hiddenSelectedCount} {hiddenNote})
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
          label={`Select all ${shownCount} members${narrowed ? ` matching ${narrower}` : ""}${paged ? " on this page" : ""}`}
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

      {/* The reach-past-the-page action, present whenever the matches don't
          all fit on the served page. It also puts the total match count on
          screen, which nothing else does. */}
      {shownCount > 0 && matching > shownCount && (
        <button
          type="button"
          onClick={selectAllMatching}
          disabled={pending || selectingAll}
          className="text-faint hover:text-accent cursor-pointer rounded px-2 py-2 font-sans text-[14px] font-medium underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
        >
          {selectingAll
            ? "Selecting…"
            : overCap
              ? `Select first ${MEMBERS_SELECTION_MAX} of ${matching}${narrowed ? " matching" : ""}`
              : `Select all ${matching}${narrowed ? " matching" : " members"}`}
        </button>
      )}

      {active && (
        <>
          <button
            type="button"
            onClick={() => {
              setSelectionNote(null);
              onClear();
            }}
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

      {/* Why the selection stopped where it did. Mounted whatever the count,
          like the result line below and for the same reason — a live region
          that arrives together with its text is announced unreliably, and the
          admin who just pressed "Select first 10000 of 24318" is exactly who
          needs to hear this. Empty, it has no height. */}
      <p
        aria-live="polite"
        className={`text-faint basis-full px-1 font-sans text-[14px] ${
          atCap ? "pb-2" : ""
        }`}
      >
        {atCap &&
          `Selections stop at ${MEMBERS_SELECTION_MAX} members. Run this action, then select any that are left.`}
      </p>

      {/* Always mounted, so a screen reader announces the outcome when it
          arrives — a live region added at the same moment as its text is
          announced unreliably. Empty, it has no height. A landed select-all
          goes here too, but for screen readers only: its count is already on
          screen in the checkbox label beside it, in ink. */}
      <p
        aria-live="polite"
        className={
          selectionNote
            ? "sr-only"
            : `basis-full px-1 font-sans text-[14px] ${
                error ? "text-warn pb-2" : result ? "text-muted pb-2" : ""
              }`
        }
      >
        {error}
        {!error && result && (
          <>
            Done — <strong className="text-ink">{result.head}</strong>
            {result.tail}
          </>
        )}
        {selectionNote}
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
