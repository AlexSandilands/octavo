import { Button } from "@/components/ui";
import { MenuSelect } from "@/components/menu-select";
import { SelectCheckbox } from "@/components/select-checkbox";
import {
  MAX_COVER_PREVIEWS,
  previewTitle,
  type CoverElement,
  type CoverSource,
} from "@/lib/cover-elements";
import type { LogoListItem } from "@/lib/logos";
import type { ResolvedImage } from "@/lib/images";
import { CoverTextField } from "./cover-text-field";
import { CoverField } from "./cover-fields";
import { CoverPreviewFields } from "./cover-preview-fields";

export function CoverElementFields({
  element,
  sources,
  afterPage,
  logos,
  onChange,
  onRegisterImage,
}: {
  element: CoverElement;
  sources: CoverSource[];
  afterPage: number;
  logos: LogoListItem[];
  onChange: (value: CoverElement) => void;
  onRegisterImage: (id: string, image: ResolvedImage) => void;
}) {
  const choices = sources.filter((s) => s.pageNo > afterPage);
  if (element.type === "contents")
    return (
      <div className="space-y-3">
        <CoverTextField
          element={element}
          field="title"
          label="List heading"
          value={element.title}
          onChange={onChange}
        />
        <SelectCheckbox
          label="Show page numbers"
          checked={element.showPageNumbers}
          onChange={(showPageNumbers) =>
            onChange({ ...element, showPageNumbers })
          }
        >
          Show page numbers
        </SelectCheckbox>
        <CoverPreviewFields
          element={element}
          sources={sources}
          onChange={onChange}
        />
        {element.items.length < MAX_COVER_PREVIEWS && (
          <SourcePicker
            sources={choices.filter(
              (s) => !element.items.some((i) => i.headingId === s.id),
            )}
            label="Add section"
            onSelect={(headingId) =>
              onChange({
                ...element,
                items: [
                  ...element.items,
                  { headingId, title: "", description: "" },
                ],
              })
            }
          />
        )}
      </div>
    );
  if (element.type === "teaser")
    return (
      <div className="space-y-3">
        <SourcePicker
          sources={choices}
          selected={element.headingId}
          label="Source"
          allowCustom
          onSelect={(headingId) =>
            onChange({ ...element, headingId: headingId || undefined })
          }
        />
        {element.headingId &&
          !sources.some((s) => s.id === element.headingId) && (
            <p role="status" className="text-warn font-sans text-sm">
              The linked section was removed. Choose another section or write a
              headline.
            </p>
          )}
        <CoverTextField
          element={element}
          field="title"
          label={
            element.headingId
              ? "Cover headline (optional override)"
              : "Headline"
          }
          value={element.title}
          placeholder={
            previewTitle(
              { title: "", headingId: element.headingId },
              sources,
            ) || "Story headline"
          }
          onChange={onChange}
        />
        <CoverTextField
          element={element}
          field="description"
          label="Supporting text (optional)"
          value={element.description}
          multiline
          maxLength={600}
          onChange={onChange}
        />
        {element.headingId && (
          <SelectCheckbox
            label="Show page number"
            checked={element.showPageNumbers}
            onChange={(showPageNumbers) =>
              onChange({ ...element, showPageNumbers })
            }
          >
            Show page number
          </SelectCheckbox>
        )}
      </div>
    );
  if (element.type === "details")
    return (
      <div className="space-y-3">
        <SelectCheckbox
          label="Show issue number"
          checked={element.showNumber}
          onChange={(showNumber) => onChange({ ...element, showNumber })}
        >
          Show issue number
        </SelectCheckbox>
        <CoverTextField
          element={element}
          field="text"
          label="Date or edition (optional)"
          value={element.text}
          maxLength={150}
          placeholder="Spring 2026"
          onChange={onChange}
        />
      </div>
    );
  const selected = logos.find((l) => l.id === element.logoId);
  return (
    <div className="space-y-4">
      {logos.length ? (
        <MenuSelect
          portal
          label="Logo"
          current={selected?.name ?? "Choose a logo"}
          ariaLabel="Cover logo"
          value={element.logoId}
          className="w-full"
          menuClassName="w-full max-h-56 overflow-y-auto scrollbar-soft"
          items={logos.map((l) => ({
            key: l.id,
            value: l.id,
            content: <span className="truncate">{l.name}</span>,
          }))}
          onSelect={(logoId) => {
            const logo = logos.find((l) => l.id === logoId);
            if (!logo) return;
            onRegisterImage(logo.imageId, logo.image);
            onChange({
              ...element,
              logoId,
              imageId: logo.imageId,
              alt: logo.name,
            });
          }}
        />
      ) : (
        <Button href="/admin/magazine" variant="secondary" size="sm">
          Add a logo to the library
        </Button>
      )}
      <label className="text-muted block font-sans text-xs font-medium">
        Logo size{" "}
        <span className="float-right font-mono">{element.size}px</span>
        <input
          aria-label="Logo size"
          type="range"
          min={40}
          max={240}
          step={5}
          value={element.size}
          className="accent-accent mt-1 h-8 w-full cursor-pointer"
          onChange={(e) =>
            onChange({ ...element, size: Number(e.target.value) })
          }
        />
      </label>
      <CoverField
        label="Logo description"
        value={element.alt}
        onChange={(alt) => onChange({ ...element, alt })}
      />
    </div>
  );
}
export function SourcePicker({
  sources,
  selected,
  label,
  onSelect,
  allowCustom = false,
}: {
  sources: CoverSource[];
  selected?: string;
  label: string;
  onSelect: (id: string) => void;
  allowCustom?: boolean;
}) {
  if (!sources.length && !allowCustom)
    return (
      <p className="text-muted font-sans text-sm">
        Add a heading to a later page to include it here.
      </p>
    );
  return (
    <MenuSelect
      portal
      label={label}
      current={
        sources.find((s) => s.id === selected)?.title ??
        (allowCustom ? "Custom headline" : "Choose a heading")
      }
      ariaLabel="Section headings"
      value={selected ?? ""}
      className="w-full"
      menuClassName="w-full max-h-56 overflow-y-auto scrollbar-soft"
      items={[
        ...(allowCustom
          ? [
              {
                key: "custom",
                value: "",
                content: <span>Custom headline</span>,
              },
            ]
          : []),
        ...sources.map((s) => ({
          key: s.id,
          value: s.id,
          content: (
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
              <span className="truncate">{s.title}</span>
              <span className="text-muted shrink-0 text-xs">p. {s.pageNo}</span>
            </span>
          ),
        })),
      ]}
      onSelect={onSelect}
    />
  );
}
