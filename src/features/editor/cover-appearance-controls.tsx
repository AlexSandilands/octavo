import { Button } from "@/components/ui";
import {
  type CoverAppearance,
  resolveCoverAppearance,
} from "@/lib/cover-appearance";
import { CoverColorPicker, readableText } from "./cover-color-picker";
import { CoverShadowControl } from "./cover-shadow-control";
export function CoverAppearanceControls({
  value,
  style,
  onChange,
  inherited,
  onInherit,
  logo = false,
}: {
  value?: CoverAppearance;
  style?: string;
  onChange: (appearance: CoverAppearance) => void;
  inherited?: boolean;
  onInherit?: (inherit: boolean) => void;
  logo?: boolean;
}) {
  const resolved = resolveCoverAppearance(style, value);
  return (
    <div className="space-y-4">
      {onInherit && (
        <label className="text-muted flex cursor-pointer items-center gap-2 font-sans text-xs">
          <input
            type="checkbox"
            className="accent-accent h-4 w-4"
            checked={inherited}
            onChange={(e) => onInherit(e.target.checked)}
          />
          Use cover appearance
        </label>
      )}
      {!inherited && (
        <>
          <fieldset>
            <legend className="text-muted mb-2 font-sans text-xs font-medium">
              Background
            </legend>
            <div className="flex gap-1">
              {([false, true] as const).map((panel) => (
                <Button
                  key={String(panel)}
                  variant={resolved.panel === panel ? "primary" : "secondary"}
                  size="sm"
                  className="flex-1"
                  aria-label={`Background: ${panel ? "panel" : "none"}`}
                  aria-pressed={resolved.panel === panel}
                  onClick={() => onChange({ ...resolved, panel })}
                >
                  {panel ? "Panel" : "None"}
                </Button>
              ))}
            </div>
          </fieldset>
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
          {!logo && (
            <>
              <CoverColorPicker
                label="Element text colour"
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
