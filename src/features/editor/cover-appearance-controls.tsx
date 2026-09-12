import { SelectCheckbox } from "@/components/select-checkbox";
import {
  type CoverAppearance,
  resolveCoverAppearance,
} from "@/lib/cover-appearance";
import { CoverColorPicker, readableText } from "./cover-color-picker";
import { CoverShadowControl } from "./cover-shadow-control";
import { Segments } from "./cover-segments";

/** Panel, text colour and shadow for the whole cover or one item on it. */
export function CoverAppearanceControls({
  value,
  style,
  onChange,
  inherited,
  onInherit,
  panelOnly = false,
}: {
  value?: CoverAppearance;
  style?: string;
  onChange: (appearance: CoverAppearance) => void;
  inherited?: boolean;
  onInherit?: (inherit: boolean) => void;
  /** Logos and photos carry no type, so only the panel applies. */
  panelOnly?: boolean;
}) {
  const resolved = resolveCoverAppearance(style, value);
  return (
    <div className="space-y-4">
      {onInherit && (
        <div className="-ml-3">
          <SelectCheckbox
            label="Use cover appearance"
            checked={Boolean(inherited)}
            onChange={onInherit}
          >
            Use cover appearance
          </SelectCheckbox>
        </div>
      )}
      {!inherited && (
        <>
          <Segments
            label="Background"
            value={resolved.panel ? "panel" : "none"}
            options={[
              { value: "none", label: "None" },
              { value: "panel", label: "Panel" },
            ]}
            onChange={(v) => onChange({ ...resolved, panel: v === "panel" })}
          />
          {resolved.panel && (
            <CoverColorPicker
              label="Panel colour"
              value={resolved.background}
              onChange={(background) =>
                onChange({
                  ...resolved,
                  background,
                  text: readableText(background),
                })
              }
            />
          )}
          {!panelOnly && (
            <>
              <CoverColorPicker
                label="Text colour"
                value={resolved.text}
                onChange={(text) => onChange({ ...resolved, text })}
              />
              <CoverShadowControl
                value={resolved.shadow}
                color={resolved.shadowColor}
                onChange={(shadow, shadowColor) =>
                  onChange({ ...resolved, shadow, shadowColor })
                }
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
