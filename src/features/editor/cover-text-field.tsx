import { elementFontContext } from "@/lib/cover-fonts";
import { CoverTextEditor } from "./cover-text-editor";
import { updateCoverText } from "@/lib/cover-text-update";
import type { CoverElement } from "@/lib/cover-elements";
export function CoverTextField({
  element,
  field,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  maxLength = 300,
}: {
  element: CoverElement;
  field: string;
  label: string;
  value: string;
  onChange: (element: CoverElement) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="text-muted font-sans text-xs font-medium">
      <div className="mb-1.5">{label}</div>
      <div
        className={`boxed-field border-hair-warm text-ink rounded-lg border bg-white px-3 py-2 text-sm font-normal ${multiline ? "min-h-20" : "min-h-10"}`}
      >
        <CoverTextEditor
          id={element.id}
          font={elementFontContext(element, field)}
          text={value}
          label={label}
          placeholder={placeholder}
          maxLength={maxLength}
          doc={element.placement.richText?.[field]}
          onChange={(text, doc) =>
            onChange(updateCoverText(element, field, text, doc))
          }
        />
      </div>
    </div>
  );
}
