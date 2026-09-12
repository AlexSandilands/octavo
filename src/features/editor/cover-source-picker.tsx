import { MenuSelect } from "@/components/menu-select";
import type { CoverSource } from "@/lib/cover-elements";

/** Picks one of the live section headings; `allowCustom` adds a free-standing option. */
export function SourcePicker({
  sources,
  selected,
  label,
  onSelect,
  allowCustom = false,
}: {
  sources: CoverSource[];
  selected?: string;
  label: string;
  onSelect: (id: string) => void;
  allowCustom?: boolean;
}) {
  if (!sources.length && !allowCustom)
    return (
      <p className="text-muted font-sans text-sm">
        Add a heading to a later page to include it here.
      </p>
    );
  return (
    <MenuSelect
      portal
      label={label}
      current={
        sources.find((s) => s.id === selected)?.title ??
        (allowCustom ? "Custom headline" : "Choose a heading")
      }
      ariaLabel="Section headings"
      value={selected ?? ""}
      className="w-full"
      menuClassName="w-full max-h-56 overflow-y-auto scrollbar-soft"
      items={[
        ...(allowCustom
          ? [
              {
                key: "custom",
                value: "",
                content: <span>Custom headline</span>,
              },
            ]
          : []),
        ...sources.map((s) => ({
          key: s.id,
          value: s.id,
          content: (
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
              <span className="truncate">{s.title}</span>
              <span className="text-muted shrink-0 text-xs">p. {s.pageNo}</span>
            </span>
          ),
        })),
      ]}
      onSelect={onSelect}
    />
  );
}
