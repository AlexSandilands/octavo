"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/notification-actions";
import { relativeTime } from "@/features/discussion/relative-time";
import { bellLabel, type BellItem } from "./bell-items";
import { BellMenu, menuItems } from "./bell-menu";

// The library header's bell (issue #303): the unread count from the page's
// server render, and a menu of the newest replies to the member's comments.
// Choosing one marks it read and opens the thread on the reply; Mark all read
// refreshes the page's server render, which stays the one source of truth.
//
// A real menu, with MenuSelect's keyboard contract: it opens on click or
// ArrowDown onto its first item, arrows / Home / End move, Escape closes back
// to the bell, Tab and an outside press dismiss it.
export function NotificationBell({
  unread,
  items,
}: {
  unread: number;
  items: BellItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss when a press lands outside the bell and its menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // On open, the first item takes focus; from there the menu owns it.
  useEffect(() => {
    if (open) menuItems(menuRef.current)[0]?.focus();
  }, [open]);

  const toggle = () => {
    if (!open) {
      setNow(Date.now());
      setStatus("");
    }
    setOpen((v) => !v);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) bellRef.current?.focus();
  };

  const choose = (item: BellItem) => {
    setOpen(false);
    startTransition(async () => {
      // A failed mark still opens the reply; the bell catches up next visit.
      await markNotificationReadAction(item.id).catch(() => null);
      router.push(item.href);
    });
  };

  const markAll = () =>
    startTransition(async () => {
      const result = await markAllNotificationsReadAction().catch(() => null);
      setStatus(
        result?.ok
          ? "All notifications marked read."
          : "That didn’t go through. Please try again.",
      );
      if (result?.ok) router.refresh();
    });

  return (
    <div ref={rootRef} className="flex-none">
      <button
        ref={bellRef}
        type="button"
        aria-label={bellLabel(unread)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={pending || undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            toggle();
          }
        }}
        className="text-ink hover:bg-accent-wash hover:text-accent relative -m-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors"
      >
        <Icon name="bell" size={22} strokeWidth={1.7} />
        {unread > 0 && (
          <span
            aria-hidden
            className="bg-accent text-paper ring-paper absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-sans text-[11px] leading-none font-bold ring-2"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <span role="status" className="sr-only">
        {status}
      </span>
      {open && (
        <BellMenu
          ref={menuRef}
          items={items}
          unread={unread}
          when={(iso) => relativeTime(iso, now)}
          onChoose={choose}
          onMarkAll={markAll}
          onClose={close}
        />
      )}
    </div>
  );
}
