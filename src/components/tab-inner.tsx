import type { IconName } from "./icons";
import { Icon } from "./icons";

// The inside of one phone tab — shared by the tab bar's links and the "More"
// sheet's trigger, so the four cells match exactly.
export const TAB_CLASS =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-field font-ui text-[12px] font-bold transition-colors";

export function TabInner({
  icon,
  label,
  active,
}: {
  icon: IconName;
  label: string;
  active: boolean;
}) {
  return (
    <>
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
          active ? "bg-primary-soft text-primary" : "text-fg-muted"
        }`}
      >
        <Icon name={icon} size={24} strokeWidth={1.9} />
      </span>
      <span className={active ? "text-primary" : "text-fg-muted"}>{label}</span>
    </>
  );
}
