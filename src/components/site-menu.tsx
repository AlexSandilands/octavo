"use client";

import { useState, type ReactNode } from "react";
import { DialogShell } from "./dialog-shell";
import { IconButton, Wordmark } from "./ui";

// The phone-width site menu (SiteBar): one labelled button that opens the
// navigation as a full-screen sheet on the dark ground. The links and the
// sign-out form arrive server-rendered as children; this owns only the
// open/close, and the shell owns the focus trap, Escape and the inert page
// behind. A link press navigates and unmounts the whole page with it.
export function SiteMenu({
  account,
  signOut,
  children,
}: {
  account: ReactNode;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sm:hidden">
      <IconButton
        icon="menu"
        label="Menu"
        showLabel
        tone="dark"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      {open && (
        <DialogShell
          layout="full"
          panelClassName="on-dark bg-ground flex h-full w-full flex-col overflow-y-auto px-5 py-3"
          onClose={() => setOpen(false)}
        >
          {(titleId) => (
            <>
              <div className="flex h-14 items-center justify-between">
                <h2 id={titleId} className="sr-only">
                  Menu
                </h2>
                <Wordmark size={22} tone="dark" />
                <IconButton
                  icon="close"
                  label="Close menu"
                  showLabel
                  tone="dark"
                  onClick={() => setOpen(false)}
                />
              </div>
              <nav aria-label="Site" className="mt-4 flex flex-col">
                {children}
              </nav>
              <div className="border-hairline mt-auto border-t pt-5 pb-4">
                {account}
                <div className="mt-4">{signOut}</div>
              </div>
            </>
          )}
        </DialogShell>
      )}
    </div>
  );
}
