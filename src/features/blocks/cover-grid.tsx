import {
  appearanceVars,
  resolveCoverAppearance,
  type CoverAppearance,
} from "@/lib/cover-appearance";
import type { CSSProperties, ReactNode } from "react";
import { coverTextScale, type CoverPlacement } from "@/lib/cover-elements";
import { PAGE_H, PAGE_PAD } from "./page-frame";

export type CoverEntry = {
  id: string;
  placement: CoverPlacement;
  content: ReactNode;
  logoSize?: number;
};
/** Groups stack within an anchor. Mobile follows row/column order in normal flow. */
export function CoverGrid({
  entries,
  style,
  appearance,
  mobile = false,
}: {
  entries: CoverEntry[];
  style: NonNullable<CoverPlacement["style"]>;
  mobile?: boolean;
  appearance?: CoverAppearance;
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
          {group.entries.map((entry) => {
            const paint = resolveCoverAppearance(
              entry.placement.style ?? style,
              entry.placement.style
                ? entry.placement.appearance
                : { ...appearance, ...entry.placement.appearance },
            );
            return (
              <div
                key={entry.id}
                data-cover-entry={entry.id}
                data-logo={entry.logoSize ? "true" : undefined}
                data-width={entry.placement.width}
                data-align={entry.placement.align}
                data-cover-style={entry.placement.style ?? style}
                data-cover-panel={paint.panel}
                className="cover-positioned cover-treatment"
                style={
                  {
                    ...appearanceVars(paint),
                    "--cover-logo-size": entry.logoSize
                      ? `${entry.logoSize}px`
                      : undefined,
                    textAlign: entry.placement.align,
                    "--cover-offset": `${entry.placement.offset}px`,
                    "--cover-text-scale": coverTextScale(entry.placement),
                  } as CSSProperties
                }
              >
                {entry.content}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
