import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  previewTitle,
  type CoverElement,
  type CoverSource,
  type CoverStory,
} from "@/lib/cover-elements";
import { CoverTextField } from "./cover-text-field";
import { SourcePicker } from "./cover-source-picker";

type StoriesElement = Extract<CoverElement, { type: "stories" }>;

/** The element's stories, one collapsible band each: source, words and order. */
export function CoverStoryFields({
  element,
  sources,
  afterPage,
  onChange,
}: {
  element: StoriesElement;
  sources: CoverSource[];
  afterPage: number;
  onChange: (value: CoverElement) => void;
}) {
  const only = element.items.length === 1;
  const patch = (id: string, changes: Partial<CoverStory>) =>
    onChange({
      ...element,
      items: element.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    });
  return (
    <div className="space-y-3">
      {element.items.map((item, index) => {
        const source = sources.find((s) => s.id === item.headingId);
        const n = index + 1;
        const move = (direction: -1 | 1) => {
          const items = [...element.items],
            other = index + direction;
          if (other < 0 || other >= items.length) return;
          [items[index], items[other]] = [items[other]!, items[index]!];
          onChange({ ...element, items });
        };
        return (
          <StoryBand
            key={item.id}
            startOpen={only}
            summary={`${n}. ${
              previewTitle(item, sources) ||
              (item.headingId ? "Section removed" : "New story")
            }`}
          >
            <SourcePicker
              sources={sources.filter(
                (s) =>
                  s.pageNo > afterPage &&
                  (s.id === item.headingId ||
                    !element.items.some((i) => i.headingId === s.id)),
              )}
              selected={item.headingId}
              label={`Source for story ${n}`}
              allowCustom
              onSelect={(headingId) =>
                patch(item.id, { headingId: headingId || undefined })
              }
            />
            {item.headingId && !source && (
              <p role="status" className="text-warn font-sans text-sm">
                The linked section was removed. Choose another section or write
                a headline.
              </p>
            )}
            <CoverTextField
              element={element}
              field={`${item.id}:title`}
              label={
                item.headingId
                  ? `Cover headline for story ${n} (optional override)`
                  : `Headline for story ${n}`
              }
              value={item.title}
              placeholder={source?.title ?? "Story headline"}
              onChange={onChange}
            />
            <CoverTextField
              element={element}
              field={`${item.id}:description`}
              label={`Supporting text for story ${n} (optional)`}
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
                aria-label={`Move story ${n} up`}
              >
                <Icon name="chevronDown" className="rotate-180" size={16} />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={index === element.items.length - 1}
                onClick={() => move(1)}
                aria-label={`Move story ${n} down`}
              >
                <Icon name="chevronDown" size={16} />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={only}
                aria-label={`Remove story ${n}`}
                onClick={() =>
                  onChange({
                    ...element,
                    items: element.items.filter((i) => i.id !== item.id),
                  })
                }
              >
                Remove story
              </Button>
            </div>
            {only && (
              <p className="text-muted font-sans text-xs">
                Every Stories element keeps one story. Delete the element on the
                page to remove it altogether.
              </p>
            )}
          </StoryBand>
        );
      })}
    </div>
  );
}

/** One entry's band. `startOpen` only seeds it, so adding a story never folds
 *  away the one being written. */
function StoryBand({
  summary,
  startOpen,
  children,
}: {
  summary: string;
  startOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="border-hair-warm rounded-lg border bg-white"
    >
      <summary className="text-ink hover:bg-accent-wash cursor-pointer px-3 py-3 font-sans text-sm">
        {summary}
      </summary>
      <div className="space-y-3 px-3 pb-3">{children}</div>
    </details>
  );
}
