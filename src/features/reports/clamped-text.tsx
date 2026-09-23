"use client";

import { useId, useState } from "react";

// A comment body in the inbox: plain text as written (newlines kept), clamped
// to four lines with a toggle once it is long enough to need one.
export function ClampedText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const long = text.length > 240 || text.split("\n").length > 4;
  return (
    <div className={className}>
      <p
        id={id}
        className={`text-body font-sans text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
          long && !open ? "line-clamp-4" : ""
        }`}
      >
        {text || <span className="text-faint2 italic">(empty)</span>}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="text-accent min-h-11 cursor-pointer font-sans text-[14px] font-semibold hover:underline"
        >
          {open ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}
