"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { StaleActionNotice } from "@/components/stale-action-notice";
import { draftRestored, failureFrom } from "@/lib/stale-action";
import { COMMENT_BODY_MAX, type WriteResult } from "@/lib/comments";

// Editing your own comment in place (issue #301); saving marks it "(edited)",
// Escape or Cancel puts it back.
export function CommentEditForm({
  id,
  initial,
  onSave,
  onCancel,
  keep,
  restored,
}: {
  id: string;
  initial: string;
  onSave: (body: string) => Promise<WriteResult>;
  onCancel: () => void;
  /** Keeps the edit for the reload a stale failure asks for (#132). */
  keep?: (body: string) => boolean;
  /** The edit as it stood before that reload, in place of `initial`. */
  restored?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(restored ?? initial);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [kept, setKept] = useState(false);
  const [welcome, setWelcome] = useState(restored !== undefined);
  const [pending, startTransition] = useTransition();

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  // Into the box, caret at the end, on opening.
  useLayoutEffect(() => {
    const el = box.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setStale(false);
    setWelcome(false);
    startTransition(async () => {
      const result = await onSave(value).catch((e) => failureFrom(e));
      if (result.ok) return;
      if ("stale" in result) {
        setKept(keep?.(value) ?? false);
        setStale(true);
      } else setError(result.reason);
    });
  };

  const errorId = `${id}-error`;
  return (
    <form
      onSubmit={save}
      noValidate
      className="mt-2 flex flex-col gap-2"
      // Escape cancels the edit, not the whole discussion (see DialogShell).
      data-owns-escape
      onKeyDown={(e) => {
        if (e.key !== "Escape" || pending) return;
        e.preventDefault();
        onCancel();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Edit your comment
      </label>
      <textarea
        ref={box}
        id={id}
        value={value}
        maxLength={COMMENT_BODY_MAX}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
          setWelcome(false);
        }}
        className={`text-ink scrollbar-soft max-h-64 w-full resize-none rounded-lg border-[1.5px] bg-white px-3.5 py-2.5 font-sans text-[16px] leading-snug [--scrollbar-surface:white] ${
          error ? "border-warn" : "border-line"
        }`}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-warn font-sans text-[14px]"
        >
          {error}
        </p>
      )}
      {welcome && (
        <p className="text-muted font-sans text-[14px] leading-snug">
          {draftRestored("Save")}
        </p>
      )}
      {stale && <StaleActionNotice typed kept={kept} />}
      <div className="flex justify-end gap-1">
        <Button
          variant="quiet"
          size="compact"
          className="px-3"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" size="compact" busy={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
