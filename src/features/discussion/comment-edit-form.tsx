"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { COMMENT_BODY_MAX, type WriteResult } from "@/lib/comments";

// Editing your own comment in place (issue #301); saving marks it "(edited)".
export function CommentEditForm({
  id,
  initial,
  onSave,
  onCancel,
}: {
  id: string;
  initial: string;
  onSave: (body: string) => Promise<WriteResult>;
  onCancel: () => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
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
    startTransition(async () => {
      const result = await onSave(value).catch(() => ({
        ok: false as const,
        reason: "That didn’t go through. Please try again.",
      }));
      if (!result.ok) setError(result.reason);
    });
  };

  const errorId = `${id}-error`;
  return (
    <form onSubmit={save} noValidate className="mt-2 flex flex-col gap-2">
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
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" className="min-h-11" busy={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
