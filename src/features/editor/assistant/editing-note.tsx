// Over the canvas while a run is under way (#310): the canvas is inert, so the
// author's edits can't land between the assistant's and split its one undo
// step. Stop stays in the panel.
export function AssistantEditingNote() {
  return (
    <p
      role="status"
      className="border-hair-warm text-ink pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full border bg-white px-4 py-2 font-sans text-[14px] font-semibold shadow-[0_4px_14px_rgba(40,36,28,0.12)]"
    >
      The assistant is editing this issue. Stop it from the panel.
    </p>
  );
}
