import { MenuSelect } from "@/components/menu-select";
import {
  COVER_FONTS,
  COVER_FONT_IDS,
  fontWeights,
  weightLabel,
  type CoverFont,
  type CoverWeight,
} from "@/lib/cover-fonts";

/** The same named, bounded choices in the inspector and selection toolbar. */
export function CoverFontMenus({
  family,
  weight,
  effectiveFamily,
  onFamily,
  onWeight,
  inline = false,
  disabled = false,
  onBeforeOpen,
}: {
  family?: CoverFont | null;
  weight?: CoverWeight | null;
  effectiveFamily: CoverFont;
  onFamily: (font: CoverFont | undefined) => void;
  onWeight: (weight: CoverWeight | undefined) => void;
  inline?: boolean;
  disabled?: boolean;
  onBeforeOpen?: () => void;
}) {
  const fontLabel = inline ? "Selected text font" : "Headline font";
  const weightName = inline ? "Selected text weight" : "Headline weight";
  return (
    <div className={inline ? "flex gap-1.5" : "space-y-3"}>
      <div>
        {!inline && (
          <div className="text-muted mb-1.5 font-sans text-xs font-medium">
            Headline font
          </div>
        )}
        <MenuSelect<CoverFont | undefined>
          portal
          returnFocusOnSelect={!inline}
          label=""
          ariaLabel={fontLabel}
          triggerLabel={fontLabel}
          current={
            family
              ? COVER_FONTS[family].label
              : inline
                ? "Inherit font"
                : "Original (Newsreader)"
          }
          value={family ?? undefined}
          disabled={disabled}
          onBeforeOpen={onBeforeOpen}
          className={inline ? "w-40" : "w-full"}
          menuClassName="scrollbar-soft"
          items={[
            {
              key: "inherit",
              value: undefined,
              content: inline ? "Inherit font" : "Original (Newsreader)",
            },
            ...COVER_FONT_IDS.map((value) => ({
              key: value,
              value,
              content: COVER_FONTS[value].label,
            })),
          ]}
          onSelect={onFamily}
        />
      </div>
      <div>
        {!inline && (
          <div className="text-muted mb-1.5 font-sans text-xs font-medium">
            Headline weight
          </div>
        )}
        <MenuSelect<CoverWeight | undefined>
          portal
          returnFocusOnSelect={!inline}
          label=""
          ariaLabel={weightName}
          triggerLabel={weightName}
          current={
            weight
              ? weightLabel(weight)
              : inline
                ? "Inherit weight"
                : "Original (Medium 500)"
          }
          value={weight ?? undefined}
          disabled={disabled}
          onBeforeOpen={onBeforeOpen}
          className={inline ? "w-40" : "w-full"}
          menuClassName="scrollbar-soft"
          items={[
            {
              key: "inherit",
              value: undefined,
              content: inline ? "Inherit weight" : "Original (Medium 500)",
            },
            ...fontWeights(effectiveFamily).map((value) => ({
              key: String(value),
              value,
              content: weightLabel(value),
            })),
          ]}
          onSelect={onWeight}
        />
      </div>
    </div>
  );
}
