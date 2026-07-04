"use client";

import { Icon } from "@/components/icons";
import { MIN_ZOOM, MAX_ZOOM } from "@/features/blocks/use-canvas-pan-zoom";

// The floating control dock at the bottom of the reader: paging, the spread
// label, contents toggle, fit + zoom slider, PDF and full screen. Fades to 70%
// until hovered/focused so it stays out of the way while reading.
export function ReaderControls({
  label,
  onPrev,
  onNext,
  onToggleContents,
  onResetView,
  zoom,
  onZoom,
  isFullscreen,
  onToggleFullscreen,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToggleContents: () => void;
  onResetView: () => void;
  zoom: number;
  onZoom: (next: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="group absolute inset-x-0 bottom-0 flex justify-center px-4 pt-12 pb-4">
      <div className="bg-reader-chrome text-reader-chrome-text flex items-center gap-1.5 rounded-full px-2.5 py-2 opacity-70 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <CtrlBtn onClick={onPrev} title="Previous">
          <Icon name="chevronLeft" size={18} strokeWidth={1.7} />
        </CtrlBtn>
        <span className="text-reader-chrome-muted min-w-[76px] text-center font-sans text-[13px]">
          {label}
        </span>
        <CtrlBtn onClick={onNext} title="Next">
          <Icon name="chevronRight" size={18} strokeWidth={1.7} />
        </CtrlBtn>
        <Divider />
        <CtrlBtn onClick={onToggleContents} title="Contents">
          <Icon name="menu" size={18} />
        </CtrlBtn>
        <div className="flex items-center gap-2 pr-1 pl-1">
          <CtrlBtn onClick={onResetView} title="Fit to screen">
            <Icon name="zoom" size={18} />
          </CtrlBtn>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => onZoom(parseFloat(e.target.value))}
            aria-label="Zoom page"
            title={`Zoom ${Math.round(zoom * 100)}%`}
            className="accent-reader-slider h-1 w-20 cursor-pointer"
          />
        </div>
        <Divider />
        <CtrlBtn title="Download PDF">
          <Icon name="download" size={17} />
        </CtrlBtn>
        <CtrlBtn
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          <Icon name={isFullscreen ? "fullscreenExit" : "fullscreen"} size={17} />
        </CtrlBtn>
      </div>
    </div>
  );
}

function CtrlBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="hover:bg-reader-chrome-hover flex h-11 w-11 items-center justify-center rounded-full"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="bg-reader-chrome-line mx-1 h-[22px] w-px" />;
}
