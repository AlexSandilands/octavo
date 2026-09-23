"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { COMMENT_BODY_MAX, type WriteResult } from "@/lib/comments";
import type { ComposerSetup } from "@/lib/discussion-thread";
import { checkMemberName } from "@/lib/member-name";
import { PostingAs } from "./posting-as";

// A comment or a reply (issue #301): an auto-growing box, the posting name,
// and a Post button that holds "Posting…" until the refreshed list is in.
// Refusals come back as sentences and are shown under the box as they stand.

const COUNTER_FROM = 1800;

export type Submit = (
  body: string,
  newName: string | null,
) => Promise<WriteResult>;

export function CommentComposer({
  id,
  label,
  value,
  onChange,
  setup,
  nameId,
  onNameChange,
  onSubmit,
  onCancel,
  menuSide = "bottom",
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  setup: ComposerSetup;
  nameId: string | null;
  onNameChange: (nameId: string) => void;
  onSubmit: Submit;
  /** Replies only: closes the inline composer. */
  onCancel?: () => void;
  menuSide?: "top" | "bottom";
  autoFocus?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState(setup.suggestion);
  const [nameError, setNameError] = useState<string | null>(null);
  const firstPost = setup.names.length === 0;

  // Grows with its text up to the cap in the class list, then scrolls.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (value.trim() === "") {
      setError("Write something first.");
      box.current?.focus();
      return;
    }
    let chosen: string | null = null;
    if (firstPost) {
      const check = checkMemberName(newName, setup.rules);
      if (!check.ok) {
        setNameError(check.reason);
        return;
      }
      chosen = check.name;
    }
    setError(null);
    setNameError(null);
    startTransition(async () => {
      const result = await onSubmit(value, chosen).catch(() => ({
        ok: false as const,
        reason: "That didn’t go through. Please try again.",
      }));
      if (!result.ok) setError(result.reason);
    });
  };

  const counterId = `${id}-count`;
  const errorId = `${id}-error`;
  const described = [value.length > COUNTER_FROM && counterId, error && errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-2.5"
      // A reply box cancels on Escape rather than closing the discussion.
      data-owns-escape={onCancel ? true : undefined}
      onKeyDown={(e) => {
        if (!onCancel || e.key !== "Escape" || pending) return;
        e.preventDefault();
        onCancel();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        ref={box}
        id={id}
        rows={2}
        value={value}
        maxLength={COMMENT_BODY_MAX}
        placeholder={label}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        onChange={(e) => {
          onChange(e.target.value);
          if (error) setError(null);
        }}
        className={`text-ink placeholder:text-faint scrollbar-soft max-h-48 min-h-[4.5rem] w-full resize-none rounded-lg border-[1.5px] bg-white px-3.5 py-2.5 font-sans text-[16px] leading-snug [--scrollbar-surface:white] ${
          error ? "border-warn" : "border-line"
        }`}
      />
      {value.length > COUNTER_FROM && (
        <p id={counterId} className="text-faint -mt-1 font-sans text-[13px]">
          {value.length.toLocaleString("en-NZ")} of{" "}
          {COMMENT_BODY_MAX.toLocaleString("en-NZ")} characters
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-warn font-sans text-[14px] leading-snug"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <PostingAs
          id={id}
          setup={setup}
          nameId={nameId}
          onNameChange={onNameChange}
          newName={newName}
          onNewNameChange={(next) => {
            setNewName(next);
            if (nameError) setNameError(null);
          }}
          newNameError={nameError}
          menuSide={menuSide}
        />
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={onCancel}
              disabled={pending}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" className="min-h-11" busy={pending}>
            {pending ? "Posting…" : onCancel ? "Reply" : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
