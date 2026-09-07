"use client";

import Link from "next/link";
import { Button, Pill } from "@/components/ui";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import type { LogoListItem } from "@/lib/logos";
import { LogoPicker } from "./logo-picker";
import { ThemeMenu } from "./theme-menu";

export type SaveStatus = "saved" | "saving" | "error" | "conflict";

// The editor's top bar: a way back, the editable title, the DRAFT box and the
// number, the autosave status in words (with Retry / Reload when a save did
// not land), and the mark / Look / Preview / Publish actions. All state and
// side effects live in the editor; this renders and delegates via callbacks.
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
    <header className="border-lead flex min-h-[60px] flex-none flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b-[3px] px-5 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link
          href="/admin"
          className="text-lead hover:text-red flex h-11 flex-none items-center font-ui text-[15px] font-semibold underline decoration-1 underline-offset-4"
        >
          ← Issues
        </Link>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Issue title"
          className="text-lead focus:border-lead min-w-0 flex-1 border-b border-transparent bg-transparent font-display text-[22px] font-semibold outline-none"
          placeholder="Untitled issue"
        />
        <span className="flex flex-none items-center gap-2">
          <Pill status="Draft" />
          <span className="small-caps text-grey-soft">No. {issueNumber}</span>
        </span>
        {status === "error" ? (
          <span
            role="alert"
            className="flex flex-none items-center gap-2 font-ui text-[14px]"
          >
            <span className="text-red font-semibold">Couldn’t save</span>
            <Button variant="link" size="sm" onClick={onRetrySave}>
              Retry
            </Button>
          </span>
        ) : status === "conflict" ? (
          <span
            role="alert"
            className="flex flex-none items-center gap-2 font-ui text-[14px]"
          >
            <span className="text-red font-semibold">
              Changed somewhere else
            </span>
            <Button variant="link" size="sm" onClick={onReload}>
              Reload
            </Button>
          </span>
        ) : (
          <span
            aria-live="polite"
            className="text-grey-soft flex-none font-ui text-[14px]"
          >
            {status === "saving" ? "Saving…" : "Saved"}
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
