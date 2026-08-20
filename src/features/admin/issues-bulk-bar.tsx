"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SelectCheckbox } from "@/components/select-checkbox";
import { ISSUES_SELECTION_MAX } from "./selection-limit";
import { deleteIssuesAction } from "@/app/admin/actions";

// The strip between the search box and the rows: the select-all control, the
// running count, and — once something is selected — the one bulk action there
// is. It sits above the rows rather than in the (desktop-only) header strip so
// the whole mechanism exists on a phone too. Shaped after the members bulk bar;
// the difference is the confirmation, which has to name the published subset,
// because those are the issues members can read right now.

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function IssuesBulkBar({
  shownCount,
  matching,
  searching,
  filtering,
  paged,
  selectedIds,
  publishedCount,
  hiddenSelectedCount,
  allShownSelected,
  someShownSelected,
  onToggleAllShown,
  onSelectAllMatching,
  onClear,
}: {
  /** Rows on the served page — what the master checkbox acts on. */
  shownCount: number;
  /** Every issue the search + filters match, across all pages — what the
   * "Select all N matching" reach-past-the-page action acts on. */
  matching: number;
  /** Whether a search is narrowing the list (changes the wording only). */
  searching: boolean;
  /** Whether a status or year filter is narrowing it (wording only). */
  filtering: boolean;
  /** Whether the list spans more than one page (wording only). */
  paged: boolean;
  selectedIds: string[];
  /** How many of the selection members can currently read. */
  publishedCount: number;
  /** Selected rows the current page/search isn't showing, kept in the count
   * so it stays honest. */
  hiddenSelectedCount: number;
  allShownSelected: boolean;
  someShownSelected: boolean;
  onToggleAllShown: (next: boolean) => void;
  /** Adds every matching issue to the selection; false means it didn't land. */
  onSelectAllMatching: () => Promise<boolean>;
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [selectingAll, startSelectingAll] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectionNote, setSelectionNote] = useState<string | null>(null);
  const [awaitingSelection, setAwaitingSelection] = useState(false);

  const count = selectedIds.length;
  const active = count > 0;

  // A selection is bounded by what one bulk action can carry, so an archive big
  // enough to exceed it gets told rather than handed a selection that would come
  // back as "please try again". Two places say it: the reach-past-the-page
  // button promises only what it can deliver, and the note below stands for as
  // long as the selection sits on the bound.
  const overCap = matching > ISSUES_SELECTION_MAX;
  const atCap = count >= ISSUES_SELECTION_MAX;
  const narrowed = searching || filtering;

  const remove = () => {
    setError(null);
    setResult(null);
    setSelectionNote(null);
    startTransition(async () => {
      const res = await deleteIssuesAction(selectedIds);
      if (!res.ok) {
        setError("That didn’t go through. Please try again.");
        return;
      }
      // A deletion consumes the selection: those rows no longer exist.
      onClear();
      setResult(
        `${plural(res.deleted, "issue", "issues")} deleted` +
          (res.missing > 0 ? `, ${res.missing} already gone.` : "."),
      );
    });
  };

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

  // Success is otherwise silent: the button label flips back to what it was and
  // the new count sits in a checkbox label, neither of which a screen reader
  // announces. The count is the table's state, not ours, so it can only be read
  // in the render that carries the landed selection (adjusted here, during
  // render); the sentence is then written once and left alone, because a line
  // rebuilt from the running count would announce again on every tick of every
  // row checkbox.
  if (awaitingSelection) {
    setAwaitingSelection(false);
    setSelectionNote(
      atCap && overCap
        ? `First ${ISSUES_SELECTION_MAX} of ${matching}${narrowed ? " matching" : ""} selected.`
        : `${plural(count, "issue", "issues")} selected.`,
    );
  }

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
          live and the action still applies to it. */}
      {shownCount > 0 ? (
        <SelectCheckbox
          checked={allShownSelected}
          indeterminate={someShownSelected}
          onChange={onToggleAllShown}
          label={`Select all ${shownCount} issues${narrowed ? ` matching ${narrower}` : ""}${paged ? " on this page" : ""}`}
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

      {/* The reach-past-the-page action, present whenever the matches don't all
          fit on the served page. It also puts the total match count on screen,
          which nothing else does. */}
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
              ? `Select first ${ISSUES_SELECTION_MAX} of ${matching}${narrowed ? " matching" : ""}`
              : `Select all ${matching}${narrowed ? " matching" : " issues"}`}
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
              variant="danger"
              icon="trash"
              iconPosition="left"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Delete selected
            </Button>
          </div>
        </>
      )}

      {/* Why the selection stopped where it did. Mounted whatever the count,
          like the result line below and for the same reason — a live region
          that arrives together with its text is announced unreliably. Empty, it
          has no height. */}
      <p
        aria-live="polite"
        className={`text-faint basis-full px-1 font-sans text-[14px] ${
          atCap ? "pb-2" : ""
        }`}
      >
        {atCap &&
          `Selections stop at ${ISSUES_SELECTION_MAX} issues. Run this action, then select any that are left.`}
      </p>

      {/* Always mounted, so a screen reader announces the outcome when it
          arrives. A landed select-all goes here too, but for screen readers
          only: its count is already on screen in the checkbox label beside it,
          in ink. */}
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
            Done — <strong className="text-ink">{result}</strong>
          </>
        )}
        {selectionNote}
      </p>

      {confirming && (
        <ConfirmDialog
          title={`Delete ${plural(count, "issue", "issues")}?`}
          body={
            <>
              This permanently removes{" "}
              {count === 1 ? "the issue and its pages" : "them and their pages"}
              , and can’t be undone.
              {publishedCount > 0 && (
                <span className="text-warn mt-2.5 block font-semibold">
                  {publishedCount === count
                    ? count === 1
                      ? "This issue is published"
                      : "All of them are published"
                    : `${publishedCount} of them ${publishedCount === 1 ? "is" : "are"} published`}{" "}
                  — members lose access immediately.
                </span>
              )}
            </>
          }
          confirmLabel={`Delete ${count}`}
          confirmIcon="trash"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            remove();
          }}
        />
      )}
    </div>
  );
}
