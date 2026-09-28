"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import type { LogoListItem } from "@/lib/logos";
import { LogoPicker } from "./logo-picker";
import { PANEL_ID } from "./side-panel/surfaces";
import { ThemeMenu } from "./theme-menu";

export type SaveStatus = "saved" | "saving" | "error" | "conflict";

// The editor's top bar: back link, editable title, draft badge, the autosave
// status pill (with retry/reload affordances), the theme / Preview / Publish
// actions and, last, the one button that opens the side panel (#353). All
// state and side effects live in the editor; this renders and delegates via
// callbacks.
export function EditorHeader({
  title,
  onTitleChange,
  issueNumber,
  themes,
  themeId,
  onSelectTheme,
  logos,
  logoId,
  onSelectLogo,
  status,
  onRetrySave,
  onReload,
  onPreview,
  onPublish,
  panel,
  panelButton,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  issueNumber: number | null;
  /** The deployment-enabled layout themes; the picker hides with only one. */
  themes: LayoutTheme[];
  /** The current layout theme id. */
  themeId: LayoutThemeId;
  onSelectTheme: (id: LayoutThemeId) => void;
  /** The logo library to choose the issue's footer mark from. */
  logos: LogoListItem[];
  /** The current footer mark, or null for the text-only footer. */
  logoId: string | null;
  onSelectLogo: (logoId: string | null) => void;
  status: SaveStatus;
  onRetrySave: () => void;
  onReload: () => void;
  onPreview: () => void;
  onPublish: () => void;
  /** The side panel: pressed while it is out. */
  panel: { open: boolean; onToggle: () => void };
  /** The Panel button, so the panel's Close can hand the focus back to it. */
  panelButton: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="border-line flex h-[60px] flex-none items-center justify-between gap-4 border-b px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Link href="/admin" className="text-muted" aria-label="Back to issues">
          <Icon name="chevronLeft" size={20} />
        </Link>
        <input
          aria-label="Issue title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-ink w-full max-w-[280px] min-w-0 border-none bg-transparent font-serif text-[21px] outline-none"
          placeholder="Untitled issue"
        />
        <span className="bg-chip hidden shrink-0 items-center whitespace-nowrap lg:flex gap-1.5 rounded-full px-3 py-1">
          <span className="bg-chip-dot h-1.5 w-1.5 rounded-full" />
          {/* A draft has no number until it is published (issue #270). */}
          <span className="text-faint font-sans text-[11px] font-semibold">
            {issueNumber === null ? "Draft" : `No. ${issueNumber}`}
          </span>
        </span>
        {status === "error" ? (
          <span className="flex items-center gap-2 font-sans text-[12px]">
            <span className="text-warn font-semibold">Couldn’t save</span>
            <button
              onClick={onRetrySave}
              className="border-warn text-warn hover:bg-warn-soft rounded-md border px-2 py-0.5 font-semibold"
            >
              Retry
            </button>
          </span>
        ) : status === "conflict" ? (
          <span className="flex items-center gap-2 font-sans text-[12px]">
            <span className="text-warn font-semibold">
              Changed somewhere else
            </span>
            <button
              onClick={onReload}
              className="border-warn text-warn hover:bg-warn-soft rounded-md border px-2 py-0.5 font-semibold"
            >
              Reload
            </button>
          </span>
        ) : (
          <span className="text-faint2 shrink-0 whitespace-nowrap font-sans text-[11px]">
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <LogoPicker logos={logos} logoId={logoId} onChange={onSelectLogo} />
        {themes.length > 1 && (
          <ThemeMenu
            themes={themes}
            themeId={themeId}
            onSelect={onSelectTheme}
          />
        )}
        <Button variant="secondary" size="sm" onClick={onPreview}>
          Preview
        </Button>
        <Button size="sm" onClick={onPublish}>
          Publish
        </Button>
        {/* Icon only, square: the one control that opens and closes the panel. */}
        <Button
          ref={panelButton}
          variant={panel.open ? "primary" : "secondary"}
          size="sm"
          icon="panel"
          aria-label="Panel"
          title={panel.open ? "Close the panel" : "Open the panel"}
          aria-pressed={panel.open}
          aria-controls={PANEL_ID}
          className="w-10 px-0"
          onClick={panel.onToggle}
        >
          {null}
        </Button>
      </div>
    </header>
  );
}
