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
    if (el && el.textContent !== value) el.textContent = value;
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
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      className={`editable block w-full cursor-text outline-none ${className ?? ""}`}
    />
  );
}
