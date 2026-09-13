import { Button } from "@/components/ui";
import { MenuSelect } from "@/components/menu-select";
import { SelectCheckbox } from "@/components/select-checkbox";
import {
  MAX_COVER_PREVIEWS,
  makeCoverStory,
  type CoverElement,
  type CoverSource,
} from "@/lib/cover-elements";
import type { LogoListItem } from "@/lib/logos";
import type { ResolvedImage } from "@/lib/images";
import { CoverTextField } from "./cover-text-field";
import { CoverField } from "./cover-fields";
import { Segments } from "./cover-segments";
import { CoverStoryFields } from "./cover-story-fields";
import { SourcePicker } from "./cover-source-picker";

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
  if (element.type === "story")
    return (
      <div className="space-y-3">
        <CoverTextField
          element={element}
          field="title"
          label="List heading (optional)"
          value={element.title}
          placeholder="Inside this issue"
          onChange={onChange}
        />
        <Segments
          label="Headline size"
          value={element.headlineSize}
          options={[
            { value: "compact", label: "Compact" },
            { value: "list", label: "List" },
            { value: "large", label: "Large" },
            { value: "display", label: "Display" },
          ]}
          onChange={(headlineSize) => onChange({ ...element, headlineSize })}
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
        <CoverStoryFields
          element={element}
          sources={sources}
          afterPage={afterPage}
          onChange={onChange}
        />
        {element.items.length < MAX_COVER_PREVIEWS && (
          <div className="space-y-3">
            <SourcePicker
              sources={choices.filter(
                (s) => !element.items.some((i) => i.headingId === s.id),
              )}
              label="Add section"
              onSelect={(headingId) =>
                onChange({
                  ...element,
                  items: [...element.items, makeCoverStory(headingId)],
                })
              }
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onChange({
                  ...element,
                  items: [...element.items, makeCoverStory()],
                })
              }
            >
              Add story
            </Button>
          </div>
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
