"use client";

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
    <header className="border-hairline bg-raised text-chrome-text flex h-[60px] flex-none items-center justify-between gap-4 border-b px-3">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Button
          href="/admin"
          variant="ghost"
          tone="dark"
          size="sm"
          icon="arrowLeft"
          iconPosition="left"
          aria-label="Back to issues"
        >
          Issues
        </Button>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-chrome-text placeholder:text-chrome-muted rounded-ui min-w-0 max-w-[520px] flex-1 border-none bg-transparent font-display text-[21px] outline-none"
          placeholder="Untitled issue"
        />
        <span className="bg-lifted text-chrome-muted flex flex-none items-center gap-1.5 rounded-full px-3 py-1 font-meta text-[11px] font-medium tracking-[0.1em] uppercase">
          <span className="bg-chrome-muted h-1.5 w-1.5 rounded-full" />
          Draft · No. {issueNumber}
        </span>
        {status === "error" ? (
          <span className="flex flex-none items-center gap-2 font-ui text-[13px]">
            <span className="text-danger-bright font-semibold">
              Couldn’t save
            </span>
            <button
              onClick={onRetrySave}
              className="border-danger-bright text-danger-bright hover:bg-lifted rounded-ui cursor-pointer border px-2.5 py-1 font-semibold"
            >
              Retry
            </button>
          </span>
        ) : status === "conflict" ? (
          <span className="flex flex-none items-center gap-2 font-ui text-[13px]">
            <span className="text-danger-bright font-semibold">
              Changed somewhere else
            </span>
            <button
              onClick={onReload}
              className="border-danger-bright text-danger-bright hover:bg-lifted rounded-ui cursor-pointer border px-2.5 py-1 font-semibold"
            >
              Reload
            </button>
          </span>
        ) : (
          <span className="text-chrome-muted flex-none font-meta text-[11px] tracking-[0.1em] uppercase">
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
        )}
      </div>
      <div className="flex flex-none items-center gap-3">
        <LogoPicker
          logos={logos}
          logoId={logoId}
          onChange={onSelectLogo}
          tone="dark"
        />
        {themes.length > 1 && (
          <ThemeMenu
            themes={themes}
            themeId={themeId}
            onSelect={onSelectTheme}
            tone="dark"
          />
        )}
        <Button variant="secondary" tone="dark" size="sm" onClick={onPreview}>
          Preview
        </Button>
        <Button size="sm" onClick={onPublish}>
          Publish
        </Button>
      </div>
    </header>
  );
}
