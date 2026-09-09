import { createId } from "@/lib/id";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { MenuSelect } from "@/components/menu-select";
import { ReviewText } from "./review-text";
import { type Block } from "@/lib/blocks";
import { richTextToPlain } from "@/lib/rich-text-doc";
import { splitReview } from "./synthesis";
import type { ReviewItem } from "./model";

function PhotoPreview({ item }: { item: ReviewItem }) {
  const [url, setUrl] = useState("");
  const blob = item.region.image?.blob;
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    // Synchronize the selected browser Blob with its revocable URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url ? (
    <Image
      src={url}
      alt="Selected source image preview"
      width={item.region.image?.width}
      height={item.region.image?.height}
      unoptimized
      className="max-h-40 w-auto object-contain"
    />
  ) : null;
}
function ReviewCard({
  item,
  index,
  total,
  update,
  remove,
  move,
  split,
  combine,
  canCombine,
}: {
  item: ReviewItem;
  index: number;
  total: number;
  update: (block: Block) => void;
  remove: () => void;
  move: (dir: -1 | 1) => void;
  split: () => void;
  combine: () => void;
  canCombine: boolean;
}) {
  const block = item.block;
  return (
    <li className="border-hair space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted text-sm">
          {index + 1} · Source page{" "}
          {Array.from(new Set(item.sources.map((id) => id.split(":")[0]))).join(
            ", ",
          )}
        </span>
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Move selection ${index + 1} up`}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Move selection ${index + 1} down`}
          disabled={index === total - 1}
          onClick={() => move(1)}
        >
          ↓
        </Button>
        <Button size="sm" variant="secondary" onClick={remove}>
          Remove
        </Button>
      </div>
      {block.type !== "image" && (
        <MenuSelect
          label="Type"
          current={block.type === "heading" ? "Heading" : "Text"}
          ariaLabel={`Selection ${index + 1} type`}
          value={block.type}
          items={[
            { key: "text", value: "text", content: "Text" },
            { key: "heading", value: "heading", content: "Heading" },
          ]}
          onSelect={(type) =>
            update(
              type === "heading"
                ? {
                    id: block.id,
                    type: "heading",
                    title:
                      block.type === "text" ? richTextToPlain(block.text) : "",
                    kicker: "",
                    level: item.region.level,
                  }
                : {
                    id: block.id,
                    type: "text",
                    text:
                      block.type === "heading"
                        ? {
                            type: "doc",
                            content: [
                              {
                                type: "paragraph",
                                content: [
                                  { type: "text", text: block.title || " " },
                                ],
                              },
                            ],
                          }
                        : item.region.doc,
                    size: item.region.size,
                    align: item.region.align,
                  },
            )
          }
        />
      )}
      {block.type === "heading" && (
        <>
          <label className="block text-sm">
            Heading text
            <textarea
              className="border-hair mt-1 w-full rounded border p-2"
              value={block.title}
              onChange={(e) => update({ ...block, title: e.target.value })}
            />
          </label>
          <MenuSelect
            label="Level"
            current={block.level ?? "main"}
            ariaLabel="Heading level"
            value={block.level ?? "main"}
            items={(["main", "section", "paragraph"] as const).map((value) => ({
              key: value,
              value,
              content: value,
            }))}
            onSelect={(level) => update({ ...block, level })}
          />
        </>
      )}
      {block.type === "text" && (
        <>
          <div
            className="relative"
            aria-label={`Editable text preview ${index + 1}`}
          >
            <ReviewText key={item.id} block={block} onChange={update} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={split}>
              Split text
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={combine}
              disabled={!canCombine}
            >
              Combine with next
            </Button>
          </div>
          <p className="text-muted text-xs">
            Split at paragraphs, or halfway through one paragraph. Repeat to
            exclude neighbouring text.
          </p>
        </>
      )}
      {block.type === "image" && (
        <>
          <PhotoPreview item={item} />
          <label className="block text-sm">
            Image description
            <input
              className="border-hair mt-1 w-full rounded border p-2"
              value={block.alt ?? ""}
              maxLength={300}
              onChange={(e) => update({ ...block, alt: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Caption
            <input
              className="border-hair mt-1 w-full rounded border p-2"
              value={block.caption}
              maxLength={300}
              onChange={(e) => update({ ...block, caption: e.target.value })}
            />
          </label>
        </>
      )}
    </li>
  );
}
export function ReviewTray({
  items,
  onChange,
  disabled,
}: {
  items: ReviewItem[];
  onChange: (items: ReviewItem[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} inert={disabled} className="min-w-0">
      <legend className="font-serif text-lg">
        Review selection ({items.length})
      </legend>
      <ol className="space-y-3 py-3">
        {items.map((item, index) => {
          const next = items[index + 1];
          const canCombine =
            item.block.type === "text" &&
            next?.block.type === "text" &&
            item.block.size === next.block.size &&
            item.block.align === next.block.align;
          return (
            <ReviewCard
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              canCombine={canCombine}
              update={(block) =>
                onChange(
                  items.map((it, i) => (i === index ? { ...it, block } : it)),
                )
              }
              remove={() => onChange(items.filter((_, i) => i !== index))}
              move={(dir) => {
                const copy = [...items];
                [copy[index], copy[index + dir]] = [
                  copy[index + dir]!,
                  copy[index]!,
                ];
                onChange(copy);
              }}
              split={() =>
                onChange(
                  items.flatMap((it, i) =>
                    i === index ? splitReview(it) : [it],
                  ),
                )
              }
              combine={() => {
                if (
                  !canCombine ||
                  item.block.type !== "text" ||
                  next?.block.type !== "text" ||
                  typeof item.block.text === "string" ||
                  typeof next.block.text === "string"
                )
                  return;
                const content = [
                  ...item.block.text.content,
                  ...next.block.text.content,
                ];
                const id = createId();
                onChange(
                  items.flatMap((it, i) =>
                    i === index
                      ? [
                          {
                            ...item,
                            id,
                            sources: [
                              ...new Set([...item.sources, ...next.sources]),
                            ],
                            block: {
                              ...item.block,
                              id,
                              text: { type: "doc" as const, content },
                            },
                          },
                        ]
                      : i === index + 1
                        ? []
                        : [it],
                  ),
                );
              }}
            />
          );
        })}
      </ol>
    </fieldset>
  );
}
