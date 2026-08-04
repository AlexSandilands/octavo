"use client";

import { useState } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/lib/branding";
import type { LogoListItem } from "@/lib/logos";
import {
  enabledThemes,
  getTheme,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";
import { MenuSelect, type MenuSelectItem } from "@/features/editor/menu-select";

// The live preview beside the settings form: one real magazine page, drawn by
// the same PageFrame + PageFooter the reader, the editor and the PDF use, from
// the settings currently in the form rather than the ones in the database. That
// is the point of it — the footer's mark size, type size and alignment are hard
// to picture from three dropdowns, and the classic theme's ruled frame is the
// fiddly case (the lockup has to stay inside its inner hairline at every size).
//
// Its own two controls are not settings: the layout theme is chosen per issue
// and the mark per issue, so both are here purely to let the owner look at the
// combination they care about.

// Wide enough to read the footer at its smallest, narrow enough to sit beside
// the form on a laptop.
const PREVIEW_W = 340;

export function SettingsPreview({
  settings,
  logos,
}: {
  /** The effective settings for the form's current, possibly unsaved, state. */
  settings: SiteSettings;
  logos: LogoListItem[];
}) {
  const themes = enabledThemes();
  const [themeId, setThemeId] = useState<LayoutThemeId>(
    themes[0]?.id ?? "classic",
  );
  // Defaults to the first mark in the library: an owner opening this page wants
  // to see the lockup, and the library's newest mark is the one they just added.
  const [logoId, setLogoId] = useState<string | null>(logos[0]?.id ?? null);
  const logo = logos.find((l) => l.id === logoId)?.image ?? null;

  const themeItems: MenuSelectItem<LayoutThemeId>[] = themes.map((t) => ({
    key: t.id,
    value: t.id,
    content: t.name,
  }));
  const logoItems: MenuSelectItem<string | null>[] = [
    { key: "none", value: null, content: "No mark" },
    ...logos.map((l) => ({
      key: l.id,
      value: l.id as string | null,
      content: l.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <MenuSelect
          label="Theme"
          current={getTheme(themeId).name}
          ariaLabel="Preview layout theme"
          items={themeItems}
          value={themeId}
          onSelect={setThemeId}
        />
        {logos.length > 0 && (
          <MenuSelect
            label="Mark"
            current={logos.find((l) => l.id === logoId)?.name ?? "No mark"}
            ariaLabel="Preview footer mark"
            items={logoItems}
            value={logoId}
            onSelect={setLogoId}
          />
        )}
      </div>

      {/* Inert: a picture of a page, not a page. Nothing inside is reachable by
          keyboard or pointer, so it never competes with the form for focus. */}
      <div
        aria-hidden="true"
        className="pointer-events-none w-fit overflow-hidden rounded-[3px] shadow-[0_10px_30px_rgba(40,36,28,0.14)] select-none"
      >
        <ScaledPage scale={PREVIEW_W / PAGE_W}>
          <PageFrame
            theme={getTheme(themeId)}
            w={PAGE_W}
            h={PAGE_H}
            issueNo={12}
            pageNo={7}
            side="right"
            logo={logo}
            settings={settings}
          >
            <PlaceholderPage themeId={themeId} />
          </PageFrame>
        </ScaledPage>
      </div>

      <p className="text-faint2 max-w-[340px] font-sans text-[12px] leading-relaxed">
        A page at about a third of its real size, with stand-in words.{" "}
        {logos.length === 0 && (
          <>
            The library below has no marks yet —{" "}
            <Link
              href="#logos"
              className="text-accent font-medium underline underline-offset-2"
            >
              add one
            </Link>{" "}
            to see the footer lockup.
          </>
        )}
      </p>
    </div>
  );
}

// Stand-in body copy so the page has the weight of a real one behind the
// chrome. Deliberately not the block renderer: the preview is about the frame
// and the footer, and a fake IssueContent would drag the whole editor pipeline
// into this bundle for a heading and three paragraphs.
function PlaceholderPage({ themeId }: { themeId: LayoutThemeId }) {
  const heading = getTheme(themeId).heading.main;
  return (
    <>
      <div className={heading.wrapper}>
        <div className={getTheme(themeId).heading.kicker}>From the archive</div>
        <div className={heading.title}>A morning on the water</div>
        {heading.rule?.()}
      </div>
      <div className="text-body mt-5 space-y-3 font-serif text-[13px] leading-[1.62]">
        <p>
          The tide turned a little after six and the fleet went out with it,
          eleven boats strung along the channel in a light southerly that
          promised more than it delivered.
        </p>
        <p>
          By nine the wind had swung and stiffened, and the run home was the
          sort that gets retold at the clubhouse with the numbers gently
          improved. Nobody minded. The season had started.
        </p>
        <p>
          What follows is the log as it was kept, with the weather notes left in
          — they explain more about the day than any account of the racing
          could.
        </p>
      </div>
    </>
  );
}
