"use client";

import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

// The panel before a PDF is open: one big Choose button inside a drop target,
// with the privacy promise and the limits underneath.
export function DropZone({
  over,
  opening,
  error,
  onPick,
}: {
  over: boolean;
  opening: boolean;
  error: string;
  onPick: () => void;
}) {
  return (
    <div className="scrollbar-soft flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
      <div
        className={`flex w-full max-w-[420px] flex-col items-center rounded-[16px] border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color] duration-150 ${
          over ? "border-accent bg-accent-wash" : "border-dash bg-page"
        }`}
      >
        <span className="bg-tint text-accent flex h-16 w-16 items-center justify-center rounded-full">
          <Icon name="importFile" size={30} strokeWidth={1.5} />
        </span>
        <h3 className="text-ink mt-5 font-serif text-[22px] leading-tight">
          {over ? "Drop to open" : "Drop a PDF here"}
        </h3>
        <p className="text-muted mt-1.5 text-[15px]">
          or choose one from this computer
        </p>
        <Button
          icon="upload"
          iconPosition="left"
          className="mt-7"
          busy={opening}
          onClick={onPick}
        >
          {opening ? "Opening…" : "Choose PDF"}
        </Button>
      </div>
      <p className="text-faint mt-6 max-w-[380px] text-center text-[14px] leading-relaxed">
        The PDF stays on this computer. Only the text and photos you add are
        saved to the magazine.
      </p>
      <p className="text-faint2 mt-2 text-center text-[13px]">
        Up to 40 MiB and 100 pages · selectable text (no scanned pages)
      </p>
      {error && (
        <p
          role="alert"
          className="text-warn mt-5 max-w-[380px] text-center text-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
}
