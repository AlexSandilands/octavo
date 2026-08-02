"use client";

import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { MenuSelect, type MenuSelectItem } from "./menu-select";

// The editor header's layout-theme picker. It replaced a click-to-cycle control
// that read as a dropdown but stepped through themes — misleading, and awkward
// once more than two themes are enabled (issue #33). The menu behaviour it
// introduced now lives in MenuSelect, shared with the footer-logo picker (#97);
// this only says which options exist and what the trigger reads.
export function ThemeMenu({
  themes,
  themeId,
  onSelect,
}: {
  themes: LayoutTheme[];
  themeId: LayoutThemeId;
  onSelect: (id: LayoutThemeId) => void;
}) {
  const items: MenuSelectItem<LayoutThemeId>[] = themes.map((t) => ({
    key: t.id,
    value: t.id,
    content: t.name,
  }));
  return (
    <MenuSelect
      label="Theme"
      current={themes.find((t) => t.id === themeId)?.name ?? ""}
      ariaLabel="Layout theme"
      items={items}
      value={themeId}
      onSelect={onSelect}
    />
  );
}
