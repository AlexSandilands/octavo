import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import {
  previewTitle,
  type CoverElement,
  type CoverSource,
  type CoverStory,
} from "@/lib/cover-elements";
import { CoverTextField } from "./cover-text-field";
import { SourcePicker } from "./cover-source-picker";

type StoryElement = Extract<CoverElement, { type: "story" }>;

/** A section's stories, one collapsible band each: source, words and order. */
export function CoverStoryFields({
  element,
  sources,
  afterPage,
  onChange,
}: {
  element: StoryElement;
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
            actions={
              <>
                <StoryAction
                  icon="arrowUp"
                  label={`Move story ${n} up`}
                  disabled={index === 0}
                  onClick={() => move(-1)}
                />
                <StoryAction
                  icon="arrowDown"
                  label={`Move story ${n} down`}
                  disabled={index === element.items.length - 1}
                  onClick={() => move(1)}
                />
                <StoryAction
                  icon="trash"
                  label={`Remove story ${n}`}
                  disabled={only}
                  destructive
                  onClick={() =>
                    onChange({
                      ...element,
                      items: element.items.filter((i) => i.id !== item.id),
                    })
                  }
                />
              </>
            }
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
            {only && (
              <p className="text-muted font-sans text-xs">
                The last story stays. Delete the Story on the page to remove it
                altogether.
              </p>
            )}
          </StoryBand>
        );
      })}
    </div>
  );
}

/** One entry's band: a disclosure for its title with the order and remove
 *  controls beside it, so they work while the band is folded. `startOpen`
 *  only seeds it, so adding a story never folds away the one being written. */
function StoryBand({
  summary,
  startOpen,
  actions,
  children,
}: {
  summary: string;
  startOpen: boolean;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const bodyId = useId();
  return (
    <div className="border-hair-warm rounded-lg border bg-white">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="text-ink hover:bg-accent-wash flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-l-lg px-3 py-3 text-left font-sans text-sm transition-colors"
        >
          <Icon
            name="chevronDown"
            size={14}
            className={`text-faint2 shrink-0 transition ${open ? "" : "-rotate-90"}`}
          />
          <span className="truncate">{summary}</span>
        </button>
        {actions}
      </div>
      {open && (
        <div id={bodyId} className="space-y-3 px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** A small square control in the band's header. */
function StoryAction({
  icon,
  label,
  disabled,
  destructive = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`border-hair-warm text-ink flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border bg-white transition-colors disabled:cursor-default disabled:opacity-40 ${
        destructive
          ? "hover:border-warn hover:text-warn enabled:hover:bg-white"
          : "hover:bg-accent-wash"
      }`}
    >
      <Icon name={icon} size={14} strokeWidth={1.8} />
    </button>
  );
}
