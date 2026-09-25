import { elementFontContext } from "@/lib/cover-fonts";
import { CoverTextEditor } from "./cover-text-editor";
import { updateShownCoverText } from "@/lib/cover-text-update";
import { useCoverSortable } from "./use-cover-sortable";
import { Icon } from "@/components/icons";
import {
  coverElementName,
  nudgeLayer,
  type CoverElement,
  type CoverSource,
} from "@/lib/cover-elements";
import type { CoverAppearance } from "@/lib/cover-appearance";
import type { ImageMap } from "@/lib/images";
import { CoverElementView } from "@/features/blocks/cover-element-view";
import { CoverItemTools } from "./cover-item-tools";
import { CoverTextToolbar } from "./cover-text-toolbar";
import { AskControl } from "./assistant/ask-box";
import type { SendResult } from "./assistant/use-assistant-chat";

export function EditorCoverElement({
  element,
  sources,
  issueNo,
  images,
  selected,
  hinted = false,
  appearance,
  caret,
  onSelect,
  onUpdate,
  onMove,
  onRemove,
  overflow,
  onAsk,
}: {
  element: CoverElement;
  sources: CoverSource[];
  issueNo: number;
  images: ImageMap;
  selected: boolean;
  /** A layout warning in the inspector is pointing at this item. */
  hinted?: boolean;
  appearance: Required<CoverAppearance>;
  /** Caret colour that contrasts with what sits behind the words. */
  caret?: string;
  onSelect: () => void;
  onUpdate: (element: CoverElement) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  overflow: boolean;
  /** The assistant's Ask on this item (#311, #313), when it's offered. */
  onAsk?: (text: string) => Promise<SendResult>;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } =
    useCoverSortable(element.id, true);
  const ring = isDragging
    ? ""
    : hinted
      ? "ring-warn ring-2 ring-offset-4 ring-offset-page"
      : selected
        ? "ring-accent ring-2 ring-offset-4 ring-offset-page"
        : "hover:ring-hair hover:ring-2 hover:ring-offset-4 hover:ring-offset-page";
  return (
    <div
      ref={setNodeRef}
      data-editor-block
      data-cover-element={element.id}
      style={{ caretColor: caret }}
      onFocus={onSelect}
      className={`group relative rounded-sm transition-shadow ${isDragging ? "z-30" : ""} ${ring}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit ${coverElementName(element, sources)}`}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            e.stopPropagation();
            onSelect();
          }
        }}
      >
        <CoverElementView
          element={element}
          sources={sources}
          issueNo={issueNo}
          images={images}
          editing
          renderText={(field, text, label) => (
            <CoverTextEditor
              id={element.id}
              font={elementFontContext(element, field)}
              fitLines={appearance.panel && appearance.panelShape === "text"}
              maxLength={
                field.includes("description")
                  ? 600
                  : element.type === "details"
                    ? 150
                    : 300
              }
              text={text}
              doc={element.placement.richText?.[field]}
              label={label}
              onChange={(value, doc) =>
                onUpdate(updateShownCoverText(element, field, text, value, doc))
              }
            />
          )}
        />
      </div>
      {selected && element.type !== "logo" && (
        <CoverTextToolbar appearance={appearance} />
      )}
      {selected && onAsk && <AskControl onSend={onAsk} />}
      <CoverItemTools
        selected={selected}
        onMove={onMove}
        onLayer={(dir) =>
          onUpdate({
            ...element,
            placement: nudgeLayer(element.placement, dir),
          })
        }
        onRemove={onRemove}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
            className={`border-hair-warm text-muted absolute top-1/2 -left-9 z-20 flex h-7 w-6 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-[5px] border bg-white transition-opacity active:cursor-grabbing ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
          >
            <Icon name="grip" size={15} />
          </button>
        }
      />
      {overflow && (
        <p className="text-warn bg-warn-soft absolute top-full mt-2 w-full rounded p-2 font-sans text-xs">
          Cover element overflows — shorten it or restore cover styling.
        </p>
      )}
    </div>
  );
}
