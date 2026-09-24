"use client";

import { useRef } from "react";
import { Icon } from "@/components/icons";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import { IconButton } from "@/components/ui";
import { PageRow } from "./page-tag-picker";
import { capitalise, pageName, type ReaderPages } from "./page-tags";
import {
  SEARCH_MAX,
  type ThreadShow,
  type ThreadSort,
  type ThreadView,
} from "./thread-view";

const SORTS: { value: ThreadSort; label: string }[] = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "replies", label: "Most replies" },
];

/** How many of the view's settings are off their defaults. */
export const changedCount = (view: ThreadView) =>
  Number(view.show !== "all") +
  Number(view.sort !== "oldest") +
  Number(view.query.trim() !== "");

// The funnel in the thread's header: opens and closes the panel below it, and
// carries the number of settings changed, so a narrowed list is never a
// surprise.
export function FilterToggle({
  open,
  onToggle,
  changed,
  controls,
  ref,
}: {
  open: boolean;
  onToggle: () => void;
  changed: number;
  controls: string;
  ref: React.Ref<HTMLButtonElement>;
}) {
  return (
    <span className="relative inline-flex">
      <IconButton
        ref={ref}
        icon="filter"
        label={
          changed > 0
            ? `Filter and sort comments, ${changed} changed`
            : "Filter and sort comments"
        }
        title="Filter and sort"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className={`h-11 w-11 ${open ? "bg-tint text-accent!" : ""}`}
      />
      {changed > 0 && (
        <span
          aria-hidden
          data-filter-badge
          className="bg-accent text-paper pointer-events-none absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-sans text-[11px] font-semibold"
        >
          {changed}
        </span>
      )}
    </span>
  );
}

// What sits between the header and the list: the panel (while open) and, while
// the list is narrowed, a strip saying what it holds with its way out. Pinned
// in the drawer; in the phone's sheet it scrolls with the list instead, so with
// the keyboard up the short sheet spends its height on the box and the list.
export function ThreadFilters({
  id,
  open,
  inList,
  view,
  onChange,
  pages,
  summary,
  onShowAll,
}: {
  id: string;
  open: boolean;
  inList: boolean;
  view: ThreadView;
  onChange: (view: ThreadView) => void;
  pages: ReaderPages;
  /** What the narrowed list holds; "" when nothing narrows it, null while
   *  the list for it loads (the list says so; this only shows it). */
  summary: string | null;
  onShowAll: () => void;
}) {
  const status = useRef<HTMLParagraphElement>(null);
  const narrowing = view.show !== "all" || view.query.trim() !== "";
  const box = inList
    ? "border-line -mt-1 mb-4 border-b pb-4"
    : "border-line flex-none border-b px-5 py-3";
  return (
    <div className={open || narrowing ? box : inList ? "" : "flex-none"}>
      <div id={id} hidden={!open}>
        <FilterPanel
          view={view}
          onChange={onChange}
          pages={pages}
          inList={inList}
          // On a phone, Enter puts the keyboard away onto what was found.
          onEnter={inList ? () => status.current?.focus() : undefined}
        />
      </div>
      <div
        className={
          narrowing
            ? `bg-tint flex min-h-11 items-center justify-between gap-3 rounded-lg py-1 pr-1 pl-3.5 ${open ? "mt-3" : ""}`
            : ""
        }
      >
        <p
          ref={status}
          role="status"
          tabIndex={-1}
          data-thread-count
          className="text-ink focus-visible:outline-accent min-w-0 rounded-sm font-sans text-[14px] outline-none focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {summary ?? <span aria-hidden>Loading…</span>}
        </p>
        {narrowing && (
          <button
            type="button"
            onClick={onShowAll}
            className="text-accent relative inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-md px-2.5 font-sans text-[14px] font-semibold transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-white/70"
          >
            Show all
            <Icon name="close" size={14} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

// The panel: a search over the words and names, which comments to show —
// every one, the page(s) open now, the member's own, or any page of the issue
// — and the order. Changes apply as they are made.
function FilterPanel({
  view,
  onChange,
  pages,
  inList,
  onEnter,
}: {
  view: ThreadView;
  onChange: (view: ThreadView) => void;
  pages: ReaderPages;
  inList: boolean;
  onEnter?: () => void;
}) {
  // In the list, an open menu is scrolled whole into view rather than clipped.
  const reveal = inList
    ? (menu: HTMLDivElement) => menu.scrollIntoView({ block: "nearest" })
    : undefined;
  const input = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ThreadView>) => onChange({ ...view, ...patch });
  const clear = () => {
    set({ query: "" });
    input.current?.focus();
  };
  const openLabel = pages.open.length > 1 ? "These pages" : "This page";
  const text = (label: string) => <span data-page-label>{label}</span>;
  const shows: MenuSelectItem<ThreadShow>[] = [
    { key: "all", value: "all", content: text("All comments") },
    ...(pages.open.length > 0
      ? [{ key: "open", value: "open" as const, content: text(openLabel) }]
      : []),
    { key: "mine", value: "mine", content: text("My comments") },
    ...[...pages.numbers.keys()].map((pageId) => ({
      key: `page:${pageId}`,
      value: `page:${pageId}` as const,
      content: <PageRow pages={pages} id={pageId} />,
    })),
  ];
  const current =
    view.show === "all"
      ? "All"
      : view.show === "open"
        ? openLabel
        : view.show === "mine"
          ? "Mine"
          : capitalise(pageName(pages, view.show.slice(5)) ?? "Page removed");
  return (
    <div role="group" aria-label="Filter and sort" className="grid gap-3">
      {/* Escape clears a search first, from the box or its clear button; a
          second one closes the discussion. */}
      <div
        className="boxed-field border-line text-faint2 flex h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white pr-1 pl-3.5"
        data-owns-escape={view.query ? "" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape" && view.query) {
            e.preventDefault();
            clear();
          }
        }}
      >
        <Icon name="search" size={18} />
        <input
          ref={input}
          type="search"
          enterKeyHint="search"
          value={view.query}
          onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter && view.query.trim()) onEnter();
          }}
          maxLength={SEARCH_MAX}
          placeholder="Search words or names"
          aria-label="Search the comments by their words or names"
          className="text-ink h-full min-w-0 flex-1 border-none bg-transparent font-sans text-[16px] [&::-webkit-search-cancel-button]:hidden"
        />
        {view.query && (
          // 36px inside the 44px box, with a 44px hit area.
          <IconButton
            icon="close"
            label="Clear the search"
            size={18}
            onClick={clear}
            className="relative m-0! h-9 w-9 before:absolute before:-inset-1 before:content-['']"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <MenuSelect
          label="Show"
          current={current}
          ariaLabel="Show"
          size="md"
          className="max-w-[13rem]"
          menuClassName={`scrollbar-soft w-[min(20rem,calc(100vw-3rem))] overflow-y-auto [--scrollbar-surface:white] ${inList ? "max-h-[min(22rem,40dvh)]" : "max-h-[min(22rem,50dvh)]"}`}
          onOpen={reveal}
          value={view.show}
          onSelect={(show) => set({ show })}
          items={shows}
        />
        <MenuSelect
          label="Sort"
          current={SORTS.find((s) => s.value === view.sort)!.label}
          ariaLabel="Sort"
          size="md"
          onOpen={reveal}
          value={view.sort}
          onSelect={(sort) => set({ sort })}
          items={SORTS.map((s) => ({
            key: s.value,
            value: s.value,
            content: text(s.label),
          }))}
        />
      </div>
    </div>
  );
}
