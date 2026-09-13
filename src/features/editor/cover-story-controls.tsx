import { Button } from "@/components/ui";
import { SelectCheckbox } from "@/components/select-checkbox";
import { clampWeight } from "@/lib/cover-fonts";
import {
  MAX_COVER_PREVIEWS,
  makeCoverStory,
  type CoverElement,
  type CoverSource,
} from "@/lib/cover-elements";
import { CoverFontMenus } from "./cover-font-menus";
import { CoverTextField } from "./cover-text-field";
import { Segments } from "./cover-segments";
import { CoverStoryFields } from "./cover-story-fields";
import { SourcePicker } from "./cover-source-picker";

export function CoverStoryControls({
  element,
  sources,
  afterPage,
  onChange,
}: {
  element: Extract<CoverElement, { type: "story" }>;
  sources: CoverSource[];
  afterPage: number;
  onChange: (value: CoverElement) => void;
}) {
  const choices = sources.filter((s) => s.pageNo > afterPage);
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
      <CoverFontMenus
        family={element.headlineFont}
        weight={element.headlineWeight}
        effectiveFamily={element.headlineFont ?? "newsreader"}
        onFamily={(headlineFont) =>
          onChange({
            ...element,
            headlineFont,
            headlineWeight:
              headlineFont && element.headlineWeight
                ? clampWeight(headlineFont, element.headlineWeight)
                : undefined,
          })
        }
        onWeight={(headlineWeight) => onChange({ ...element, headlineWeight })}
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
}
