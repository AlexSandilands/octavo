import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  previewTitle,
  type CoverElement,
  type CoverSource,
} from "@/lib/cover-elements";
import { CoverTextField } from "./cover-text-field";

export function CoverPreviewFields({
  element,
  sources,
  onChange,
}: {
  element: Extract<CoverElement, { type: "contents" }>;
  sources: CoverSource[];
  onChange: (value: CoverElement) => void;
}) {
  return (
    <div className="space-y-3">
      {element.items.map((item, index) => {
        const source = sources.find((s) => s.id === item.headingId);
        const move = (direction: -1 | 1) => {
          const items = [...element.items],
            other = index + direction;
          if (other < 0 || other >= items.length) return;
          [items[index], items[other]] = [items[other]!, items[index]!];
          onChange({ ...element, items });
        };
        return (
          <details
            key={item.headingId}
            className="border-hair-warm rounded-lg border bg-white"
          >
            <summary className="text-ink cursor-pointer px-3 py-3 font-sans text-sm hover:bg-accent-wash">
              {index + 1}. {previewTitle(item, sources) || "Section removed"}
            </summary>
            <div className="space-y-3 px-3 pb-3">
              {!source && (
                <p role="status" className="text-warn font-sans text-sm">
                  This section was removed. Remove this preview and choose
                  another.
                </p>
              )}
              <CoverTextField
                element={element}
                field={`${item.headingId}:title`}
                label={`Cover title for preview ${index + 1}`}
                value={item.title}
                placeholder={source?.title ?? "Section removed"}
                onChange={onChange}
              />
              <CoverTextField
                element={element}
                field={`${item.headingId}:description`}
                label={`Description for preview ${index + 1}`}
                value={item.description}
                multiline
                maxLength={600}
                onChange={onChange}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={index === 0}
                  onClick={() => move(-1)}
                  aria-label={`Move preview ${index + 1} up`}
                >
                  <Icon name="chevronDown" className="rotate-180" size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={index === element.items.length - 1}
                  onClick={() => move(1)}
                  aria-label={`Move preview ${index + 1} down`}
                >
                  <Icon name="chevronDown" size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    onChange({
                      ...element,
                      items: element.items.filter(
                        (i) => i.headingId !== item.headingId,
                      ),
                    })
                  }
                >
                  Remove preview
                </Button>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
