"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui";

export function MemberNotes({
  notes,
  label,
}: {
  notes: string | null;
  label: string;
}) {
  const id = useId();
  const text = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = text.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      setOverflows(element.scrollHeight > lineHeight * 2 + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [notes]);

  return (
    <div className="text-faint font-sans text-[13px]">
      <p
        ref={text}
        id={id}
        className={`leading-5 whitespace-pre-wrap ${expanded ? "" : "line-clamp-2"}`}
      >
        {notes || "—"}
      </p>
      {overflows && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-1 min-h-11"
          aria-label={`${expanded ? "Show less" : "Show more"} notes for ${label}`}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
