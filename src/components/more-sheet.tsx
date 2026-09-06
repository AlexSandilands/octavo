"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ADMIN_MORE } from "./app-nav";
import { DialogShell } from "./dialog-shell";
import { DialogHeader } from "./dialog-parts";
import { Icon } from "./icons";
import { TAB_CLASS, TabInner } from "./tab-inner";

// The admin tab bar's fourth tab on a phone: a bottom sheet with the rest of
// the admin list, the way back to the library and Sign out. Goes through
// DialogShell like every other modal, so it is a proper dialog for the
// keyboard and the screen reader.
export function MoreSheet({
  active,
  signOut,
}: {
  active: string | null;
  /** The sign-out control (a server form), rendered as the last row. */
  signOut: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const activeInMore = ADMIN_MORE.some((i) => i.key === active);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${TAB_CLASS} cursor-pointer`}
      >
        <TabInner icon="more" label="More" active={activeInMore} />
      </button>
      {open && (
        <DialogShell
          panelClassName="md:w-[380px]"
          onClose={() => setOpen(false)}
        >
          {(titleId) => (
            <div
              onClick={(e) => {
                // Close when a link is chosen; the navigation proceeds via Link.
                if ((e.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              <DialogHeader
                titleId={titleId}
                title="More"
                onClose={() => setOpen(false)}
              />
              <nav aria-label="More" className="flex flex-col gap-0.5 p-3 pt-4">
                {ADMIN_MORE.map((item) => (
                  <SheetRow
                    key={item.key}
                    href={item.href}
                    icon={item.icon}
                    active={item.key === active}
                  >
                    {item.label}
                  </SheetRow>
                ))}
                <SheetRow href="/" icon="library">
                  View library
                </SheetRow>
                {signOut}
              </nav>
            </div>
          )}
        </DialogShell>
      )}
    </>
  );
}

function SheetRow({
  href,
  icon,
  active = false,
  children,
}: {
  href: string;
  icon: Parameters<typeof Icon>[0]["name"];
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-14 items-center gap-3 rounded-field px-3 font-ui text-[17px] font-bold transition-colors ${
        active
          ? "bg-primary-soft text-primary"
          : "text-fg hover:bg-primary-wash hover:text-primary"
      }`}
    >
      <Icon name={icon} size={22} strokeWidth={1.9} />
      {children}
    </Link>
  );
}
