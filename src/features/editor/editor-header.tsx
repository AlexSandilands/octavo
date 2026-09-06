"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import type { LogoListItem } from "@/lib/logos";
import { LogoPicker } from "./logo-picker";
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
  published,
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
}: {
  title: string;
  onTitleChange: (v: string) => void;
  issueNumber: number;
  published: boolean;
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
}) {
  return (
    <header className="index-editor-header flex-none">
      <div className="min-w-0">
        <div className="index-editor-title">
          <Link
            href="/admin"
            className="text-accent flex h-11 w-11 flex-none items-center justify-center border border-hair hover:bg-tint"
            aria-label="Back to issues"
          >
            <Icon name="chevronLeft" size={20} />
          </Link>
          <input
            aria-label="Issue title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-ink min-w-0 border-none bg-transparent font-serif text-[21px] outline-none"
            placeholder="Untitled issue"
          />
        </div>
        <div className="index-editor-meta mt-2">
          <span className="text-accent">PUBLISHING DESK</span>
          <span className="bg-chip flex items-center gap-1.5 px-3 py-1">
            <span className="bg-chip-dot h-1.5 w-1.5 rounded-full" />
            <span className="text-faint font-sans text-[11px] font-semibold">
              {published ? "Published" : "Draft"} · No. {issueNumber}
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
      </div>
      <div className="index-editor-actions">
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
      </div>
    </header>
  );
}
