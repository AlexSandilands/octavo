"use client";

import { Icon } from "@/components/icons";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import { capitalise, pageName, type ReaderPages } from "./page-tags";

/** A row of the menu: "open:<id>" in the shortcut at the top, "page:<id>" in
 *  the issue's order. Both tag the same page; only the row chosen is ticked. */
export type TagChoice = `${"open" | "page"}:${string}`;

const NONE = "none";
/** The menu's first screen shows "No page" and the pages before this one, so
 *  open pages from here on are repeated at the top. */
const SHORTCUT_FROM = 6;

/** The page a choice tags, or null for none. */
export const choicePage = (choice: TagChoice | null) =>
  choice ? choice.slice(choice.indexOf(":") + 1) : null;

// The composer's page tag (issue #304): a compact menu beside "Posting as"
// listing every page — so a member can come back to one they read earlier —
// with the page(s) open now marked, and repeated at the top when they would
// otherwise be below the first screen, so tagging what is in front of you
// stays one choice away. "No page" until chosen.
export function PageTagPicker({
  pages,
  choice,
  onChange,
}: {
  pages: ReaderPages;
  choice: TagChoice | null;
  onChange: (choice: TagChoice | null) => void;
}) {
  const chosen = choicePage(choice);
  const name = chosen ? pageName(pages, chosen) : null;
  const row = (kind: "open" | "page", id: string): MenuSelectItem<string> => ({
    key: `${kind}:${id}`,
    value: `${kind}:${id}`,
    content: <PageRow pages={pages} id={id} />,
  });
  const items: MenuSelectItem<string>[] = [
    { key: NONE, value: NONE, content: <span data-page-label>No page</span> },
    ...(pages.open.some((id) => (pages.numbers.get(id) ?? 0) >= SHORTCUT_FROM)
      ? pages.open.map((id) => row("open", id))
      : []),
    ...[...pages.numbers.keys()].map((id) => row("page", id)),
  ];
  return (
    <div className="min-w-0 flex-none">
      <MenuSelect
        label=""
        current={name ? capitalise(name) : "Tag a page"}
        triggerLabel={name ? `Tagged to ${name}` : "Tag a page"}
        ariaLabel="Tag a page"
        size="compact"
        side="top"
        className="max-w-[9.5rem]"
        menuClassName="scrollbar-soft w-[min(20rem,calc(100vw-3rem))] max-h-[min(22rem,55dvh)] overflow-y-auto [--scrollbar-surface:white]"
        icon={<Icon name="doc" size={15} className="text-faint flex-none" />}
        value={choice ?? NONE}
        onSelect={(next) =>
          onChange(next === NONE ? null : (next as TagChoice))
        }
        items={items}
      />
    </div>
  );
}

// "Page 12  Opening the Season  open now": the number, the page's first
// heading to find it by, and a mark on the page(s) the member has open.
export function PageRow({ pages, id }: { pages: ReaderPages; id: string }) {
  const hint = pages.hints.get(id);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
      <span data-page-label className="flex-none">
        {capitalise(pageName(pages, id) ?? "")}
      </span>
      {hint && (
        <span
          data-page-hint
          className="text-faint min-w-0 truncate text-[13px] font-normal"
        >
          {hint}
        </span>
      )}
      {pages.open.includes(id) && (
        <span
          data-open-now
          className="bg-tint text-accent ml-auto flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold"
        >
          open now
        </span>
      )}
    </span>
  );
}
