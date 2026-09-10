"use client";

import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { AddStatus } from "./use-add-selection";

// The panel's command row: how much is selected (press to see the list),
// select everything on the page, clear, and the one Add that sends it all.
// The status line under it names the destination until there is news.
export function SelectionBar({
  count,
  listOpen,
  canSelectAll,
  adding,
  status,
  destination,
  onToggleList,
  onSelectAll,
  onClear,
  onAdd,
  onCancel,
}: {
  count: number;
  listOpen: boolean;
  canSelectAll: boolean;
  adding: boolean;
  status: AddStatus | null;
  destination: string;
  onToggleList: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const line = status?.text
    ? status.text
    : count
      ? `Adds ${destination}.`
      : "Select text or photos on the page, then press Add.";
  return (
    <div className="border-line flex-none border-b">
      <div
        data-add-bar
        className="flex flex-wrap items-center gap-2 px-3 py-2.5"
      >
        <button
          type="button"
          onClick={onToggleList}
          disabled={!count}
          aria-expanded={listOpen}
          aria-controls="pdf-import-selection"
          className={`flex h-10 items-center gap-1.5 rounded-lg px-2 font-sans text-sm font-semibold transition-[background-color,color] duration-150 ${
            count
              ? "text-ink hover:bg-accent-wash cursor-pointer"
              : "text-faint cursor-default"
          }`}
        >
          <Icon
            name="chevronDown"
            size={16}
            className={`transition-transform duration-150 ${listOpen ? "rotate-180" : ""}`}
          />
          {count ? `${count} selected` : "Nothing selected"}
        </button>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          disabled={!canSelectAll || adding}
          onClick={onSelectAll}
        >
          Select all on page
        </Button>
        {count > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={adding}
            onClick={onClear}
          >
            Clear
          </Button>
        )}
        {adding && (
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {/* Add keeps its place while working, so a double press lands on a
            busy button rather than on Cancel. */}
        <Button
          size="sm"
          icon="plus"
          iconPosition="left"
          disabled={!count}
          busy={adding}
          onClick={onAdd}
        >
          {adding ? "Adding…" : count > 1 ? `Add ${count}` : "Add"}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`px-5 pb-2.5 text-[13px] leading-snug ${
          status?.tone === "warn" ? "text-warn" : "text-faint"
        }`}
      >
        {line}
      </p>
    </div>
  );
}
