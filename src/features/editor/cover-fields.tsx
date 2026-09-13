import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { InspectorBand } from "./use-inspector-band";

const INPUT =
  "border-hair-warm text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 font-sans text-sm";
export function CoverField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  maxLength = 300,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const props = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder,
    maxLength,
    className: INPUT,
  };
  return (
    <label className="text-muted block font-sans text-xs font-medium">
      {label}
      {multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
    </label>
  );
}

/** The small label above every inspector control. */
export function FieldLabel({
  as: Tag = "div",
  children,
}: {
  as?: "div" | "legend";
  children: ReactNode;
}) {
  return (
    <Tag className="text-muted mb-2 block font-sans text-xs font-medium">
      {children}
    </Tag>
  );
}

/** One titled band of the inspector; bands are separated by a hairline.
 *  Given `collapsible`, the title row becomes a disclosure and the body
 *  unmounts when it is folded away, leaving only the row's height behind. */
export function InspectorSection({
  title,
  collapsible,
  children,
}: {
  title?: string;
  collapsible?: InspectorBand;
  children: ReactNode;
}) {
  const bodyId = useId();
  if (collapsible && title)
    return (
      <section className="border-line border-t first:border-t-0">
        <button
          type="button"
          aria-expanded={collapsible.open}
          aria-controls={bodyId}
          onClick={collapsible.onToggle}
          className="hover:bg-accent-wash group flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-4 text-left transition-colors"
        >
          <Label>{title}</Label>
          <Icon
            name="chevronDown"
            size={16}
            className={`text-faint2 group-hover:text-accent transition ${
              collapsible.open ? "rotate-180" : ""
            }`}
          />
        </button>
        {collapsible.open && (
          <div id={bodyId} className="space-y-4 px-4 pb-5">
            {children}
          </div>
        )}
      </section>
    );
  return (
    <section className="border-line space-y-4 border-t px-4 py-5 first:border-t-0">
      {title && <Label>{title}</Label>}
      {children}
    </section>
  );
}
