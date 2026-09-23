"use client";

import { useRef, useState } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { Button, IconButton } from "@/components/ui";
import type { AdminPostingName } from "@/server/member-profile";
import { PostingNameItem } from "./posting-name-item";

// The moderation lever for a member's posting names (issue #300): rename one
// the filter refused or that shouldn't stand, retire one, clear a photo.
// Results are spoken through the dialog's own live region.
export function PostingNamesDialog({
  label,
  names,
  onClose,
}: {
  label: string;
  names: AdminPostingName[];
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const announce = (text: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(text));
  };

  return (
    <DialogShell
      panelClassName="scrollbar-soft bg-card max-h-[90vh] w-[480px] max-w-full overflow-y-auto rounded-[10px] [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="flex items-start justify-between gap-4 px-8 pt-7">
            <div>
              <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
                Members
              </div>
              <h2
                id={titleId}
                ref={heading}
                tabIndex={-1}
                className="text-ink mt-3 font-serif text-[27px] leading-tight outline-none"
              >
                Posting names
              </h2>
            </div>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
          <p className="text-muted px-8 pt-2.5 font-sans text-[15px] leading-relaxed">
            The names {label} posts under. Renaming changes past comments too; a
            retired name stays on its comments but can’t be posted under.
          </p>
          <ul className="mt-4 px-8">
            {names.map((name) => (
              <PostingNameItem
                key={name.id}
                name={name}
                announce={announce}
                onRetired={() =>
                  requestAnimationFrame(() => heading.current?.focus())
                }
              />
            ))}
          </ul>
          <p role="status" aria-live="polite" className="sr-only">
            {message}
          </p>
          <div className="flex justify-end px-8 pt-4 pb-6">
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}
    </DialogShell>
  );
}
