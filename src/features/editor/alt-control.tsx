"use client";

import { Icon } from "@/components/icons";
import { BarPopover } from "./bar-popover";

// The photo bar's alt text (#379): a small button shaped like Ask that opens
// a box holding the field. The button says whether a description is set, so a
// missing one stays visible at a glance: "No alt text" behind a warm dot and
// border when empty, "Alt text" with a check once written.
export function AltControl({
  alt,
  onChange,
}: {
  alt: string;
  onChange: (alt: string) => void;
}) {
  const filled = alt.trim().length > 0;
  return (
    <BarPopover
      name="alt"
      label="Alt text for this photo"
      trigger={({ open, toggle, boxId, triggerRef }) => (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? boxId : undefined}
          aria-haspopup="dialog"
          aria-label={
            filled
              ? "Alt text. Edit the description of this photo"
              : "No alt text. Describe this photo for screen readers"
          }
          title={
            filled
              ? "Edit the description read out for this photo"
              : "Describe this photo for screen readers"
          }
          onClick={toggle}
          className={`text-ink flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] border bg-white px-2.5 font-sans text-[12px] font-semibold ${
            filled
              ? "border-hair hover:border-accent"
              : "border-warn hover:border-warn-strong"
          } ${open ? "border-accent" : ""}`}
        >
          {filled ? (
            <Icon
              name="check"
              size={14}
              strokeWidth={2.4}
              className="text-accent"
            />
          ) : (
            <span aria-hidden className="bg-warn h-2 w-2 rounded-full" />
          )}
          {filled ? "Alt text" : "No alt text"}
        </button>
      )}
    >
      {({ close }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            close();
          }}
          className="flex items-stretch gap-1.5"
        >
          <input
            type="text"
            value={alt}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Describe this photo for screen readers"
            placeholder="Describe this photo for screen readers"
            className="boxed-field border-hair text-ink placeholder:text-faint min-w-0 flex-1 rounded-[6px] border bg-white px-2 py-1 font-sans text-[12px]"
          />
          <button
            type="submit"
            aria-label="Done"
            title="Done (Enter)"
            className="bg-accent text-paper hover:bg-accent-strong relative flex w-8 flex-none cursor-pointer items-center justify-center rounded-[6px] transition-colors after:absolute after:-inset-y-1.5 after:-right-1.5 after:left-0 after:content-['']"
          >
            <Icon name="check" size={14} strokeWidth={2.4} />
          </button>
        </form>
      )}
    </BarPopover>
  );
}
