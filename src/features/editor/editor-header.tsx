"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { ThemeMenu } from "./theme-menu";

export type SaveStatus = "saved" | "saving" | "error" | "conflict";

// The editor's top bar: back link, editable title, draft badge, the autosave
// status pill (with retry/reload affordances), and the theme / Preview / Publish
// actions. All state and side effects live in the editor; this renders and
// delegates via callbacks.
export function EditorHeader({
  title,
  onTitleChange,
  issueNumber,
  themes,
  themeId,
  onSelectTheme,
  status,
  onRetrySave,
  onReload,
  onPreview,
  onPublish,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  issueNumber: number;
  /** The deployment-enabled layout themes; the picker hides with only one. */
  themes: LayoutTheme[];
  /** The current layout theme id. */
  themeId: LayoutThemeId;
  onSelectTheme: (id: LayoutThemeId) => void;
  status: SaveStatus;
  onRetrySave: () => void;
  onReload: () => void;
  onPreview: () => void;
  onPublish: () => void;
}) {
  return (
    <header className="border-line flex h-[60px] flex-none items-center justify-between border-b px-6">
      <div className="flex items-center gap-3.5">
        <Link href="/admin" className="text-muted" aria-label="Back to issues">
          <Icon name="chevronLeft" size={20} />
        </Link>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-ink min-w-0 border-none bg-transparent font-serif text-[21px] outline-none"
          placeholder="Untitled issue"
        />
        <span className="bg-chip flex items-center gap-1.5 rounded-full px-3 py-1">
          <span className="bg-chip-dot h-1.5 w-1.5 rounded-full" />
          <span className="text-faint font-sans text-[11px] font-semibold">
            Draft · No. {issueNumber}
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
          <span className="text-faint2 font-sans text-[11px]">
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {themes.length > 1 && (
          <ThemeMenu
            themes={themes}
            themeId={themeId}
            onSelect={onSelectTheme}
          />
        )}
        <button
          onClick={onPreview}
          className="border-hair text-ink flex h-10 items-center rounded-lg border-[1.5px] bg-white px-4 font-sans text-sm font-semibold"
        >
          Preview
        </button>
        <button
          onClick={onPublish}
          className="bg-accent text-paper flex h-10 items-center rounded-lg px-5 font-sans text-sm font-semibold shadow-[0_2px_8px_rgba(29,77,62,0.25)]"
        >
          Publish
        </button>
      </div>
    </header>
  );
}
