"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { MemberNotesPopover } from "./member-notes-popover";
import styles from "./member-notes.module.css";

export function MemberNotes({
  notes,
  label,
}: {
  notes: string | null;
  label: string;
}) {
  const id = useId();
  const text = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<"hover" | "pinned" | null>(null);
  const [overflows, setOverflows] = useState(false);

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const close = useCallback((restoreFocus = false) => {
    setMode(null);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const element = text.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      const clipped = element.scrollHeight > lineHeight * 2 + 1;
      setOverflows(clipped);
      if (!clipped) close();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [notes, close, overflows]);
  useEffect(() => cancelLeave, [cancelLeave]);

  const enter = () => {
    cancelLeave();
    setMode((current) => current ?? "hover");
  };
  const leave = () => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => {
      setMode((current) => (current === "hover" ? null : current));
    }, 160);
  };

  const preview = (
    <span
      ref={text}
      className="w-full min-w-0 line-clamp-2 leading-5 whitespace-pre-wrap"
    >
      {notes || "—"}
    </span>
  );

  return (
    <div className={`${styles.preview} text-faint font-sans text-[13px]`}>
      {overflows ? (
        <Button
          ref={trigger}
          variant="secondary"
          className={styles.trigger}
          aria-label={`Read full notes for ${label}`}
          aria-expanded={mode !== null}
          aria-controls={mode ? id : undefined}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") enter();
          }}
          onPointerLeave={leave}
          onClick={() => {
            cancelLeave();
            if (mode === "pinned") close(true);
            else setMode("pinned");
          }}
        >
          {preview}
        </Button>
      ) : (
        preview
      )}
      {mode && notes && (
        <MemberNotesPopover
          id={id}
          notes={notes}
          label={label}
          trigger={trigger}
          pinned={mode === "pinned"}
          onClose={close}
          onPointerEnter={cancelLeave}
          onPointerLeave={leave}
        />
      )}
    </div>
  );
}
