"use client";

import { Icon } from "@/components/icons";
import { Button, Chip } from "@/components/ui";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import type { LogoListItem } from "@/lib/logos";
import { LogoPicker } from "./logo-picker";
import { ThemeMenu } from "./theme-menu";

export type SaveStatus = "saved" | "saving" | "error" | "conflict";

// The editor's top bar: the way back, the editable title, the draft chip, the
// autosave status (with retry/reload affordances), and the logo / theme /
// Preview / Publish actions. All state and side effects live in the editor;
// this renders and delegates via callbacks.
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
    <header className="bg-surface border-hairline flex h-16 flex-none items-center justify-between gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          href="/admin"
          variant="quiet"
          size="sm"
          icon="arrowLeft"
          aria-label="Back to issues"
        >
          Issues
        </Button>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Issue title"
          className="text-fg hover:bg-primary-wash focus:bg-primary-wash h-10 w-[min(36vw,440px)] min-w-0 rounded-full border-none bg-transparent px-3 font-ui text-[18px] font-bold outline-none"
          placeholder="Untitled issue"
        />
        <Chip>Draft · No. {issueNumber}</Chip>
        {status === "error" ? (
          <span className="flex items-center gap-2 font-ui text-[14px]">
            <span className="text-danger font-bold">Couldn’t save</span>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={onRetrySave}
            >
              Retry
            </Button>
          </span>
        ) : status === "conflict" ? (
          <span className="flex items-center gap-2 font-ui text-[14px]">
            <span className="text-danger font-bold">
              Changed somewhere else
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={onReload}
            >
              Reload
            </Button>
          </span>
        ) : (
          <span
            className={`flex flex-none items-center gap-1 font-ui text-[14px] font-bold whitespace-nowrap ${
              status === "saving" ? "text-fg-muted" : "text-ok"
            }`}
          >
            {status === "saving" ? (
              "Saving…"
            ) : (
              <>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Saved
              </>
            )}
          </span>
        )}
      </div>
      <div className="flex flex-none items-center gap-2">
        <LogoPicker logos={logos} logoId={logoId} onChange={onSelectLogo} />
        {themes.length > 1 && (
          <ThemeMenu
            themes={themes}
            themeId={themeId}
            onSelect={onSelectTheme}
          />
        )}
        <Button variant="secondary" size="sm" icon="reader" onClick={onPreview}>
          Preview
        </Button>
        <Button size="sm" icon="check" onClick={onPublish}>
          Publish
        </Button>
      </div>
    </header>
  );
}
