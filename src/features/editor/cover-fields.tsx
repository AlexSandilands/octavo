import type { ReactNode } from "react";
import { Label } from "@/components/ui";

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

/** One titled band of the inspector; bands are separated by a hairline. */
export function InspectorSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-line space-y-4 border-t px-4 py-5 first:border-t-0">
      {title && <Label>{title}</Label>}
      {children}
    </section>
  );
}
