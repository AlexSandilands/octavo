import { appearanceVars, type CoverAppearance } from "@/lib/cover-appearance";
import type { CSSProperties, ReactNode } from "react";
import { coverTextScale, type CoverPlacement } from "@/lib/cover-elements";
import { PAGE_H, PAGE_PAD } from "./page-frame";

export type CoverEntry = {
  id: string;
  placement: CoverPlacement;
  /** Resolved by `itemAppearance`: the item's overrides over the cover's defaults. */
  paint: Required<CoverAppearance>;
  content: ReactNode;
  logoSize?: number;
  /** Percent of the column for a photo; the entry takes it instead of a width band. */
  imageWidth?: number;
};
/** Groups stack within an anchor. Mobile follows row/column order in normal flow. */
export function CoverGrid({
  entries,
  mobile = false,
}: {
  entries: CoverEntry[];
  mobile?: boolean;
}) {
  const groups = ["top", "center", "bottom"]
    .flatMap((row) =>
      ["left", "center", "right"].map((column) => ({
        row,
        column,
        entries: entries.filter(
          (e) => e.placement.row === row && e.placement.column === column,
        ),
      })),
    )
    .filter((g) => g.entries.length);
  return (
    <div
      className={mobile ? "cover-grid cover-grid-mobile" : "cover-grid"}
      style={mobile ? undefined : { height: PAGE_H - 2 * PAGE_PAD }}
    >
      {groups.map((group) => (
        <div
          key={`${group.row}-${group.column}`}
          className="cover-placement-group"
          data-row={group.row}
          data-column={group.column}
        >
          {group.entries.map((entry) => (
            <div
              key={entry.id}
              data-cover-entry={entry.id}
              data-logo={entry.logoSize ? "true" : undefined}
              data-kind={entry.imageWidth !== undefined ? "image" : undefined}
              data-width={entry.placement.width}
              data-align={entry.placement.align}
              data-cover-panel={entry.paint.panel}
              data-cover-panel-shape={entry.paint.panelShape}
              className="cover-positioned cover-treatment"
              style={
                {
                  ...appearanceVars(entry.paint),
                  "--cover-logo-size": entry.logoSize
                    ? `${entry.logoSize}px`
                    : undefined,
                  "--cover-layer": entry.placement.layer,
                  width:
                    entry.imageWidth !== undefined && !mobile
                      ? `${entry.imageWidth}%`
                      : undefined,
                  textAlign: entry.placement.align,
                  "--cover-offset": `${entry.placement.offset}px`,
                  "--cover-text-scale": coverTextScale(entry.placement),
                } as CSSProperties
              }
            >
              {entry.content}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
