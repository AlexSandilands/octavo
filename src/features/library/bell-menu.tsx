"use client";

import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { fullDate } from "@/features/discussion/relative-time";
import type { BellItem } from "./bell-items";

/** The menu's focusable items, in order. */
export function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu ? [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")] : [];
}

// The bell's menu (issue #303): the newest notifications, unread ones marked,
// and Mark all read at the foot. It hangs from the header's nav rather than
// the bell, so on a phone it can span the width without leaving the screen.
export function BellMenu({
  ref,
  items,
  unread,
  when,
  onChoose,
  onMarkAll,
  onClose,
}: {
  ref: RefObject<HTMLDivElement | null>;
  items: BellItem[];
  unread: number;
  when: (iso: string) => string;
  onChoose: (item: BellItem) => void;
  onMarkAll: () => void;
  onClose: (returnFocus: boolean) => void;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    const list = menuItems(ref.current);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(list.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === "Tab") onClose(false);
    else if (e.key === " " && at >= 0) {
      // Space selects a menu item, the link ones included.
      e.preventDefault();
      list[at]?.click();
    }
  };

  const follow = (e: MouseEvent, item: BellItem) => {
    // A modified click (a new tab) keeps the browser's own behaviour.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onChoose(item);
  };

  const row =
    "flex w-full min-h-11 cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left font-sans transition-colors hover:bg-accent-wash focus-visible:bg-accent-wash focus-visible:-outline-offset-2";
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Notifications"
      onKeyDown={onKeyDown}
      className="border-hair absolute top-full right-0 z-30 mt-2 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col rounded-lg border bg-white shadow-[0_8px_24px_rgba(40,36,28,0.18)]"
    >
      {items.length === 0 ? (
        <div
          role="menuitem"
          aria-disabled="true"
          tabIndex={-1}
          className="text-muted p-3.5 font-sans text-[14px] leading-relaxed"
        >
          No replies yet. When someone replies to one of your comments, it shows
          up here.
        </div>
      ) : (
        <div className="scrollbar-soft max-h-[min(28rem,calc(100dvh-10rem))] overflow-y-auto p-1 [--scrollbar-surface:white] [scrollbar-gutter:stable]">
          {items.map((item) => (
            <a
              key={item.id}
              role="menuitem"
              tabIndex={-1}
              href={item.href}
              // The visible words first (as voice control says them), then
              // when, then whether it's new.
              aria-label={`${item.text}, ${when(item.createdAt)}${item.read ? "" : ", unread"}`}
              onClick={(e) => follow(e, item)}
              className={row}
            >
              <span
                aria-hidden
                className={`mt-[7px] h-2 w-2 flex-none rounded-full ${item.read ? "" : "bg-accent"}`}
              />
              <span className="min-w-0">
                <span
                  className={`block text-[15px] leading-snug ${item.read ? "text-muted" : "text-ink font-semibold"}`}
                >
                  {item.text}
                </span>
                <time
                  dateTime={item.createdAt}
                  title={fullDate(item.createdAt)}
                  className="text-faint mt-0.5 block text-[13px]"
                >
                  {when(item.createdAt)}
                </time>
              </span>
            </a>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="border-line-soft border-t p-1">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={unread === 0}
            onClick={() => unread > 0 && onMarkAll()}
            className={`${row} text-accent items-center justify-center text-[14px] font-semibold aria-disabled:text-faint aria-disabled:cursor-default aria-disabled:hover:bg-transparent`}
          >
            Mark all read
          </button>
        </div>
      )}
    </div>
  );
}
