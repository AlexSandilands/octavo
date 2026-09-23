"use client";

import { useId } from "react";
import { capitalise, pageName, type ReaderPages } from "./page-tags";

const CHOICE =
  "text-ink flex min-h-11 w-fit cursor-pointer items-center gap-2.5 font-sans text-[15px]";
const BOX = "accent-accent h-5 w-5 flex-none cursor-pointer";

// The composer's page tag (issue #304): with one page open, a checkbox "Tag
// page 12"; with a spread, a radio group — none, or either page, since the
// reader can't know which of the two is being read. Off until chosen.
export function PageTagPicker({
  pages,
  slot,
  onChange,
}: {
  pages: ReaderPages;
  /** The chosen open page by position; null for none. */
  slot: number | null;
  onChange: (slot: number | null) => void;
}) {
  const group = useId();
  const names = pages.open.map((id) => pageName(pages, id) ?? "this page");
  if (names.length === 0) return null;
  if (names.length === 1) {
    return (
      <label className={CHOICE}>
        <input
          type="checkbox"
          checked={slot !== null}
          onChange={(e) => onChange(e.target.checked ? 0 : null)}
          className={BOX}
        />
        Tag {names[0]}
      </label>
    );
  }
  const chosen = slot === null ? null : Math.min(slot, names.length - 1);
  const choices: [number | null, string][] = [
    [null, "None"],
    ...names.map((name, i): [number, string] => [i, capitalise(name)]),
  ];
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4">
      <legend className="text-ink float-left mr-4 flex min-h-11 items-center font-sans text-[15px] font-semibold">
        Tag a page
      </legend>
      {choices.map(([value, label]) => (
        <label key={label} className={CHOICE}>
          <input
            type="radio"
            name={group}
            checked={chosen === value}
            onChange={() => onChange(value)}
            className={BOX}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
