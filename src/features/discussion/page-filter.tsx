"use client";

// "This page only" at the top of the thread (issue #304): narrows the list to
// the comments tagged to the open page(s), and says how many there are while
// it is on. The discussion button carries no count, so this is the one place
// a number appears.
export function PageFilter({
  spread,
  on,
  onChange,
  count,
}: {
  /** Two pages open, so "These pages". */
  spread: boolean;
  on: boolean;
  onChange: (on: boolean) => void;
  /** Top-level comments on the open pages; null until the list has loaded. */
  count: number | null;
}) {
  const where = spread ? "these pages" : "this page";
  const said =
    !on || count === null
      ? ""
      : count === 0
        ? `No comments on ${where} yet`
        : `${count} ${count === 1 ? "comment" : "comments"} on ${where}`;
  return (
    <div className="border-line -mt-2 mb-4 flex flex-wrap items-center justify-between gap-x-3 border-b pb-1">
      <label className="text-ink flex min-h-11 cursor-pointer items-center gap-2.5 font-sans text-[15px]">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-accent h-5 w-5 flex-none cursor-pointer"
        />
        {spread ? "These pages only" : "This page only"}
      </label>
      <p
        role="status"
        data-page-count
        className="text-muted font-sans text-[14px]"
      >
        {said}
      </p>
    </div>
  );
}
