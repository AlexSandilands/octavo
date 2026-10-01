"use client";

import { useId } from "react";
import { Icon } from "@/components/icons";
import type { FollowUp } from "@/lib/ai-follow-up";

// The assistant's suggested next message (#366), under its latest reply: one
// 44px button with the model's label, marked as the assistant's suggestion,
// and the exact words it sends printed beneath, so nothing goes that the
// author can't read first. Pressing it is an ordinary send.
export function FollowUpButton({
  followUp,
  disabled,
  onSend,
}: {
  followUp: FollowUp;
  disabled: boolean;
  onSend: () => void;
}) {
  const id = useId();
  return (
    <div
      data-assistant-follow-up
      role="group"
      aria-label="Suggested by the assistant"
      className="flex flex-col items-start gap-1.5 font-sans"
    >
      <p aria-hidden className="text-faint text-[13px]">
        Suggested by the assistant
      </p>
      <button
        type="button"
        aria-disabled={disabled || undefined}
        aria-describedby={id}
        title={followUp.message}
        onClick={() => {
          if (!disabled) onSend();
        }}
        className={`border-hair-warm text-ink inline-flex h-11 max-w-full flex-none items-center gap-2 rounded-lg border-[1.5px] bg-white px-4 text-[15px] font-semibold transition-colors ${disabled ? "cursor-default opacity-45" : "hover:border-accent hover:bg-accent-wash cursor-pointer motion-safe:active:scale-95"}`}
      >
        <Icon name="sparkle" size={16} />
        {followUp.label}
      </button>
      <p id={id} className="text-muted text-[13px] leading-snug">
        Sends: &ldquo;{followUp.message}&rdquo;
      </p>
    </div>
  );
}
