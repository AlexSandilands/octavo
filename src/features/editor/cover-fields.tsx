import type { ReactNode } from "react";

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
export function CoverFieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-muted mb-3 font-sans text-xs font-semibold">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}
