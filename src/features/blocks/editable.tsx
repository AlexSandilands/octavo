"use client";

import { useLayoutEffect, useRef } from "react";

// An in-place editable text node. Used inside BlockView's edit mode so the
// admin edits the *themed* element directly — identical typography to the
// reader, because it inherits the surrounding element's font.
//
// It is uncontrolled after the initial mount: we seed the text once, then let
// the DOM own it. Re-renders from parent state (autosave reads that state) no
// longer touch the node, so the caret never jumps mid-edit.
export function Editable({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    // Seed via innerText so saved line breaks (\n) render as real breaks.
    if (el && el.innerText !== value) el.innerText = value;
    // Mount-only on purpose — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={placeholder}
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      // innerText (not textContent) so the line breaks the author types with
      // Enter are captured as \n and survive the round-trip to the reader.
      onInput={(e) => onChange(e.currentTarget.innerText)}
      className={`editable block w-full cursor-text whitespace-pre-wrap outline-none ${className ?? ""}`}
    />
  );
}
